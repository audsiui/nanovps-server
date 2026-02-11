/**
 * 节点上报容器数据表 Schema 定义
 *
 * @file nodeReportContainers.ts
 * @description 存储 Agent 上报的容器监控数据，与 node_reports 表关联
 */
import { pgTable, bigserial, bigint, varchar, decimal, index } from 'drizzle-orm/pg-core';
import { nodeReports } from './nodeReports';

/**
 * 容器上报数据表 - 存储每个容器的监控指标
 */
export const nodeReportContainers = pgTable(
  'node_report_containers',
  {
    /** 记录唯一标识 */
    id: bigserial('id', { mode: 'number' }).primaryKey(),

    /** 关联的上报记录 ID */
    reportId: bigint('report_id', { mode: 'number' })
      .notNull()
      .references(() => nodeReports.id, { onDelete: 'cascade' }),

    /** 容器短 ID */
    containerId: varchar('container_id', { length: 12 }).notNull(),

    /** 容器名称 */
    name: varchar('name', { length: 100 }).notNull(),

    /** CPU 使用率（百分比，保留4位小数） */
    cpuPercent: decimal('cpu_percent', { precision: 10, scale: 4 }).notNull(),

    /** 内存使用量（字节） */
    memoryUsage: bigint('memory_usage', { mode: 'number' }).notNull(),

    /** 内存限制（字节） */
    memoryLimit: bigint('memory_limit', { mode: 'number' }).notNull(),

    /** 内存使用率（百分比，保留4位小数） */
    memoryUsagePercent: decimal('memory_usage_percent', { precision: 10, scale: 4 }).notNull(),

    /** 网络下载速率（字节/秒） */
    networkRxRate: bigint('network_rx_rate', { mode: 'number' }).notNull(),

    /** 网络上传速率（字节/秒） */
    networkTxRate: bigint('network_tx_rate', { mode: 'number' }).notNull(),

    /** 网络累计接收字节数 */
    networkRxTotal: bigint('network_rx_total', { mode: 'number' }).notNull(),

    /** 网络累计发送字节数 */
    networkTxTotal: bigint('network_tx_total', { mode: 'number' }).notNull(),
  },
  (table) => [
    // 按 reportId 查询索引
    index('idx_containers_report_id').on(table.reportId),
    // 按容器名称查询索引
    index('idx_containers_name').on(table.name),
  ]
);

/** 容器上报数据查询返回类型 */
export type NodeReportContainer = typeof nodeReportContainers.$inferSelect;

/** 容器上报数据插入类型 */
export type NewNodeReportContainer = typeof nodeReportContainers.$inferInsert;
