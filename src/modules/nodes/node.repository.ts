/**
 * 节点数据访问层
 *
 * @file node.repository.ts
 * @description 封装节点表的增删改查数据库操作
 */
import { and, eq, sql } from 'drizzle-orm';
import { db } from '../../db';
import { nodes, type Node, type NewNode } from '../../db/schema/nodes';

/**
 * 根据ID查询节点
 */
export async function findById(id: number): Promise<Node | undefined> {
  const result = await db.select().from(nodes).where(eq(nodes.id, id)).limit(1);
  return result[0];
}

/**
 * 根据 Agent Token 查询节点
 */
export async function findByAgentToken(agentToken: string): Promise<Node | undefined> {
  const result = await db
    .select()
    .from(nodes)
    .where(eq(nodes.agentToken, agentToken))
    .limit(1);
  return result[0];
}

/**
 * 根据名称查询节点
 */
export async function findByName(name: string): Promise<Node | undefined> {
  const result = await db
    .select()
    .from(nodes)
    .where(eq(nodes.name, name))
    .limit(1);
  return result[0];
}

/**
 * 创建节点
 */
export async function create(data: NewNode): Promise<Node> {
  const result = await db.insert(nodes).values(data).returning();
  return result[0];
}

/**
 * 更新节点
 */
export async function update(
  id: number,
  data: Partial<NewNode>,
): Promise<Node | undefined> {
  const result = await db
    .update(nodes)
    .set(data)
    .where(eq(nodes.id, id))
    .returning();
  return result[0];
}

/**
 * 检查名称是否已存在
 */
export async function existsByName(name: string, excludeId?: number): Promise<boolean> {
  const conditions = [eq(nodes.name, name)];
  if (excludeId) {
    conditions.push(sql`${nodes.id} != ${excludeId}`);
  }

  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(nodes)
    .where(and(...conditions))
    .limit(1);

  return result[0]?.count > 0;
}

/**
 * 检查 Agent Token 是否已存在
 */
export async function existsByAgentToken(agentToken: string, excludeId?: number): Promise<boolean> {
  const conditions = [eq(nodes.agentToken, agentToken)];
  if (excludeId) {
    conditions.push(sql`${nodes.id} != ${excludeId}`);
  }

  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(nodes)
    .where(and(...conditions))
    .limit(1);

  return result[0]?.count > 0;
}

/**
 * 查询节点列表
 * 支持分页、状态筛选、区域筛选、关键词搜索
 */
export async function findAll(params: {
  page?: number;
  pageSize?: number;
  status?: number;
  regionId?: number;
  keyword?: string;
}): Promise<{ list: Node[]; total: number }> {
  const { page = 1, pageSize = 10, status, regionId, keyword } = params;

  // 构建筛选条件
  const conditions = [];
  if (status !== undefined) {
    conditions.push(eq(nodes.status, status));
  }
  if (regionId !== undefined) {
    conditions.push(eq(nodes.regionId, regionId));
  }
  if (keyword) {
    conditions.push(
      sql`${nodes.name} ILIKE ${`%${keyword}%`} OR ${nodes.ipv4} ILIKE ${`%${keyword}%`} OR ${nodes.ipv6} ILIKE ${`%${keyword}%`}`
    );
  }
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // 查询总数
  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(nodes)
    .where(whereClause);
  const total = Number(countResult[0]?.count || 0);

  // 查询列表
  const list = await db
    .select()
    .from(nodes)
    .where(whereClause)
    .orderBy(sql`${nodes.id} DESC`)
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return { list, total };
}
