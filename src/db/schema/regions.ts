/**
 * 区域表 Schema 定义
 *
 * @file regions.ts
 * @description 定义服务器区域的数据库表结构，用于管理不同地理区域的展示、排序和状态控制。
 */
import {
  pgTable,
  bigserial,
  varchar,
  integer,
  boolean,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * 区域表 - 存储服务器区域信息，包含区域名称、代码、排序和状态
 */
export const regions = pgTable(
  "regions",
  {
    // ==================== 基础信息 ====================
    /** 区域唯一标识，自增主键 */
    id: bigserial("id", { mode: "number" }).primaryKey(),

    /**
     * 区域名称（展示用）
     * e.g., "中国香港 (CN2 GIA)", "美国洛杉矶 (9929)"
     */
    name: varchar("name", { length: 100 }).notNull(),

    /**
     * 区域代号（逻辑用/图标用）
     * e.g., "hk", "us-la", "sg", "jp", "de"
     * 前端可用此 code 查找对应国旗图片: /assets/flags/hk.png
     */
    code: varchar("code", { length: 20 }).notNull(),

    // ==================== 排序与控制 ====================
    /**
     * 排序权重
     * 数字越小排序越靠前，用于控制前端展示顺序
     * @default 0
     */
    sortOrder: integer("sort_order").default(0),

    /**
     * 是否启用
     * 控制该区域是否在前端展示和可用
     * @default true
     */
    isActive: boolean("is_active").default(true),
  },
  (table) => [
    // code 唯一索引，确保区域代号不重复
    uniqueIndex("idx_regions_code").on(table.code),
  ]
);

/** 区域表查询返回类型 (推断自表定义) */
export type Region = typeof regions.$inferSelect;

/** 区域表插入数据类型 (推断自表定义) */
export type NewRegion = typeof regions.$inferInsert;
