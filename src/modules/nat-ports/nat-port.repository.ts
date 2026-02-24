/**
 * NAT 端口映射数据访问层
 *
 * @file nat-port.repository.ts
 * @description NAT 端口映射的数据库操作
 */
import { db } from '../../db';
import { natPortMappings, type NatPortMapping, type NewNatPortMapping } from '../../db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';

/**
 * 根据 ID 查找端口映射
 */
export async function findById(id: number): Promise<NatPortMapping | null> {
  const result = await db
    .select()
    .from(natPortMappings)
    .where(eq(natPortMappings.id, id))
    .limit(1);
  return result[0] || null;
}

/**
 * 查询实例的端口映射列表
 */
export async function findByInstanceId(
  instanceId: number
): Promise<NatPortMapping[]> {
  return db
    .select()
    .from(natPortMappings)
    .where(eq(natPortMappings.instanceId, instanceId))
    .orderBy(desc(natPortMappings.createdAt));
}

/**
 * 查询节点的端口映射列表（检查端口占用）
 */
export async function findByNodeId(
  nodeId: number
): Promise<NatPortMapping[]> {
  return db
    .select()
    .from(natPortMappings)
    .where(eq(natPortMappings.nodeId, nodeId));
}

/**
 * 检查节点的端口是否已被占用
 */
export async function isPortOccupied(
  nodeId: number,
  externalPort: number,
  protocol?: 'tcp' | 'udp',
  excludeInstanceId?: number
): Promise<boolean> {
  const conditions = [
    eq(natPortMappings.nodeId, nodeId),
    eq(natPortMappings.externalPort, externalPort),
  ];

  // 如果指定了协议，只检查该协议的端口
  if (protocol) {
    conditions.push(eq(natPortMappings.protocol, protocol));
  }

  // 排除指定实例的端口（用于批量创建时）
  if (excludeInstanceId) {
    conditions.push(sql`${natPortMappings.instanceId} != ${excludeInstanceId}`);
  }

  const result = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(natPortMappings)
    .where(and(...conditions));

  return result[0]?.count > 0;
}

/**
 * 创建端口映射
 */
export async function create(data: NewNatPortMapping): Promise<NatPortMapping> {
  const [result] = await db.insert(natPortMappings).values(data).returning();
  return result;
}

/**
 * 更新端口映射
 */
export async function update(
  id: number,
  data: Partial<NewNatPortMapping>
): Promise<NatPortMapping | null> {
  const [result] = await db
    .update(natPortMappings)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(natPortMappings.id, id))
    .returning();
  return result || null;
}

/**
 * 更新同步状态
 */
export async function updateSyncStatus(
  id: number,
  status: number,
  syncError?: string
): Promise<NatPortMapping | null> {
  return update(id, {
    status,
    syncError,
    lastSyncedAt: status === 1 ? new Date() : null,
  });
}

/**
 * 删除端口映射
 */
export async function remove(id: number): Promise<void> {
  await db.delete(natPortMappings).where(eq(natPortMappings.id, id));
}

/**
 * 统计实例的端口映射数量
 */
export async function countByInstanceId(instanceId: number): Promise<number> {
  const [{ value: count }] = await db
    .select({ value: sql<number>`count(*)`.mapWith(Number) })
    .from(natPortMappings)
    .where(eq(natPortMappings.instanceId, instanceId));
  return count;
}
