/**
 * 优惠码使用记录表 Schema 定义
 *
 * @file promoCodeUsages.ts
 * @description 记录优惠码的使用历史，包括购买实例和充值两种场景
 */
import {
  pgTable,
  bigserial,
  bigint,
  decimal,
  timestamp,
  varchar,
  index,
} from "drizzle-orm/pg-core";

// ========== 表定义 ==========

export const promoCodeUsages = pgTable(
  "promo_code_usages",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),

    // ========== 关联字段 ==========
    /** 优惠码ID */
    promoCodeId: bigint("promo_code_id", { mode: "number" }).notNull(),
    /** 用户ID */
    userId: bigint("user_id", { mode: "number" }).notNull(),
    /** 订单ID（购买实例时使用） */
    orderId: bigint("order_id", { mode: "number" }),

    // ========== 使用场景 ==========
    /** 使用场景: purchase */
    usageType: varchar("usage_type", { length: 20 }).notNull().default("purchase"),

    // ========== 金额信息 ==========
    /** 原始金额 */
    originalAmount: decimal("original_amount", { precision: 10, scale: 2 }).notNull(),
    /** 优惠金额 */
    discountAmount: decimal("discount_amount", { precision: 10, scale: 2 }).notNull(),
    /** 最终金额 */
    finalAmount: decimal("final_amount", { precision: 10, scale: 2 }).notNull(),

    // ========== 审计字段 ==========
    /** 使用时间 */
    usedAt: timestamp("used_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    // 优惠码索引，用于统计使用次数
    idxPromoCodeUsagePromoCodeId: index("idx_promo_code_usage_promo_code_id").on(table.promoCodeId),
    // 用户索引，用于查询用户使用记录
    idxPromoCodeUsageUserId: index("idx_promo_code_usage_user_id").on(table.userId),
    // 订单索引，用于查询订单使用的优惠码
    idxPromoCodeUsageOrderId: index("idx_promo_code_usage_order_id").on(table.orderId),
    // 使用时间索引，用于时间范围查询
    idxPromoCodeUsageUsedAt: index("idx_promo_code_usage_used_at").on(table.usedAt),
  })
);

/** 优惠码使用记录类型 */
export type PromoCodeUsage = typeof promoCodeUsages.$inferSelect;
/** 新建优惠码使用记录类型 */
export type NewPromoCodeUsage = typeof promoCodeUsages.$inferInsert;
