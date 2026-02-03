import type { SQL } from "bun";

export async function initUsersTable(sql: SQL) {
  // 创建 users 表
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      -- 1. 身份标识
      id              BIGSERIAL PRIMARY KEY,
      email           VARCHAR(255) NOT NULL,
      password_hash   VARCHAR(255) NOT NULL,

      -- 2. 财务核心
      balance         DECIMAL(19, 4) DEFAULT 0.0000,
      currency        VARCHAR(3) DEFAULT 'CNY',

      -- 3. 状态与权限
      role            VARCHAR(20) DEFAULT 'user',
      status          SMALLINT DEFAULT 1,

      -- 4. 扩展与风控
      api_key         VARCHAR(64),
      two_factor_auth VARCHAR(16),

      -- 5. 审计字段
      last_login_ip   INET,
      created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  // 创建唯一索引
  await sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE indexname = 'idx_users_email'
      ) THEN
        CREATE UNIQUE INDEX idx_users_email ON users(email);
      END IF;
    END $$;
  `;

  // 创建状态索引
  await sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE indexname = 'idx_users_status'
      ) THEN
        CREATE INDEX idx_users_status ON users(status);
      END IF;
    END $$;
  `;

  // 添加表和字段注释
  await sql`COMMENT ON TABLE users IS '用户表：存储平台注册用户的基本信息、财务数据和权限状态'`;
  await sql`COMMENT ON COLUMN users.id IS '用户唯一标识，自增主键'`;
  await sql`COMMENT ON COLUMN users.email IS '用户邮箱，用于登录和接收通知'`;
  await sql`COMMENT ON COLUMN users.password_hash IS '密码哈希值，使用 bcrypt 算法加密'`;
  await sql`COMMENT ON COLUMN users.balance IS '账户余额，支持4位小数'`;
  await sql`COMMENT ON COLUMN users.currency IS '货币类型，默认 CNY'`;
  await sql`COMMENT ON COLUMN users.role IS '用户角色：user(普通用户)、admin(管理员)'`;
  await sql`COMMENT ON COLUMN users.status IS '账户状态：1(正常)、0(禁用)'`;
  await sql`COMMENT ON COLUMN users.api_key IS 'API 访问密钥，用于程序化访问'`;
  await sql`COMMENT ON COLUMN users.two_factor_auth IS '双因素认证密钥'`;
  await sql`COMMENT ON COLUMN users.last_login_ip IS '最后一次登录的 IP 地址'`;
  await sql`COMMENT ON COLUMN users.created_at IS '账户创建时间'`;
  await sql`COMMENT ON COLUMN users.updated_at IS '账户信息最后更新时间'`;
}
