/**
 * 实例表 - VPS 实例管理
 *
 * 存储用户购买的 VPS 实例信息，包含资源配置、网络配置、状态等
 */
import {
  bigserial,
  bigint,
  boolean,
  index,
  integer,
  pgTable,
  smallint,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

export const instances = pgTable(
  "instances",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),

    // ========== 关联字段 ==========
    /** 用户ID */
    userId: bigint("user_id", { mode: "number" }).notNull(),
    /** 节点ID */
    nodeId: bigint("node_id", { mode: "number" }).notNull(),
    /** 节点套餐ID */
    nodePlanId: bigint("node_plan_id", { mode: "number" }).notNull(),
    /** 系统镜像ID */
    imageId: bigint("image_id", { mode: "number" }).notNull(),

    // ========== 实例标识 ==========
    /** 实例名称（用户自定义） */
    name: varchar("name", { length: 50 }).notNull(),
    /** 系统主机名 */
    hostname: varchar("hostname", { length: 50 }),

    // ========== 资源配置（从套餐复制，防止套餐变更影响现有实例） ==========
    /** CPU核心数 */
    cpu: integer("cpu").notNull(),
    /** 内存大小（MB） */
    ramMb: integer("ram_mb").notNull(),
    /** 磁盘大小（GB） */
    diskGb: integer("disk_gb").notNull(),
    /** 月流量限制（GB），null=不限流量 */
    trafficGb: integer("traffic_gb"),
    /** 带宽限制（Mbps），null=不限带宽 */
    bandwidthMbps: integer("bandwidth_mbps"),

    // ========== 网络配置（NAT机器，不分配独立IP） ==========
    /** 内网IP地址（容器内部IP，如 10.89.0.x） */
    internalIp: varchar("internal_ip", { length: 15 }),
    /** SSH 端口（公式：10000 + 实例ID） */
    sshPort: integer("ssh_port"),

    // ========== 状态管理 ==========
    /**
     * 实例状态：
     * 0=创建中, 1=运行中, 2=已停止, 3=暂停,
     * 4=异常, 5=销毁中, 6=已销毁
     */
    status: smallint("status").default(0).notNull(),

    // ========== 容器信息 ==========
    /** 容器/虚拟机ID（由agent创建后回填） */
    containerId: varchar("container_id", { length: 64 }),

    // ========== 时间字段 ==========
    /** 创建时间 */
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    /** 更新时间 */
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
    /** 到期时间 */
    expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
    /** 最后启动时间 */
    lastStartedAt: timestamp("last_started_at", { mode: "date" }),
    /** 销毁时间 */
    destroyedAt: timestamp("destroyed_at", { mode: "date" }),

    // ========== 自动续费 ==========
    /** 是否自动续费 */
    autoRenew: boolean("auto_renew").default(false),
  },
  (table) => ({
    idxInstancesUserId: index("idx_instances_user_id").on(table.userId),
    idxInstancesNodeId: index("idx_instances_node_id").on(table.nodeId),
    idxInstancesStatus: index("idx_instances_status").on(table.status),
    idxInstancesExpiresAt: index("idx_instances_expires_at").on(table.expiresAt),
    idxInstancesInternalIp: index("idx_instances_internal_ip").on(table.internalIp),
    idxInstancesContainerId: index("idx_instances_container_id").on(
      table.containerId
    ),
  })
);

/** 实例类型 */
export type Instance = typeof instances.$inferSelect;
/** 新建实例类型 */
export type NewInstance = typeof instances.$inferInsert;
