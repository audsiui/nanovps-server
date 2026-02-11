/**
 * Agent 上报数据数据库访问层
 *
 * @file report.repository.ts
 * @description 封装节点上报数据的增删改查数据库操作
 */
import { db } from '../../db';
import { nodeReports, type NodeReport, type NewNodeReport } from '../../db/schema/nodeReports';
import { nodeReportContainers, type NodeReportContainer, type NewNodeReportContainer } from '../../db/schema/nodeReportContainers';
import { desc, eq, and, gte, lte, sql } from 'drizzle-orm';

/**
 * 容器数据结构（来自 Agent 上报）
 */
export interface ContainerData {
  id: string;
  name: string;
  cpuPercent: number;
  memory: {
    usage: number;
    limit: number;
    usagePercent: number;
  };
  network: {
    rxRate: number;
    txRate: number;
    rxTotal: number;
    txTotal: number;
  };
}

/**
 * 保存上报数据到数据库（包含容器数据）
 */
export async function saveReport(
  data: NewNodeReport,
  containers: ContainerData[]
): Promise<{ report: NodeReport; containers: NodeReportContainer[] }> {
  // 使用事务确保数据一致性
  return await db.transaction(async (tx) => {
    // 1. 保存主报告
    const [report] = await tx.insert(nodeReports).values(data).returning();

    // 2. 保存容器数据
    const containerRecords: NewNodeReportContainer[] = containers.map((c) => ({
      reportId: report.id,
      containerId: c.id,
      name: c.name,
      cpuPercent: String(c.cpuPercent),
      memoryUsage: c.memory.usage,
      memoryLimit: c.memory.limit,
      memoryUsagePercent: String(c.memory.usagePercent),
      networkRxRate: c.network.rxRate,
      networkTxRate: c.network.txRate,
      networkRxTotal: c.network.rxTotal,
      networkTxTotal: c.network.txTotal,
    }));

    const savedContainers =
      containerRecords.length > 0
        ? await tx.insert(nodeReportContainers).values(containerRecords).returning()
        : [];

    return { report, containers: savedContainers };
  });
}

/**
 * 根据 ID 查询上报记录（包含容器数据）
 */
export async function findById(id: number): Promise<{ report: NodeReport; containers: NodeReportContainer[] } | undefined> {
  const [report] = await db
    .select()
    .from(nodeReports)
    .where(eq(nodeReports.id, id))
    .limit(1);

  if (!report) return undefined;

  const containers = await db
    .select()
    .from(nodeReportContainers)
    .where(eq(nodeReportContainers.reportId, id));

  return { report, containers };
}

/**
 * 根据 Agent ID 查询最新的一条上报记录（包含容器数据）
 */
export async function findLatestByAgentId(agentId: string): Promise<{ report: NodeReport; containers: NodeReportContainer[] } | undefined> {
  const [report] = await db
    .select()
    .from(nodeReports)
    .where(eq(nodeReports.agentId, agentId))
    .orderBy(desc(nodeReports.timestamp))
    .limit(1);

  if (!report) return undefined;

  const containers = await db
    .select()
    .from(nodeReportContainers)
    .where(eq(nodeReportContainers.reportId, report.id));

  return { report, containers };
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
 * 查询某条上报记录的所有容器数据
 */
export async function findContainersByReportId(reportId: number): Promise<NodeReportContainer[]> {
  return await db
    .select()
    .from(nodeReportContainers)
    .where(eq(nodeReportContainers.reportId, reportId));
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
