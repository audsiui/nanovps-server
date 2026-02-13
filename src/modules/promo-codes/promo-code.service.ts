/**
 * 优惠码业务逻辑层
 *
 * @file promo-code.service.ts
 * @description 优惠码相关的业务逻辑处理
 */
import {
  findById,
  findByCode,
  findMany,
  create,
  update,
  remove,
  incrementUsageCount,
  getUserUsageCount,
  createUsageRecord,
  findUsageRecords,
} from './promo-code.repository';
import type { NewPromoCode, PromoCode } from '../../db/schema';

/**
 * 获取优惠码列表
 */
export async function getPromoCodeList(params: {
  page: number;
  pageSize: number;
  keyword?: string;
  isActive?: boolean;
}) {
  return findMany(params);
}

/**
 * 获取优惠码详情
 */
export async function getPromoCodeById(id: number): Promise<PromoCode> {
  const promoCode = await findById(id);
  if (!promoCode) {
    throw new Error('优惠码不存在');
  }
  return promoCode;
}

/**
 * 创建优惠码
 */
export async function createPromoCode(data: NewPromoCode): Promise<PromoCode> {
  // 处理空字符串时间字段
  if (data.startAt === '' || data.startAt === undefined) {
    data.startAt = null as any;
  }
  if (data.endAt === '' || data.endAt === undefined) {
    data.endAt = null as any;
  }

  // 检查优惠码是否已存在
  const existing = await findByCode(data.code);
  if (existing) {
    throw new Error('优惠码已存在');
  }

  // 验证百分比类型的值范围
  if (data.type === 'percentage') {
    const value = Number(data.value);
    if (value <= 0 || value > 100) {
      throw new Error('百分比优惠码的值必须在 0-100 之间');
    }
  }

  // 验证固定金额类型的值
  if (data.type === 'fixed') {
    const value = Number(data.value);
    if (value <= 0) {
      throw new Error('固定金额优惠码的值必须大于 0');
    }
  }

  // 验证时间范围
  if (data.startAt && data.endAt && new Date(data.startAt) >= new Date(data.endAt)) {
    throw new Error('生效时间必须早于过期时间');
  }

  return create(data);
}

/**
 * 更新优惠码
 */
export async function updatePromoCode(
  id: number,
  data: Partial<NewPromoCode>
): Promise<PromoCode> {
  // 处理空字符串时间字段
  if (data.startAt === '' || data.startAt === undefined) {
    data.startAt = null as any;
  }
  if (data.endAt === '' || data.endAt === undefined) {
    data.endAt = null as any;
  }

  const promoCode = await findById(id);
  if (!promoCode) {
    throw new Error('优惠码不存在');
  }

  // 如果修改了 code，检查是否与其他优惠码冲突
  if (data.code && data.code !== promoCode.code) {
    const existing = await findByCode(data.code);
    if (existing) {
      throw new Error('优惠码已存在');
    }
  }

  // 验证百分比类型的值范围
  if (data.type === 'percentage' && data.value) {
    const value = Number(data.value);
    if (value <= 0 || value > 100) {
      throw new Error('百分比优惠码的值必须在 0-100 之间');
    }
  }

  // 验证固定金额类型的值
  if (data.type === 'fixed' && data.value) {
    const value = Number(data.value);
    if (value <= 0) {
      throw new Error('固定金额优惠码的值必须大于 0');
    }
  }

  // 验证时间范围
  if (data.startAt && data.endAt && new Date(data.startAt) >= new Date(data.endAt)) {
    throw new Error('生效时间必须早于过期时间');
  }

  return update(id, data);
}

/**
 * 删除优惠码
 */
export async function deletePromoCode(id: number): Promise<void> {
  const promoCode = await findById(id);
  if (!promoCode) {
    throw new Error('优惠码不存在');
  }

  // 如果优惠码已被使用，不允许删除
  if (promoCode.usageCount > 0) {
    throw new Error('优惠码已被使用，无法删除，建议禁用');
  }

  await remove(id);
}

/**
 * 验证并计算优惠金额
 */
export async function validateAndCalculate(
  code: string,
  amount: number,
  usageType: 'purchase',
  userId: number
): Promise<{
  valid: boolean;
  message?: string;
  promoCode?: PromoCode;
  discountAmount: number;
  finalAmount: number;
}> {
  // 查找优惠码
  const promoCode = await findByCode(code);
  if (!promoCode) {
    return { valid: false, message: '优惠码不存在', discountAmount: 0, finalAmount: amount };
  }

  // 检查是否启用
  if (!promoCode.isActive) {
    return { valid: false, message: '优惠码已禁用', discountAmount: 0, finalAmount: amount };
  }

  // 检查使用时间
  const now = new Date();
  if (promoCode.startAt && now < new Date(promoCode.startAt)) {
    return { valid: false, message: '优惠码尚未生效', discountAmount: 0, finalAmount: amount };
  }
  if (promoCode.endAt && now > new Date(promoCode.endAt)) {
    return { valid: false, message: '优惠码已过期', discountAmount: 0, finalAmount: amount };
  }

  // 检查总使用次数限制
  if (promoCode.usageLimit !== null && promoCode.usageCount >= promoCode.usageLimit) {
    return { valid: false, message: '优惠码使用次数已达上限', discountAmount: 0, finalAmount: amount };
  }

  // 检查每人使用次数限制
  const userUsageCount = await getUserUsageCount(promoCode.id, userId);
  if (userUsageCount >= promoCode.perUserLimit) {
    return { valid: false, message: '您已达到该优惠码的使用次数限制', discountAmount: 0, finalAmount: amount };
  }

  // 检查最小使用金额
  if (promoCode.minAmount && amount < Number(promoCode.minAmount)) {
    return { valid: false, message: `订单金额需满 ${promoCode.minAmount} 元才能使用该优惠码`, discountAmount: 0, finalAmount: amount };
  }

  // 计算优惠金额
  let discountAmount = 0;
  if (promoCode.type === 'fixed') {
    discountAmount = Number(promoCode.value);
    // 固定金额优惠不能超过订单金额
    if (discountAmount > amount) {
      discountAmount = amount;
    }
  } else if (promoCode.type === 'percentage') {
    discountAmount = amount * (Number(promoCode.value) / 100);
    // 检查最大优惠金额限制
    if (promoCode.maxDiscount && discountAmount > Number(promoCode.maxDiscount)) {
      discountAmount = Number(promoCode.maxDiscount);
    }
  }

  // 保留两位小数
  discountAmount = Math.round(discountAmount * 100) / 100;
  const finalAmount = Math.round((amount - discountAmount) * 100) / 100;

  return {
    valid: true,
    promoCode,
    discountAmount,
    finalAmount,
  };
}

/**
 * 使用优惠码（创建使用记录并增加使用次数）
 */
export async function usePromoCode(params: {
  promoCodeId: number;
  userId: number;
  orderId?: number;
  originalAmount: number;
  discountAmount: number;
  finalAmount: number;
}) {
  const { promoCodeId, userId, orderId, originalAmount, discountAmount, finalAmount } = params;

  // 创建使用记录
  await createUsageRecord({
    promoCodeId,
    userId,
    orderId: orderId || null,
    usageType: 'purchase',
    originalAmount: originalAmount.toString(),
    discountAmount: discountAmount.toString(),
    finalAmount: finalAmount.toString(),
  });

  // 增加使用次数
  await incrementUsageCount(promoCodeId);
}

/**
 * 获取优惠码使用记录
 */
export async function getPromoCodeUsageRecords(params: {
  promoCodeId?: number;
  userId?: number;
  page: number;
  pageSize: number;
}) {
  return findUsageRecords(params);
}
