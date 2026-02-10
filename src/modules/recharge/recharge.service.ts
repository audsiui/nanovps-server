/**
 * 充值业务逻辑层
 *
 * @file recharge.service.ts
 * @description 充值相关的业务逻辑处理
 */
import {
  findById,
  findByRechargeNo,
  create,
  update,
  findByUserId,
  generateRechargeNo,
} from './recharge.repository';
import type { NewRecharge, Recharge } from '../../db/schema';

/**
 * 创建充值记录
 */
export async function createRecharge(params: {
  userId: number;
  amount: number;
  channel: string;
}): Promise<{
  recharge: Recharge;
}> {
  const { userId, amount, channel } = params;

  // 验证充值金额
  if (amount <= 0) {
    throw new Error('充值金额必须大于 0');
  }

  // 验证支付渠道
  const validChannels = ['alipay', 'wechat', 'stripe', 'paypal'];
  if (!validChannels.includes(channel)) {
    throw new Error('不支持的支付渠道');
  }

  // 创建充值记录
  const recharge = await create({
    rechargeNo: generateRechargeNo(),
    userId,
    amount: amount.toString(),
    bonusAmount: '0',
    finalAmount: amount.toString(),
    status: 'pending',
    channel: channel as any,
    paidAt: null,
    tradeNo: null,
  });

  return {
    recharge,
  };
}

/**
 * 获取充值记录详情
 */
export async function getRechargeById(id: number): Promise<Recharge> {
  const recharge = await findById(id);
  if (!recharge) {
    throw new Error('充值记录不存在');
  }
  return recharge;
}

/**
 * 获取用户充值记录列表
 */
export async function getUserRecharges(params: {
  userId: number;
  page: number;
  pageSize: number;
  status?: string;
}) {
  return findByUserId(params);
}
