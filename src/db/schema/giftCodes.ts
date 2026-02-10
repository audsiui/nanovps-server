/**
 * 赠金码表 Schema 定义
 *
 * @file giftCodes.ts
 * @description 定义赠金码的数据库表结构，用于给用户账户余额赠送金额
 */
import {
  pgTable,
  bigserial,
  varchar,
  decimal,
  integer,
  timestamp,
  boolean,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

// ========== 表定义 ==========

export const giftCodes = pgTable(
  "gift_codes",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),

    // ========== 赠金码基本信息 ==========
    /** 赠金码字符串（唯一） */
    code: varchar("code", { length: 50 }).notNull(),
    /** 赠金码描述 */
    description: varchar("description", { length: 255 }),

    // ========== 赠金配置 ==========
    /** 赠金金额 */
    amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),

    // ========== 使用限制 ==========
    /** 总使用次数限制，null表示不限 */
    usageLimit: integer("usage_limit"),
    /** 已使用次数 */
    usageCount: integer("usage_count").default(0).notNull(),
    /** 每用户限制次数，默认1次 */
    perUserLimit: integer("per_user_limit").default(1).notNull(),

    // ========== 时间限制 ==========
    /** 生效时间，null表示立即生效 */
    startAt: timestamp("start_at", { mode: "date" }),
    /** 过期时间，null表示永不过期 */
    endAt: timestamp("end_at", { mode: "date" }),

    // ========== 状态 ==========
    /** 是否启用 */
    isActive: boolean("is_active").default(true).notNull(),

    // ========== 审计字段 ==========
    /** 创建时间 */
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    /** 更新时间 */
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    // 赠金码唯一索引
    idxGiftCode: uniqueIndex("idx_gift_code").on(table.code),
    // 状态索引，用于快速查询可用赠金码
    idxGiftCodeIsActive: index("idx_gift_code_is_active").on(table.isActive),
  })
);

/** 赠金码类型 */
export type GiftCode = typeof giftCodes.$inferSelect;
/** 新建赠金码类型 */
export type NewGiftCode = typeof giftCodes.$inferInsert;
