/**
 * 节点数据访问层
 *
 * @file node.repository.ts
 * @description 封装节点表的增删改查数据库操作
 */
import { eq, sql } from 'drizzle-orm';
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
    .where(sql`${conditions.join(' AND ')}`)
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
    .where(sql`${conditions.join(' AND ')}`)
    .limit(1);

  return result[0]?.count > 0;
}
