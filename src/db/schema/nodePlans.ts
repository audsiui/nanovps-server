/**
 * 节点套餐销售表 Schema 定义
 *
 * @file nodePlans.ts
 * @description 定义节点上可售套餐的数据库表结构，关联节点与套餐模板，管理库存、定价和售卖状态。
 */
import {
  pgTable,
  bigserial,
  bigint,
  integer,
  smallint,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";

/**
 * 付款周期配置项
 */
export interface BillingCycle {
  /** 周期标识: monthly(月付), quarterly(季付), halfYearly(半年付), yearly(年付) */
  cycle: "monthly" | "quarterly" | "halfYearly" | "yearly";
  /** 周期显示名称 */
  name: string;
  /** 周期月数 */
  months: number;
  /** 价格（元） */
  price: number;
  /** 是否启用该周期 */
  enabled: boolean;
  /** 排序权重，数字越小越靠前 */
  sortOrder: number;
}

/**
 * 节点套餐表 - 管理节点上可售的套餐配置
 *
 * 一张节点可以绑定多个套餐模板，每个组合就是一条 node_plans 记录
 */
export const nodePlans = pgTable("node_plans", {
  // ==================== 关联关系 ====================
  /** 节点套餐ID，自增主键 */
  id: bigserial("id", { mode: "number" }).primaryKey(),

  /**
   * 所属节点ID（逻辑外键，指向 nodes 表）
   * 不设置数据库级外键约束，通过应用层维护关联关系
   */
  nodeId: bigint("node_id", { mode: "number" }).notNull(),

  /**
   * 套餐模板ID（逻辑外键，指向 plan_templates 表）
   * 引用套餐模板的基础资源配置
   */
  planTemplateId: bigint("plan_template_id", { mode: "number" }).notNull(),

  // ==================== 库存管理 ====================
  /**
   * 库存数量
   * - 正整数: 剩余可售数量
   * - 0: 售罄
   * - -1: 无限库存（不限制）
   * @default -1
   */
  stock: integer("stock").default(-1),

  /** 已售数量统计，用于展示热门程度 */
  soldCount: integer("sold_count").default(0),

  // ==================== 定价配置 ====================
  /**
   * 付款周期配置
   * 使用 JSONB 存储灵活的周期定价，例如：
   * [
   *   { cycle: "monthly", name: "月付", months: 1, price: 29.9, enabled: true, sortOrder: 1 },
   *   { cycle: "yearly", name: "年付", months: 12, price: 299, enabled: true, sortOrder: 2 }
   * ]
   */
  billingCycles: jsonb("billing_cycles").$type<BillingCycle[]>().notNull(),

  // ==================== 售卖状态 ====================
  /**
   * 售卖状态
   * - 1: 上架（正常售卖）
   * - 0: 下架（暂停售卖）
   * @default 1
   */
  status: smallint("status").default(1),

  /**
   * 排序权重，数字越小越靠前展示
   * @default 0
   */
  sortOrder: smallint("sort_order").default(0),

  // ==================== 审计字段 ====================
  /** 记录创建时间 */
  createdAt: timestamp("created_at").defaultNow(),

  /** 记录最后更新时间 */
  updatedAt: timestamp("updated_at").defaultNow(),
});

/** 节点套餐表查询返回类型 (推断自表定义) */
export type NodePlan = typeof nodePlans.$inferSelect;

/** 节点套餐表插入数据类型 (推断自表定义) */
export type NewNodePlan = typeof nodePlans.$inferInsert;
