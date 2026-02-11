/**
 * 订单数据访问层
 *
 * @file order.repository.ts
 * @description 订单相关的数据库操作
 */
import { db } from '../../db';
import { orders, nodePlans, instances, planTemplates, nodes, type Order, type NewOrder } from '../../db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';

/**
 * 生成订单号
 * 格式: ORD + 年月日 + 6位随机数
 */
export function generateOrderNo(): string {
  const date = new Date();
  const dateStr = date.getFullYear().toString() +
    String(date.getMonth() + 1).padStart(2, '0') +
    String(date.getDate()).padStart(2, '0');
  const randomStr = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
  return `ORD${dateStr}${randomStr}`;
}

/**
 * 根据ID查找订单（包含完整信息）
 * 返回：订单详情 + 金额信息 + 套餐详情 + 实例详情 + 节点信息
 */
export async function findById(id: number): Promise<any | null> {
  const result = await db
    .select({
      order: orders,
      nodePlan: nodePlans,
      instance: instances,
      planTemplate: planTemplates,
      node: nodes,
    })
    .from(orders)
    .leftJoin(nodePlans, eq(orders.nodePlanId, nodePlans.id))
    .leftJoin(instances, eq(orders.instanceId, instances.id))
    .leftJoin(planTemplates, eq(nodePlans.planTemplateId, planTemplates.id))
    .leftJoin(nodes, eq(nodePlans.nodeId, nodes.id))
    .where(eq(orders.id, id))
    .limit(1);

  if (!result[0]) return null;

  const item = result[0];
  return {
    ...item.order,
    node: item.node ? {
      id: item.node.id,
      name: item.node.name,
      ipv4: item.node.ipv4,
      ipv6: item.node.ipv6,
    } : null,
    nodePlan: item.nodePlan ? {
      id: item.nodePlan.id,
      nodeId: item.nodePlan.nodeId,
      stock: item.nodePlan.stock,
      soldCount: item.nodePlan.soldCount,
      billingCycles: item.nodePlan.billingCycles,
      status: item.nodePlan.status,
    } : null,
    instance: item.instance ? {
      id: item.instance.id,
      name: item.instance.name,
      hostname: item.instance.hostname,
      status: item.instance.status,
      cpu: item.instance.cpu,
      ramMb: item.instance.ramMb,
      diskGb: item.instance.diskGb,
      internalIp: item.instance.internalIp,
      createdAt: item.instance.createdAt,
      expiresAt: item.instance.expiresAt,
    } : null,
    planTemplate: item.planTemplate ? {
      id: item.planTemplate.id,
      name: item.planTemplate.name,
      cpu: item.planTemplate.cpu,
      ramMb: item.planTemplate.ramMb,
      diskGb: item.planTemplate.diskGb,
      trafficGb: item.planTemplate.trafficGb,
      bandwidthMbps: item.planTemplate.bandwidthMbps,
    } : null,
  };
}

/**
 * 根据订单号查找订单
 */
export async function findByOrderNo(orderNo: string): Promise<Order | null> {
  const result = await db
    .select()
    .from(orders)
    .where(eq(orders.orderNo, orderNo))
    .limit(1);
  return result[0] || null;
}

/**
 * 创建订单
 */
export async function create(data: NewOrder): Promise<Order> {
  const [result] = await db.insert(orders).values(data).returning();
  return result;
}

/**
 * 更新订单
 */
export async function update(id: number, data: Partial<NewOrder>): Promise<Order> {
  const [result] = await db
    .update(orders)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(orders.id, id))
    .returning();
  return result;
}

/**
 * 查询用户订单列表（简洁信息）
 * 返回：订单号、节点名称、类型、套餐名称、金额、状态、创建时间
 */
export async function findByUserId(params: {
  userId: number;
  page: number;
  pageSize: number;
  status?: string;
}) {
  const { userId, page, pageSize, status } = params;
  const offset = (page - 1) * pageSize;

  const conditions = [eq(orders.userId, userId)];
  if (status) {
    conditions.push(eq(orders.status, status as any));
  }

  const data = await db
    .select({
      order: orders,
      node: nodes,
      planTemplate: planTemplates,
    })
    .from(orders)
    .leftJoin(nodePlans, eq(orders.nodePlanId, nodePlans.id))
    .leftJoin(nodes, eq(nodePlans.nodeId, nodes.id))
    .leftJoin(planTemplates, eq(nodePlans.planTemplateId, planTemplates.id))
    .where(and(...conditions))
    .orderBy(desc(orders.createdAt))
    .limit(pageSize)
    .offset(offset);

  const [{ value: total }] = await db
    .select({ value: sql`count(*)`.mapWith(Number) })
    .from(orders)
    .where(and(...conditions));

  // 格式化返回简洁数据
  const formattedData = data.map((item) => ({
    id: item.order.id,
    orderNo: item.order.orderNo,
    nodeName: item.node?.name || null,
    type: item.order.type,
    planName: item.planTemplate?.name || null,
    finalPrice: item.order.finalPrice,
    status: item.order.status,
    createdAt: item.order.createdAt,
  }));

  return {
    list: formattedData,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}
