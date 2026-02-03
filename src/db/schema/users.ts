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
}
