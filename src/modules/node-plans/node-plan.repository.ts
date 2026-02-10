/**
 * 节点套餐数据访问层
 *
 * @file node-plan.repository.ts
 * @description 封装节点套餐表的增删改查数据库操作
 */
import { eq, and, sql, desc, asc } from 'drizzle-orm';
import { db } from '../../db';
import { nodePlans, type NodePlan, type NewNodePlan, type BillingCycle } from '../../db/schema/nodePlans';

/**
 * 查询节点套餐列表
 */
export async function findAll(params: {
  nodeId?: number;
  planTemplateId?: number;
  status?: number;
  page?: number;
  pageSize?: number;
}): Promise<{ list: NodePlan[]; total: number }> {
  const { nodeId, planTemplateId, status, page = 1, pageSize = 10 } = params;

  const conditions = [];
  if (nodeId !== undefined) {
    conditions.push(eq(nodePlans.nodeId, nodeId));
  }
  if (planTemplateId !== undefined) {
    conditions.push(eq(nodePlans.planTemplateId, planTemplateId));
  }
  if (status !== undefined) {
    conditions.push(eq(nodePlans.status, status));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // 查询总数
  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(nodePlans)
    .where(whereClause);
  const total = Number(countResult[0]?.count || 0);

  // 查询列表
  const list = await db
    .select()
    .from(nodePlans)
    .where(whereClause)
    .orderBy(asc(nodePlans.sortOrder), desc(nodePlans.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return { list, total };
}

/**
 * 根据ID查询节点套餐
 */
export async function findById(id: number): Promise<NodePlan | undefined> {
  const result = await db.select().from(nodePlans).where(eq(nodePlans.id, id)).limit(1);
  return result[0];
}

/**
 * 检查节点是否已关联该套餐模板
 */
export async function existsByNodeAndTemplate(nodeId: number, planTemplateId: number, excludeId?: number): Promise<boolean> {
  const conditions = [
    eq(nodePlans.nodeId, nodeId),
    eq(nodePlans.planTemplateId, planTemplateId),
  ];
  if (excludeId) {
    conditions.push(sql`${nodePlans.id} != ${excludeId}`);
  }

  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(nodePlans)
    .where(and(...conditions))
    .limit(1);

  return result[0]?.count > 0;
}

/**
 * 创建节点套餐
 */
export async function create(data: NewNodePlan): Promise<NodePlan> {
  const result = await db.insert(nodePlans).values(data).returning();
  return result[0];
}

/**
 * 更新节点套餐
 */
export async function update(
  id: number,
  data: Partial<NewNodePlan>,
): Promise<NodePlan | undefined> {
  const result = await db
    .update(nodePlans)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(nodePlans.id, id))
    .returning();
  return result[0];
}

/**
 * 删除节点套餐
 */
export async function remove(id: number): Promise<boolean> {
  const result = await db.delete(nodePlans).where(eq(nodePlans.id, id)).returning();
  return result.length > 0;
}

/**
 * 根据节点ID删除所有套餐
 */
export async function removeByNodeId(nodeId: number): Promise<boolean> {
  const result = await db.delete(nodePlans).where(eq(nodePlans.nodeId, nodeId)).returning();
  return result.length > 0;
}

/**
 * 扣减库存
 * @returns 扣减后的库存数量，如果库存不足返回 null
 */
export async function deductStock(id: number): Promise<number | null> {
  // 先查询当前库存
  const plan = await findById(id);
  if (!plan) return null;
  
  // -1 表示无限库存，不需要扣减
  if (plan.stock === -1) return -1;
  
  // 库存不足
  if (plan.stock <= 0) return null;
  
  // 扣减库存并增加已售数量
  const [result] = await db
    .update(nodePlans)
    .set({
      stock: sql`${nodePlans.stock} - 1`,
      soldCount: sql`${nodePlans.soldCount} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(nodePlans.id, id))
    .returning();
  
  return result?.stock ?? null;
}
