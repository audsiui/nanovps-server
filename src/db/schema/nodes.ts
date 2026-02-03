import type { SQL } from "bun";

export async function initNodesTable(sql: SQL) {
  // 创建 nodes 表
  await sql`
    CREATE TABLE IF NOT EXISTS nodes (
      id              BIGSERIAL PRIMARY KEY,
      name            VARCHAR(50) NOT NULL,

      -- Agent 认证凭证
      agent_token     VARCHAR(64) NOT NULL UNIQUE,

      -- 宿主机公网 IP
      public_ip       VARCHAR(45) NOT NULL,

      -- NAT 端口范围配置
      nat_min_port    INT DEFAULT 10000,
      nat_max_port    INT DEFAULT 20000,

      -- 资源容量
      total_cpu       INT DEFAULT 4,
      total_ram_mb    INT DEFAULT 8192,

      -- 心跳监测
      last_heartbeat  TIMESTAMP,

      -- 机器状态 (1: 在线, 0: 离线/维护)
      status          SMALLINT DEFAULT 1,

      -- 审计字段
      created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  // 创建 agent_token 唯一索引
  await sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE indexname = 'idx_nodes_agent_token'
      ) THEN
        CREATE UNIQUE INDEX idx_nodes_agent_token ON nodes(agent_token);
      END IF;
    END $$;
  `;

  // 创建 status 索引（方便查询在线节点）
  await sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE indexname = 'idx_nodes_status'
      ) THEN
        CREATE INDEX idx_nodes_status ON nodes(status);
      END IF;
    END $$;
  `;
}
