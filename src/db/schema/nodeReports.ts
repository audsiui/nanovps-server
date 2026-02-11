/**
 * 节点上报数据表 Schema 定义
 *
 * @file nodeReports.ts
 * @description 存储 Agent 上报的节点监控数据快照，每 10 分钟保存一次
 */
import { pgTable, bigserial, bigint, varchar, timestamp, jsonb } from 'drizzle-orm/pg-core';

/**
 * 节点上报数据表 - 存储监控数据历史快照
 */
export const nodeReports = pgTable('node_reports', {
  /** 记录唯一标识 */
  id: bigserial('id', { mode: 'number' }).primaryKey(),

  /** 关联的节点 ID */
  nodeId: bigint('node_id', { mode: 'number' }).notNull(),

  /** Agent 唯一标识符 */
  agentId: varchar('agent_id', { length: 64 }).notNull(),

  /** 数据采集时间戳（Agent 上报时间） */
  timestamp: bigint('timestamp', { mode: 'number' }).notNull(),

  /** 主机状态快照（JSONB 格式） */
  hostSnapshot: jsonb('host_snapshot').notNull(),

  /** 容器状态快照（JSONB 格式） */
  containersSnapshot: jsonb('containers_snapshot').notNull(),

  /** 记录创建时间（入库时间） */
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

/** 节点上报数据查询返回类型 */
export type NodeReport = typeof nodeReports.$inferSelect;

/** 节点上报数据插入类型 */
export type NewNodeReport = typeof nodeReports.$inferInsert;
