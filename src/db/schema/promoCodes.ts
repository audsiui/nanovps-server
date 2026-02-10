/**
 * 优惠码表 Schema 定义
 *
 * @file promoCodes.ts
 * @description 定义优惠码的数据库表结构，支持固定金额和百分比折扣
 */
import {
  pgTable,
  bigserial,
  varchar,
  decimal,
  integer,
  timestamp,
  boolean,
  pgEnum,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

// ========== 枚举定义 ==========

/** 优惠码折扣类型 */
export const promoCodeTypeEnum = pgEnum("promo_code_type", [
  "fixed",      // 固定金额优惠
  "percentage", // 百分比优惠
]);

/** 优惠码使用场景 */
export const promoCodeUsageTypeEnum = pgEnum("promo_code_usage_type", [
  "purchase",  // 仅购买实例可用
  "recharge",  // 仅充值可用
  "both",      // 两者都可用
]);

// ========== 表定义 ==========

export const promoCodes = pgTable(
  "promo_codes",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),

    // ========== 优惠码基本信息 ==========
    /** 优惠码字符串（唯一） */
    code: varchar("code", { length: 50 }).notNull(),
    /** 优惠码描述 */
    description: varchar("description", { length: 255 }),

    // ========== 折扣配置 ==========
    /** 折扣类型: fixed(固定金额) | percentage(百分比) */
    type: promoCodeTypeEnum("type").notNull(),
    /** 优惠值（固定金额时直接减，百分比时为0-100） */
    value: decimal("value", { precision: 10, scale: 2 }).notNull(),
    /** 最小使用金额限制（订单金额需大于此值才能使用） */
    minAmount: decimal("min_amount", { precision: 10, scale: 2 }),
    /** 最大优惠金额限制（仅percentage类型有效） */
    maxDiscount: decimal("max_discount", { precision: 10, scale: 2 }),

    // ========== 使用范围 ==========
    /** 使用场景: purchase(购买) | recharge(充值) | both(两者) */
    usageType: promoCodeUsageTypeEnum("usage_type").notNull().default("both"),

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
    // 优惠码唯一索引
    idxPromoCode: uniqueIndex("idx_promo_code").on(table.code),
    // 状态索引，用于快速查询可用优惠码
    idxPromoCodeIsActive: index("idx_promo_code_is_active").on(table.isActive),
    // 使用场景索引
    idxPromoCodeUsageType: index("idx_promo_code_usage_type").on(table.usageType),
  })
);

/** 优惠码类型 */
export type PromoCode = typeof promoCodes.$inferSelect;
/** 新建优惠码类型 */
export type NewPromoCode = typeof promoCodes.$inferInsert;
