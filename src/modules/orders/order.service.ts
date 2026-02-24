/**
 * 订单业务逻辑层
 *
 * @file order.service.ts
 * @description 订单相关的业务逻辑处理，包括创建订单和应用优惠码
 */
import {
  findById,
  findByOrderNo,
  findByUserId,
  generateOrderNo,
} from './order.repository';
import {
  findById as findNodePlanById,
} from '../node-plans/node-plan.repository';
import {
  findById as findUserById,
} from '../auth/auth.repository';
import {
  validateAndCalculate,
} from '../promo-codes/promo-code.service';
import {
  createInstance,
  getContainerCreateParams,
  setContainerInfo,
  setInstanceError,
  generateRootPassword,
} from '../instances/instance.service';
import {
  sendContainerCreateCommand,
  isNodeConnected,
} from '../agent-channel/command.service';
import { db, orders, nodePlans, promoCodeUsages, promoCodes, users } from '../../db';
import type { NewOrder, Order } from '../../db/schema';
import { sql, eq } from 'drizzle-orm';

/**
 * 创建订单并立即支付（支持优惠码）- 使用事务确保原子性
 * 支付成功后自动创建实例并触发容器创建
 */
export async function createOrder(params: {
  userId: number;
  nodePlanId: number;
  billingCycle: string;
  durationMonths: number;
  promoCode?: string;
  imageId: number;
}): Promise<{
  order: Order;
  instanceId: number;
  discountInfo?: {
    promoCode: string;
    originalAmount: number;
    discountAmount: number;
    finalAmount: number;
  };
}> {
  const { userId, nodePlanId, billingCycle, durationMonths, promoCode, imageId } = params;

  // 1. 验证套餐是否存在
  const nodePlan = await findNodePlanById(nodePlanId);
  if (!nodePlan) {
    throw new Error('套餐不存在');
  }
  if (nodePlan.status !== 1) {
    throw new Error('套餐已下架');
  }

  // 2. 获取计费周期价格
  const billingCycles = nodePlan.billingCycles as any[];
  const selectedCycle = billingCycles.find(
    (c) => c.cycle === billingCycle && c.enabled
  );
  if (!selectedCycle) {
    throw new Error('计费周期不可用');
  }

  // 3. 计算原始金额
  const originalPrice = selectedCycle.price * durationMonths;

  // 4. 验证并应用优惠码
  let discountAmount = 0;
  let finalPrice = originalPrice;
  let appliedPromoCode: any = null;

  if (promoCode) {
    const validation = await validateAndCalculate(
      promoCode,
      originalPrice,
      'purchase',
      userId
    );

    if (!validation.valid) {
      throw new Error(validation.message);
    }

    discountAmount = validation.discountAmount;
    finalPrice = validation.finalAmount;
    appliedPromoCode = validation.promoCode;
  }

  // 5. 检查用户余额
  const user = await findUserById(userId);
  if (!user) {
    throw new Error('用户不存在');
  }
  
  const userBalance = Number(user.balance);
  if (userBalance < finalPrice) {
    throw new Error(`余额不足，当前余额: ${userBalance.toFixed(2)}，需要支付: ${finalPrice.toFixed(2)}`);
  }

  // 6. 使用事务执行所有操作（扣款、扣减库存、创建订单、创建优惠码记录）
  return await db.transaction(async (tx) => {
    // 6.1 扣减用户余额
    const [updatedUser] = await tx
      .update(users)
      .set({
        balance: sql`${users.balance} - ${finalPrice.toString()}`,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();

    if (!updatedUser) {
      throw new Error('扣款失败');
    }

    // 6.2 扣减库存（使用原子操作）
    const [updatedNodePlan] = await tx
      .update(nodePlans)
      .set({
        stock: sql`CASE 
          WHEN ${nodePlans.stock} = -1 THEN -1 
          WHEN ${nodePlans.stock} > 0 THEN ${nodePlans.stock} - 1 
          ELSE ${nodePlans.stock} 
        END`,
        soldCount: sql`${nodePlans.soldCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(nodePlans.id, nodePlanId))
      .returning();

    // 检查库存是否足够
    if ((updatedNodePlan.stock ?? -1) !== -1 && (updatedNodePlan.stock ?? 0) < 0) {
      throw new Error('套餐库存不足');
    }

    // 6.3 创建订单（状态为已支付）
    const now = new Date();
    const [order] = await tx
      .insert(orders)
      .values({
        orderNo: generateOrderNo(),
        userId,
        nodePlanId,
        instanceId: null,
        type: 'new',
        status: 'paid',
        billingCycle,
        durationMonths,
        originalPrice: originalPrice.toString(),
        discountAmount: discountAmount.toString(),
        finalPrice: finalPrice.toString(),
        paymentChannel: 'balance',
        paidAt: now,
        paymentTradeNo: null,
        periodStartAt: now,
        periodEndAt: new Date(now.getTime() + durationMonths * 30 * 24 * 60 * 60 * 1000),
        remark: null,
      })
      .returning();

    // 6.4 创建实例记录
    const expiresAt = new Date(now.getTime() + durationMonths * 30 * 24 * 60 * 60 * 1000);
    const instance = await createInstance({
      userId,
      nodeId: nodePlan.nodeId,
      nodePlanId,
      imageId,
      expiresAt,
    });

    // 6.5 更新订单的 instanceId
    await tx
      .update(orders)
      .set({ instanceId: instance.id })
      .where(eq(orders.id, order.id));

    // 6.6 如果使用了优惠码，创建使用记录并增加使用次数
    if (appliedPromoCode) {
      await tx.insert(promoCodeUsages).values({
        promoCodeId: appliedPromoCode.id,
        userId,
        orderId: order.id,
        usageType: 'purchase',
        originalAmount: originalPrice.toString(),
        discountAmount: discountAmount.toString(),
        finalAmount: finalPrice.toString(),
      });

      // 增加优惠码使用次数
      await tx
        .update(promoCodes)
        .set({
          usageCount: sql`${promoCodes.usageCount} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(promoCodes.id, appliedPromoCode.id));
    }

    // 6.7 异步触发容器创建（不阻塞事务）
    triggerContainerCreation(instance.id, nodePlan.nodeId).catch((err) => {
      console.error(`[Order] 容器创建失败 [instanceId=${instance.id}]:`, err);
    });

    return {
      order,
      instanceId: instance.id,
      discountInfo: appliedPromoCode
        ? {
            promoCode: appliedPromoCode.code,
            originalAmount: originalPrice,
            discountAmount,
            finalAmount: finalPrice,
          }
        : undefined,
    };
  });
}

/**
 * 异步触发容器创建
 * 从实例服务获取创建参数，发送命令到 Agent
 */
async function triggerContainerCreation(instanceId: number, nodeId: number): Promise<void> {
  try {
    // 获取容器创建参数
    const params = await getContainerCreateParams(instanceId);
    const rootPassword = generateRootPassword();

    // 检查节点是否在线
    if (!isNodeConnected(nodeId)) {
      console.warn(`[Order] 节点离线，容器创建将延迟 [nodeId=${nodeId}, instanceId=${instanceId}]`);
      // 节点离线时，实例保持"创建中"状态，等待节点上线后通过其他机制重试
      return;
    }

    // 发送创建命令
    const result = await sendContainerCreateCommand(nodeId, {
      name: params.containerName,
      image: params.imageRef,
      hostname: params.hostname,
      memory: params.memory,
      memorySwap: params.memory * 2,
      storageOpt: `size=${params.diskGb}G`,
      cpus: params.cpus,
      sshPort: params.sshPort,
      network: params.network,
      ip: params.internalIp,
      ip6: params.internalIp6,
      env: {
        ROOT_PASSWORD: rootPassword,
      },
      restartPolicy: 'always',
    });

    if (result.success && result.containerId) {
      // 更新实例信息
      await setContainerInfo(instanceId, result.containerId, params.internalIp);
      console.log(`[Order] 容器创建成功 [instanceId=${instanceId}, containerId=${result.containerId}]`);

      // 创建 SSH 端口映射（通过 iptables）
      try {
        const instance = await findInstanceById(instanceId);
        if (instance && instance.internalIp) {
          const { create } = await import('../nat-ports/nat-port.repository');
          const { NatPortStatus } = await import('../nat-ports/nat-port.service');
          const { sendPortForwardCommand } = await import('../agent-channel/command.service');

          // 写入数据库
          await create({
            instanceId,
            nodeId,
            protocol: 'tcp',
            internalPort: 22,
            externalPort: params.sshPort,
            description: 'SSH',
            status: NatPortStatus.ENABLED,
            lastSyncedAt: new Date(),
          });

          // 设置 iptables 转发
          await sendPortForwardCommand(nodeId, {
            protocol: 'tcp',
            port: params.sshPort,
            targetIp: instance.internalIp,
            targetPort: 22,
            ipType: 'ipv4',
          });

          console.log(`[Order] SSH 端口映射已创建 [instanceId=${instanceId}, externalPort=${params.sshPort}]`);
        }
      } catch (error: any) {
        console.error(`[Order] 创建 SSH 端口映射失败：${error.message}`);
      }
    } else {
      // 创建失败，设置实例为错误状态
      await setInstanceError(instanceId, result.message);
      console.error(`[Order] 容器创建失败 [instanceId=${instanceId}]: ${result.message}`);
    }
  } catch (error: any) {
    // 异常情况，设置实例为错误状态
    await setInstanceError(instanceId, error.message);
    console.error(`[Order] 容器创建异常 [instanceId=${instanceId}]:`, error);
  }
}

/**
 * 获取订单详情
 */
export async function getOrderById(id: number): Promise<Order> {
  const order = await findById(id);
  if (!order) {
    throw new Error('订单不存在');
  }
  return order;
}

/**
 * 获取订单详情（根据订单号）
 */
export async function getOrderByOrderNo(orderNo: string): Promise<Order> {
  const order = await findByOrderNo(orderNo);
  if (!order) {
    throw new Error('订单不存在');
  }
  return order;
}

/**
 * 获取用户订单列表
 */
export async function getUserOrders(params: {
  userId: number;
  page: number;
  pageSize: number;
  status?: string;
}) {
  return findByUserId(params);
}

/**
 * 计算订单金额（预览，不创建订单）
 */
export async function calculateOrderAmount(params: {
  nodePlanId: number;
  billingCycle: string;
  durationMonths: number;
  promoCode?: string;
  userId: number;
}): Promise<{
  originalAmount: number;
  discountAmount: number;
  finalAmount: number;
  promoCodeValid: boolean;
  promoCodeMessage?: string;
}> {
  const { nodePlanId, billingCycle, durationMonths, promoCode, userId } = params;

  // 1. 验证套餐
  const nodePlan = await findNodePlanById(nodePlanId);
  if (!nodePlan) {
    throw new Error('套餐不存在');
  }
  if (nodePlan.status !== 1) {
    throw new Error('套餐已下架');
  }

  // 2. 获取价格
  const billingCycles = nodePlan.billingCycles as any[];
  const selectedCycle = billingCycles.find(
    (c) => c.cycle === billingCycle && c.enabled
  );
  if (!selectedCycle) {
    throw new Error('计费周期不可用');
  }

  // 3. 计算金额
  const originalAmount = selectedCycle.price * durationMonths;

  // 4. 验证优惠码
  if (promoCode) {
    const validation = await validateAndCalculate(
      promoCode,
      originalAmount,
      'purchase',
      userId
    );

    return {
      originalAmount,
      discountAmount: validation.discountAmount,
      finalAmount: validation.finalAmount,
      promoCodeValid: validation.valid,
      promoCodeMessage: validation.message,
    };
  }

  return {
    originalAmount,
    discountAmount: 0,
    finalAmount: originalAmount,
    promoCodeValid: true,
  };
}
