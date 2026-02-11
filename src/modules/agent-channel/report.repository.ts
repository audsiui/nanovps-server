/**
 * Agent 上报数据数据库访问层
 *
 * @file report.repository.ts
 * @description 封装节点上报数据的增删改查数据库操作
 */
import { db } from '../../db';
import { nodeReports, type NodeReport, type NewNodeReport } from '../../db/schema/nodeReports';
import { desc, eq, and, gte, lte, sql } from 'drizzle-orm';

/**
 * 保存上报数据到数据库
 */
export async function saveReport(data: NewNodeReport): Promise<NodeReport> {
  const result = await db.insert(nodeReports).values(data).returning();
  return result[0];
}

/**
 * 根据 ID 查询上报记录
 */
export async function findById(id: number): Promise<NodeReport | undefined> {
  const result = await db
    .select()
    .from(nodeReports)
    .where(eq(nodeReports.id, id))
    .limit(1);
  return result[0];
}

/**
 * 根据 Agent ID 查询最新的一条上报记录
 */
export async function findLatestByAgentId(agentId: string): Promise<NodeReport | undefined> {
  const result = await db
    .select()
    .from(nodeReports)
    .where(eq(nodeReports.agentId, agentId))
    .orderBy(desc(nodeReports.timestamp))
    .limit(1);
  return result[0];
}

/**
 * 查询 Agent 的上报历史
 * 支持时间范围筛选和分页
 */
export async function findByAgentId(params: {
  agentId: string;
  startTime?: number;
  endTime?: number;
  page?: number;
  pageSize?: number;
}): Promise<{ list: NodeReport[]; total: number }> {
  const { agentId, startTime, endTime, page = 1, pageSize = 20 } = params;

  // 构建筛选条件
  const conditions = [eq(nodeReports.agentId, agentId)];
  
  if (startTime !== undefined) {
    conditions.push(gte(nodeReports.timestamp, startTime));
  }
  
  if (endTime !== undefined) {
    conditions.push(lte(nodeReports.timestamp, endTime));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // 查询总数
  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(nodeReports)
    .where(whereClause);
  const total = Number(countResult[0]?.count || 0);

  // 查询列表
  const list = await db
    .select()
    .from(nodeReports)
    .where(whereClause)
    .orderBy(desc(nodeReports.timestamp))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return { list, total };
}

/**
 * 根据节点 ID 查询上报历史
 */
export async function findByNodeId(params: {
  nodeId: number;
  startTime?: number;
  endTime?: number;
  page?: number;
  pageSize?: number;
}): Promise<{ list: NodeReport[]; total: number }> {
  const { nodeId, startTime, endTime, page = 1, pageSize = 20 } = params;

  const conditions = [eq(nodeReports.nodeId, nodeId)];
  
  if (startTime !== undefined) {
    conditions.push(gte(nodeReports.timestamp, startTime));
  }
  
  if (endTime !== undefined) {
    conditions.push(lte(nodeReports.timestamp, endTime));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(nodeReports)
    .where(whereClause);
  const total = Number(countResult[0]?.count || 0);

  const list = await db
    .select()
    .from(nodeReports)
    .where(whereClause)
    .orderBy(desc(nodeReports.timestamp))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return { list, total };
}

/**
 * 删除指定时间之前的历史数据
 * 用于数据清理
 */
export async function deleteBefore(timestamp: number): Promise<number> {
  const result = await db
    .delete(nodeReports)
    .where(lte(nodeReports.timestamp, timestamp))
    .returning({ id: nodeReports.id });
  
  return result.length;
}
