/**
 * NAT端口映射表 - NAT机器的端口转发管理
 *
 * 管理NAT网络下各实例的端口映射关系
 * 用户通过 节点IP:公网端口 访问实例服务
 */
import {
  bigserial,
  bigint,
  index,
  integer,
  pgEnum,
  pgTable,
  smallint,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

/** 协议类型 */
export const protocolEnum = pgEnum("protocol", ["tcp", "udp"]);

export const natPortMappings = pgTable(
  "nat_port_mappings",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),

    // ========== 关联字段 ==========
    /** 实例ID */
    instanceId: bigint("instance_id", { mode: "number" }).notNull(),
    /** 节点ID（宿主机） */
    nodeId: bigint("node_id", { mode: "number" }).notNull(),

    // ========== 端口映射配置 ==========
    /** 协议类型：tcp/udp */
    protocol: protocolEnum("protocol").notNull(),
    /** 内网端口（容器内部端口） */
    internalPort: integer("internal_port").notNull(),
    /** 公网端口（宿主机映射端口） */
    externalPort: integer("external_port").notNull(),

    // ========== 描述信息 ==========
    /** 描述/用途（用户可自定义，如"SSH","HTTP"） */
    description: varchar("description", { length: 50 }),

    // ========== 时间字段 ==========
    /** 创建时间 */
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    /** 更新时间 */
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    // 查询某实例的所有映射
    idxNatMappingsInstanceId: index("idx_nat_mappings_instance_id").on(
      table.instanceId
    ),
    // 查询某节点的所有映射
    idxNatMappingsNodeId: index("idx_nat_mappings_node_id").on(table.nodeId),
    // 查询某节点的某个公网端口（检查端口冲突）
    idxNatMappingsNodeExternalPort: index("idx_nat_mappings_node_external_port").on(
      table.nodeId,
      table.externalPort
    ),
  })
);

/** NAT端口映射类型 */
export type NatPortMapping = typeof natPortMappings.$inferSelect;
/** 新建NAT端口映射类型 */
export type NewNatPortMapping = typeof natPortMappings.$inferInsert;
