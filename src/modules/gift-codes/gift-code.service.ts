/**
 * 赠金码业务逻辑层
 *
 * @file gift-code.service.ts
 * @description 赠金码相关的业务逻辑处理
 */
import {
  findById,
  findByCode,
  findMany,
  create,
  update,
  remove,
  getUserUsageCount,
  findUsageRecords,
} from './gift-code.repository';
import { findById as findUserById } from '../auth/auth.repository';
import { db, giftCodes, giftCodeUsages, users } from '../../db';
import type { NewGiftCode, GiftCode } from '../../db/schema';
import { sql, eq } from 'drizzle-orm';

/**
 * 获取赠金码列表
 */
export async function getGiftCodeList(params: {
  page: number;
  pageSize: number;
  keyword?: string;
  isActive?: boolean;
}) {
  return findMany(params);
}

/**
 * 获取赠金码详情
 */
export async function getGiftCodeById(id: number): Promise<GiftCode> {
  const giftCode = await findById(id);
  if (!giftCode) {
    throw new Error('赠金码不存在');
  }
  return giftCode;
}

/**
 * 创建赠金码
 */
export async function createGiftCode(data: NewGiftCode): Promise<GiftCode> {
  // 检查赠金码是否已存在
  const existing = await findByCode(data.code);
  if (existing) {
    throw new Error('赠金码已存在');
  }

  // 验证金额
  const amount = Number(data.amount);
  if (amount <= 0) {
    throw new Error('赠金金额必须大于 0');
  }

  // 验证时间范围
  if (data.startAt && data.endAt && new Date(data.startAt) >= new Date(data.endAt)) {
    throw new Error('生效时间必须早于过期时间');
  }

  return create(data);
}

/**
 * 更新赠金码
 */
export async function updateGiftCode(
  id: number,
  data: Partial<NewGiftCode>
): Promise<GiftCode> {
  const giftCode = await findById(id);
  if (!giftCode) {
    throw new Error('赠金码不存在');
  }

  // 如果修改了 code，检查是否与其他赠金码冲突
  if (data.code && data.code !== giftCode.code) {
    const existing = await findByCode(data.code);
    if (existing) {
      throw new Error('赠金码已存在');
    }
  }

  // 验证金额
  if (data.amount) {
    const amount = Number(data.amount);
    if (amount <= 0) {
      throw new Error('赠金金额必须大于 0');
    }
  }

  // 验证时间范围
  if (data.startAt && data.endAt && new Date(data.startAt) >= new Date(data.endAt)) {
    throw new Error('生效时间必须早于过期时间');
  }

  return update(id, data);
}

/**
 * 删除赠金码
 */
export async function deleteGiftCode(id: number): Promise<void> {
  const giftCode = await findById(id);
  if (!giftCode) {
    throw new Error('赠金码不存在');
  }

  // 如果赠金码已被使用，不允许删除
  if (giftCode.usageCount > 0) {
    throw new Error('赠金码已被使用，无法删除，建议禁用');
  }

  await remove(id);
}

/**
 * 验证赠金码
 */
export async function validateGiftCode(
  code: string,
  userId: number
): Promise<{
  valid: boolean;
  message?: string;
  giftCode?: GiftCode;
}> {
  // 查找赠金码
  const giftCode = await findByCode(code);
  if (!giftCode) {
    return { valid: false, message: '赠金码不存在' };
  }

  // 检查是否启用
  if (!giftCode.isActive) {
    return { valid: false, message: '赠金码已禁用' };
  }

  // 检查使用时间
  const now = new Date();
  if (giftCode.startAt && now < new Date(giftCode.startAt)) {
    return { valid: false, message: '赠金码尚未生效' };
  }
  if (giftCode.endAt && now > new Date(giftCode.endAt)) {
    return { valid: false, message: '赠金码已过期' };
  }

  // 检查总使用次数限制
  if (giftCode.usageLimit !== null && giftCode.usageCount >= giftCode.usageLimit) {
    return { valid: false, message: '赠金码使用次数已达上限' };
  }

  // 检查每人使用次数限制
  const userUsageCount = await getUserUsageCount(giftCode.id, userId);
  if (userUsageCount >= giftCode.perUserLimit) {
    return { valid: false, message: '您已达到该赠金码的使用次数限制' };
  }

  return {
    valid: true,
    giftCode,
  };
}

/**
 * 使用赠金码（给用户余额增加赠金）
 */
export async function useGiftCode(params: {
  code: string;
  userId: number;
}): Promise<{
  success: boolean;
  message: string;
  giftAmount?: number;
  newBalance?: number;
}> {
  const { code, userId } = params;

  // 1. 验证赠金码
  const validation = await validateGiftCode(code, userId);
  if (!validation.valid) {
    return { success: false, message: validation.message! };
  }

  const giftCode = validation.giftCode!;
  const giftAmount = Number(giftCode.amount);

  // 2. 查询用户
  const user = await findUserById(userId);
  if (!user) {
    return { success: false, message: '用户不存在' };
  }

  try {
    // 3. 使用事务执行所有操作
    const result = await useGiftCodeTransaction({
      giftCode,
      userId,
      giftAmount,
      currentBalance: Number(user.balance),
    });

    return {
      success: true,
      message: `成功领取赠金 ${giftAmount} 元`,
      giftAmount,
      newBalance: result.newBalance,
    };
  } catch (error: any) {
    return { success: false, message: error.message || '领取失败，请重试' };
  }
}

/**
 * 赠金码使用事务（确保原子性）
 */
async function useGiftCodeTransaction(params: {
  giftCode: GiftCode;
  userId: number;
  giftAmount: number;
  currentBalance: number;
}): Promise<{ newBalance: number }> {
  const { giftCode, userId, giftAmount, currentBalance } = params;
  
  return await db.transaction(async (tx) => {
    // 1. 创建使用记录
    await tx.insert(giftCodeUsages).values({
      giftCodeId: giftCode.id,
      userId,
      amount: giftAmount.toString(),
    });

    // 2. 增加赠金码使用次数
    await tx
      .update(giftCodes)
      .set({
        usageCount: sql`${giftCodes.usageCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(giftCodes.id, giftCode.id));

    // 3. 更新用户余额（使用原子操作避免并发问题）
    const newBalance = currentBalance + giftAmount;
    await tx
      .update(users)
      .set({
        balance: newBalance.toString(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    return { newBalance };
  });
}

/**
 * 获取赠金码使用记录
 */
export async function getGiftCodeUsageRecords(params: {
  giftCodeId?: number;
  userId?: number;
  page: number;
  pageSize: number;
}) {
  return findUsageRecords(params);
}
