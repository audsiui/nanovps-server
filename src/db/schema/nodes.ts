/**
 * 节点表 Schema 定义
 *
 * @file nodes.ts
 * @description 定义 VPS 宿主机节点的数据库表结构，用于管理各节点的资源、状态和认证信息。
 */
import {
  pgTable,
  bigserial,
  bigint,
  varchar,
  smallint,
  timestamp,
  integer,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

/**
 * 节点表 - 存储 VPS 宿主机节点信息，包含资源、状态、认证等字段
 */
export const nodes = pgTable(
  "nodes",
  {
    // ==================== 基础信息 ====================
    /** 节点唯一标识，自增主键 */
    id: bigserial("id", { mode: "number" }).primaryKey(),

    /** 节点名称，用于展示，如"香港-01" */
    name: varchar("name", { length: 50 }).notNull(),

    // ==================== 认证与安全 ====================
    /** Agent认证令牌，节点Agent连接API时使用的唯一凭证 */
    agentToken: varchar("agent_token", { length: 64 }).notNull(),

    // ==================== 网络配置 ====================
    /** 宿主机公网IP地址，支持IPv4和IPv6 */
    publicIp: varchar("public_ip", { length: 45 }).notNull(),

    // ==================== 资源配置 ====================
    /** CPU总核心数，默认4核 */
    totalCpu: integer("total_cpu").default(4),

    /** 内存总容量(MB)，默认8192MB(8GB) */
    totalRamMb: integer("total_ram_mb").default(8192),

    // ==================== 状态监控 ====================
    /** 最后心跳时间，Agent定时上报，用于判断节点是否在线 */
    lastHeartbeat: timestamp("last_heartbeat"),

    /**
     * 节点状态
     * - 1: 在线（正常接收实例）
     * - 0: 离线/维护（不分配新实例）
     * @default 1
     */
    status: smallint("status").default(1),

    /**
     * 所属区域ID（逻辑外键，指向 regions 表）
     * 不设置数据库级外键约束，通过应用层维护关联关系
     */
    regionId: bigint("region_id", { mode: "number" }),

    // ==================== 审计字段 ====================
    /** 记录创建时间 */
    createdAt: timestamp("created_at").defaultNow(),

    /** 记录最后更新时间 */
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    // Agent Token 唯一索引，用于认证时快速查找节点
    uniqueIndex("idx_nodes_agent_token").on(table.agentToken),
    // 状态索引，加速筛选可用节点
    index("idx_nodes_status").on(table.status),
    // 区域ID索引，加速按区域筛选节点
    index("idx_nodes_region_id").on(table.regionId),
  ]
);

/** 节点表查询返回类型 (推断自表定义) */
export type Node = typeof nodes.$inferSelect;

/** 节点表插入数据类型 (推断自表定义) */
export type NewNode = typeof nodes.$inferInsert;
