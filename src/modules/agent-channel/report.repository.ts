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

/**
 * 容器历史数据点（用于图表展示）
 */
export interface ContainerHistoryPoint {
  timestamp: number;
  cpuPercent: number;
  memoryUsagePercent: number;
  memoryUsage: number;
  memoryLimit: number;
  networkRxRate: number;
  networkTxRate: number;
  networkRxTotal: number;
  networkTxTotal: number;
}

/**
 * 查询特定容器的历史监控数据
 * 用于实例详情页的图表展示
 */
export async function findContainerHistory(params: {
  agentId: string;
  containerId: string;
  startTime: number;
  endTime: number;
}): Promise<{ list: ContainerHistoryPoint[]; total: number }> {
  const { agentId, containerId, startTime, endTime } = params;

  // 1. 查询该 agentId 在时间范围内的所有 reports
  const reports = await db
    .select({
      id: nodeReports.id,
      timestamp: nodeReports.timestamp,
    })
    .from(nodeReports)
    .where(and(
      eq(nodeReports.agentId, agentId),
      gte(nodeReports.timestamp, startTime),
      lte(nodeReports.timestamp, endTime)
    ))
    .orderBy(desc(nodeReports.timestamp));

  if (reports.length === 0) {
    return { list: [], total: 0 };
  }

  // 2. 获取所有 reportId
  const reportIds = reports.map(r => r.id);

  // 3. 查询容器数据（筛选特定 containerId）
  const containers = await db
    .select()
    .from(nodeReportContainers)
    .where(and(
      sql`${nodeReportContainers.reportId} IN (${sql.join(reportIds.map(id => sql`${id}`), sql`, `)})`,
      eq(nodeReportContainers.containerId, containerId)
    ));

  // 4. 创建 reportId -> timestamp 的映射
  const reportTimestampMap = new Map(reports.map(r => [r.id, r.timestamp]));

  // 5. 组装结果（按时间升序排列，便于图表展示）
  const list: ContainerHistoryPoint[] = containers
    .map(c => ({
      timestamp: reportTimestampMap.get(c.reportId) || 0,
      cpuPercent: Number(c.cpuPercent),
      memoryUsagePercent: Number(c.memoryUsagePercent),
      memoryUsage: c.memoryUsage,
      memoryLimit: c.memoryLimit,
      networkRxRate: c.networkRxRate,
      networkTxRate: c.networkTxRate,
      networkRxTotal: c.networkRxTotal,
      networkTxTotal: c.networkTxTotal,
    }))
    .filter(p => p.timestamp > 0)
    .sort((a, b) => a.timestamp - b.timestamp);

  return { list, total: list.length };
}
