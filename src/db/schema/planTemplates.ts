/**
 * 套餐模板表 Schema 定义
 *
 * @file planTemplates.ts
 * @description 定义 VPS 套餐模板的数据库表结构，用于管理可预设的套餐配置。
 */
import {
  pgTable,
  bigserial,
  varchar,
  integer,
  timestamp,
  text,
} from "drizzle-orm/pg-core";

/**
 * 套餐模板表 - 存储 VPS 套餐模板配置信息
 */
export const planTemplates = pgTable("plan_templates", {
  // ==================== 基础信息 ====================
  /** 套餐模板唯一标识，自增主键 */
  id: bigserial("id", { mode: "number" }).primaryKey(),

  /** 套餐名称，如"入门版"、"标准版"、"高级版" */
  name: varchar("name", { length: 50 }).notNull(),

  /** 套餐备注/描述，用于说明套餐特点 */
  remark: text("remark"),

  // ==================== 资源配置 ====================
  /** CPU 核心数 */
  cpu: integer("cpu").notNull(),

  /** 内存大小 (MB) */
  ramMb: integer("ram_mb").notNull(),

  /** 硬盘大小 (GB) */
  diskGb: integer("disk_gb").notNull(),

  /** 月度流量限制 (GB)，null 表示不限流量 */
  trafficGb: integer("traffic_gb"),

  /** 带宽限制 (Mbps)，null 表示不限带宽 */
  bandwidthMbps: integer("bandwidth_mbps"),

  /** 端口数量限制，null 表示不限端口 */
  portCount: integer("port_count"),

  // ==================== 审计字段 ====================
  /** 记录创建时间 */
  createdAt: timestamp("created_at").defaultNow(),

  /** 记录最后更新时间 */
  updatedAt: timestamp("updated_at").defaultNow(),
});

/** 套餐模板表查询返回类型 (推断自表定义) */
export type PlanTemplate = typeof planTemplates.$inferSelect;

/** 套餐模板表插入数据类型 (推断自表定义) */
export type NewPlanTemplate = typeof planTemplates.$inferInsert;
