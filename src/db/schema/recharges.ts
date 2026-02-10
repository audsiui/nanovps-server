/**
 * 充值记录表 Schema 定义
 *
 * @file recharges.ts
 * @description 定义用户充值记录的数据库表结构
 */
import {
  pgTable,
  bigserial,
  bigint,
  decimal,
  varchar,
  timestamp,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";

// ========== 枚举定义 ==========

/** 充值状态 */
export const rechargeStatusEnum = pgEnum("recharge_status", [
  "pending",   // 待支付
  "paid",      // 已支付
  "cancelled", // 已取消
  "failed",    // 失败
]);

/** 支付渠道 */
export const rechargeChannelEnum = pgEnum("recharge_channel", [
  "alipay",
  "wechat",
  "stripe",
  "paypal",
]);

// ========== 表定义 ==========

export const recharges = pgTable(
  "recharges",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),

    // ========== 充值单号 ==========
    /** 充值单号（唯一） */
    rechargeNo: varchar("recharge_no", { length: 32 }).notNull().unique(),

    // ========== 关联字段 ==========
    /** 用户ID */
    userId: bigint("user_id", { mode: "number" }).notNull(),

    // ========== 金额信息 ==========
    /** 充值金额 */
    amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
    /** 赠送金额（优惠码抵扣或其他赠送） */
    bonusAmount: decimal("bonus_amount", { precision: 10, scale: 2 }).default("0"),
    /** 实际到账金额 */
    finalAmount: decimal("final_amount", { precision: 10, scale: 2 }).notNull(),

    // ========== 支付信息 ==========
    /** 充值状态 */
    status: rechargeStatusEnum("status").default("pending").notNull(),
    /** 支付渠道 */
    channel: rechargeChannelEnum("channel"),
    /** 支付时间 */
    paidAt: timestamp("paid_at", { mode: "date" }),
    /** 第三方支付流水号 */
    tradeNo: varchar("trade_no", { length: 128 }),

    // ========== 审计字段 ==========
    /** 创建时间 */
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    /** 更新时间 */
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    idxRechargesUserId: index("idx_recharges_user_id").on(table.userId),
    idxRechargesStatus: index("idx_recharges_status").on(table.status),
    idxRechargesCreatedAt: index("idx_recharges_created_at").on(table.createdAt),
  })
);

/** 充值记录类型 */
export type Recharge = typeof recharges.$inferSelect;
/** 新建充值记录类型 */
export type NewRecharge = typeof recharges.$inferInsert;
