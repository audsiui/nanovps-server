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

  // 添加表和字段注释
  await sql`COMMENT ON TABLE nodes IS '节点表：管理宿主机 VPS 节点的信息、资源和状态'`;
  await sql`COMMENT ON COLUMN nodes.id IS '节点唯一标识，自增主键'`;
  await sql`COMMENT ON COLUMN nodes.name IS '节点名称，用于展示和识别'`;
  await sql`COMMENT ON COLUMN nodes.agent_token IS 'Agent 认证令牌，节点上报数据时使用，需保密'`;
  await sql`COMMENT ON COLUMN nodes.public_ip IS '宿主机公网 IP 地址，用于生成用户访问地址'`;
  await sql`COMMENT ON COLUMN nodes.nat_min_port IS 'NAT 端口范围起始，默认 10000'`;
  await sql`COMMENT ON COLUMN nodes.nat_max_port IS 'NAT 端口范围结束，默认 20000'`;
  await sql`COMMENT ON COLUMN nodes.total_cpu IS '节点总 CPU 核数，默认 4 核'`;
  await sql`COMMENT ON COLUMN nodes.total_ram_mb IS '节点总内存大小(MB)，默认 8192(8G)'`;
  await sql`COMMENT ON COLUMN nodes.last_heartbeat IS '最后一次心跳时间，用于判断节点是否在线'`;
  await sql`COMMENT ON COLUMN nodes.status IS '节点状态：1(在线)、0(离线/维护)'`;
  await sql`COMMENT ON COLUMN nodes.created_at IS '节点记录创建时间'`;
  await sql`COMMENT ON COLUMN nodes.updated_at IS '节点信息最后更新时间'`;
}
