/**
 * 实例数据访问层
 *
 * @file instance.repository.ts
 * @description 实例相关的数据库操作
 */
import { db } from '../../db';
import { instances, nodes, images, natPortMappings, type Instance, type NewInstance } from '../../db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';

/**
 * 根据ID查找实例
 */
export async function findById(id: number): Promise<Instance | null> {
  const result = await db
    .select()
    .from(instances)
    .where(eq(instances.id, id))
    .limit(1);
  return result[0] || null;
}

/**
 * 根据 ID 查找实例（包含节点、镜像和 SSH 端口信息）
 */
export async function findByIdWithDetails(id: number): Promise<any | null> {
  const result = await db
    .select({
      instance: instances,
      node: {
        id: sql<number>`${nodes}.id`,
        name: sql<string>`${nodes}.name`,
        ipv4: sql<string | null>`${nodes}.ipv4`,
        ipv6: sql<string | null>`${nodes}.ipv6`,
        status: sql<number>`${nodes}.status`,
      },
      image: {
        id: sql<number>`${images}.id`,
        name: sql<string>`${images}.name`,
        imageRef: sql<string>`${images}.image_ref`,
        family: sql<string>`${images}.family`,
      },
      sshPort: sql<number | null>`(
        SELECT ${natPortMappings.externalPort}
        FROM ${natPortMappings}
        WHERE ${natPortMappings.instanceId} = ${instances.id}
        AND ${natPortMappings.description} = 'SSH'
        LIMIT 1
      )`.mapWith(Number),
    })
    .from(instances)
    .leftJoin(nodes, sql`${instances.nodeId} = ${nodes}.id`)
    .leftJoin(images, sql`${instances.imageId} = ${images}.id`)
    .where(eq(instances.id, id))
    .limit(1);

  if (!result[0]) return null;

  const { instance, node, image, sshPort } = result[0];
  return {
    ...instance,
    node,
    image,
    sshPort,
  };
}

/**
 * 查询用户实例列表
 */
export async function findByUserId(params: {
  userId: number;
  page: number;
  pageSize: number;
  status?: number;
}): Promise<{ list: Instance[]; total: number }> {
  const { userId, page, pageSize, status } = params;
  const offset = (page - 1) * pageSize;

  const conditions = [eq(instances.userId, userId)];
  if (status !== undefined) {
    conditions.push(eq(instances.status, status));
  }

  const list = await db
    .select()
    .from(instances)
    .where(and(...conditions))
    .orderBy(desc(instances.createdAt))
    .limit(pageSize)
    .offset(offset);

  const [{ value: total }] = await db
    .select({ value: sql`count(*)`.mapWith(Number) })
    .from(instances)
    .where(and(...conditions));

  return { list, total };
}

/**
 * 创建实例
 */
export async function create(data: NewInstance): Promise<Instance> {
  const [result] = await db.insert(instances).values(data).returning();
  return result;
}

/**
 * 更新实例
 */
export async function update(id: number, data: Partial<NewInstance>): Promise<Instance | null> {
  const [result] = await db
    .update(instances)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(instances.id, id))
    .returning();
  return result || null;
}

/**
 * 更新实例状态
 */
export async function updateStatus(id: number, status: number): Promise<Instance | null> {
  return update(id, { status });
}

/**
 * 更新容器信息（Agent 创建成功后回填）
 */
export async function updateContainerInfo(
  id: number,
  data: { containerId: string; internalIp: string }
): Promise<Instance | null> {
  return update(id, {
    containerId: data.containerId,
    internalIp: data.internalIp,
    status: 1,
    lastStartedAt: new Date(),
  });
}

/**
 * 统计节点上的实例数量
 */
export async function countByNodeId(nodeId: number): Promise<number> {
  const [{ value: count }] = await db
    .select({ value: sql`count(*)`.mapWith(Number) })
    .from(instances)
    .where(and(
      eq(instances.nodeId, nodeId),
      sql`${instances.status} NOT IN (5, 6)`
    ));
  return count;
}

/**
 * 根据容器ID查找实例
 */
export async function findByContainerId(containerId: string): Promise<Instance | null> {
  const result = await db
    .select()
    .from(instances)
    .where(eq(instances.containerId, containerId))
    .limit(1);
  return result[0] || null;
}

/**
 * 删除实例（软删除，设置状态为6）
 */
export async function softDelete(id: number): Promise<Instance | null> {
  return update(id, {
    status: 6,
    destroyedAt: new Date(),
  });
}

/**
 * 获取节点上已使用的 IP 列表
 */
export async function getUsedIpsByNodeId(nodeId: number): Promise<string[]> {
  const results = await db
    .select({ internalIp: instances.internalIp })
    .from(instances)
    .where(and(
      eq(instances.nodeId, nodeId),
      sql`${instances.status} NOT IN (5, 6)`,
      sql`${instances.internalIp} IS NOT NULL`
    ));
  
  return results
    .map(r => r.internalIp)
    .filter((ip): ip is string => ip !== null);
}


/**
 * 根据节点ID和状态查找实例列表
 * 用于节点上线时重试待创建的实例
 */
export async function findByNodeIdAndStatus(nodeId: number, statuses: number | number[]): Promise<Instance[]> {
  const statusArray = Array.isArray(statuses) ? statuses : [statuses];
  return db
    .select()
    .from(instances)
    .where(and(
      eq(instances.nodeId, nodeId),
      sql`${instances.status} IN (${sql.join(statusArray.map(s => sql`${s}`), sql`, `)})`
    ));
}
