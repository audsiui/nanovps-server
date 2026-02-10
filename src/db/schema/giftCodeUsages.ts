/**
 * 赠金码使用记录表 Schema 定义
 *
 * @file giftCodeUsages.ts
 * @description 记录赠金码的使用历史
 */
import {
  pgTable,
  bigserial,
  bigint,
  decimal,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

// ========== 表定义 ==========

export const giftCodeUsages = pgTable(
  "gift_code_usages",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),

    // ========== 关联字段 ==========
    /** 赠金码ID */
    giftCodeId: bigint("gift_code_id", { mode: "number" }).notNull(),
    /** 用户ID */
    userId: bigint("user_id", { mode: "number" }).notNull(),

    // ========== 金额信息 ==========
    /** 赠金金额 */
    amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),

    // ========== 审计字段 ==========
    /** 使用时间 */
    usedAt: timestamp("used_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    // 赠金码索引，用于统计使用次数
    idxGiftCodeUsageGiftCodeId: index("idx_gift_code_usage_gift_code_id").on(table.giftCodeId),
    // 用户索引，用于查询用户使用记录
    idxGiftCodeUsageUserId: index("idx_gift_code_usage_user_id").on(table.userId),
    // 使用时间索引，用于时间范围查询
    idxGiftCodeUsageUsedAt: index("idx_gift_code_usage_used_at").on(table.usedAt),
  })
);

/** 赠金码使用记录类型 */
export type GiftCodeUsage = typeof giftCodeUsages.$inferSelect;
/** 新建赠金码使用记录类型 */
export type NewGiftCodeUsage = typeof giftCodeUsages.$inferInsert;
