/**
 * 用户表 Schema 定义
 *
 * @file users.ts
 * @description 定义平台用户的数据库表结构，包含身份认证、财务管理、权限控制和审计日志等字段。
 */
import {
  pgTable,
  bigserial,
  varchar,
  decimal,
  smallint,
  timestamp,
  inet,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

/**
 * 用户表 - 存储平台用户信息，包含身份、财务、权限、风控等核心字段
 */
export const users = pgTable(
  "users",
  {
    // ==================== 1. 身份标识 ====================
    /** 用户唯一标识，自增主键 */
    id: bigserial("id", { mode: "number" }).primaryKey(),

    /** 邮箱地址，用于登录和通知 */
    email: varchar("email", { length: 255 }).notNull(),

    /** 密码哈希值，bcrypt加密存储 */
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),

    // ==================== 2. 财务核心 ====================
    /**
     * 账户余额
     * - 精度：19位总长度，4位小数
     * - 默认：0.0000
     */
    balance: decimal("balance", { precision: 19, scale: 4 }).default("0.0000"),

    /**
     * 结算货币
     * - ISO 4217格式，如 CNY/USD
     * - 默认：CNY
     */
    currency: varchar("currency", { length: 3 }).default("CNY"),

    // ==================== 3. 状态与权限 ====================
    /**
     * 用户角色
     * - user: 普通用户
     * - admin: 管理员
     * @default "user"
     */
    role: varchar("role", { length: 20 }).default("user"),

    /**
     * 用户状态
     * - 1: 正常
     * - 0: 未验证
     * - 2: 封禁
     * @default 1
     */
    status: smallint("status").default(1),

    // ==================== 4. 扩展与风控 ====================
    /** API访问密钥，用于程序化接口调用 */
    apiKey: varchar("api_key", { length: 64 }),

    /** 双因素认证密钥，TOTP种子 */
    twoFactorAuth: varchar("two_factor_auth", { length: 16 }),

    // ==================== 5. 审计字段 ====================
    /** 上次登录IP地址 */
    lastLoginIp: inet("last_login_ip"),

    /** 记录创建时间 */
    createdAt: timestamp("created_at").defaultNow(),

    /** 记录最后更新时间 */
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    // 邮箱唯一索引，加速登录查询
    uniqueIndex("idx_users_email").on(table.email),
    // 状态索引，加速按状态筛选用户
    index("idx_users_status").on(table.status),
  ]
);

/** 用户表查询返回类型 (推断自表定义) */
export type User = typeof users.$inferSelect;

/** 用户表插入数据类型 (推断自表定义) */
export type NewUser = typeof users.$inferInsert;
