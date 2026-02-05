/**
 * 订单表 - VPS 订单管理
 *
 * 管理用户购买、续费、升级等所有交易订单
 */
import {
  bigserial,
  bigint,
  decimal,
  index,
  integer,
  pgEnum,
  pgTable,
  smallint,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

// ========== 枚举定义 ==========

/** 订单类型 */
export const orderTypeEnum = pgEnum("order_type", [
  "new", // 新购
  "renew", // 续费
  "upgrade", // 升级套餐
]);

/** 订单状态 */
export const orderStatusEnum = pgEnum("order_status", [
  "pending", // 待支付
  "paid", // 已支付
  "processing", // 处理中
  "completed", // 已完成
  "failed", // 处理失败
  "cancelled", // 已取消
  "refunded", // 已退款
]);

/** 支付渠道 */
export const paymentChannelEnum = pgEnum("payment_channel", [
  "alipay",
  "wechat",
  "stripe",
  "paypal",
  "balance", // 余额支付
]);

// ========== 表定义 ==========

export const orders = pgTable(
  "orders",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),

    // ========== 订单标识 ==========
    /** 订单号（对外展示，唯一） */
    orderNo: varchar("order_no", { length: 32 }).notNull().unique(),

    // ========== 关联字段 ==========
    /** 用户ID */
    userId: bigint("user_id", { mode: "number" }).notNull(),
    /** 实例ID（续费/升级时关联） */
    instanceId: bigint("instance_id", { mode: "number" }),
    /** 节点套餐ID */
    nodePlanId: bigint("node_plan_id", { mode: "number" }).notNull(),

    // ========== 订单类型和状态 ==========
    /** 订单类型 */
    type: orderTypeEnum("type").notNull(),
    /** 订单状态 */
    status: orderStatusEnum("status").default("pending").notNull(),

    // ========== 周期信息 ==========
    /** 计费周期：monthly/quarterly/halfYearly/yearly */
    billingCycle: varchar("billing_cycle", { length: 20 }).notNull(),
    /** 购买月数 */
    durationMonths: integer("duration_months").notNull(),

    // ========== 金额信息 ==========
    /** 原价 */
    originalPrice: decimal("original_price", { precision: 19, scale: 4 }).notNull(),
    /** 优惠金额 */
    discountAmount: decimal("discount_amount", { precision: 19, scale: 4 }).default("0"),
    /** 最终支付金额 */
    finalPrice: decimal("final_price", { precision: 19, scale: 4 }).notNull(),

    // ========== 支付信息 ==========
    /** 支付渠道 */
    paymentChannel: paymentChannelEnum("payment_channel"),
    /** 支付时间 */
    paidAt: timestamp("paid_at", { mode: "date" }),
    /** 第三方支付流水号 */
    paymentTradeNo: varchar("payment_trade_no", { length: 128 }),

    // ========== 服务周期（订单完成后写入） ==========
    /** 服务开始时间 */
    periodStartAt: timestamp("period_start_at", { mode: "date" }),
    /** 服务结束时间 */
    periodEndAt: timestamp("period_end_at", { mode: "date" }),

    // ========== 备注 ==========
    /** 备注/失败原因 */
    remark: varchar("remark", { length: 255 }),

    // ========== 时间字段 ==========
    /** 创建时间 */
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    /** 更新时间 */
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    idxOrdersUserId: index("idx_orders_user_id").on(table.userId),
    idxOrdersStatus: index("idx_orders_status").on(table.status),
    idxOrdersInstanceId: index("idx_orders_instance_id").on(table.instanceId),
    idxOrdersCreatedAt: index("idx_orders_created_at").on(table.createdAt),
    idxOrdersPaidAt: index("idx_orders_paid_at").on(table.paidAt),
  })
);

/** 订单类型 */
export type Order = typeof orders.$inferSelect;
/** 新建订单类型 */
export type NewOrder = typeof orders.$inferInsert;
