/**
 * 镜像表 Schema 定义
 *
 * @file images.ts
 * @description 定义 VPS 镜像的数据库表结构，用于管理不同操作系统镜像的展示信息和启动参数
 */
import {
  pgTable,
  bigserial,
  varchar,
  boolean,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * 镜像表 - 存储 VPS 操作系统镜像信息
 */
export const images = pgTable(
  "images",
  {
    // ==================== 基础信息 ====================
    /** 镜像唯一标识，自增主键 */
    id: bigserial("id", { mode: "number" }).primaryKey(),

    /**
     * 显示名称
     * e.g., "Ubuntu 22.04 LTS"
     */
    name: varchar("name", { length: 50 }).notNull(),

    /**
     * 镜像家族（用于显示图标）
     * e.g., "ubuntu", "centos", "alpine", "debian"
     * @default "linux"
     */
    family: varchar("family", { length: 20 }).default("linux"),

    /**
     * 镜像简介
     * e.g., "适合新手的通用 Linux 发行版"
     */
    description: varchar("description", { length: 255 }),

    // ==================== 启动参数 ====================
    /**
     * 镜像拉取地址
     * e.g., "docker.io/library/ubuntu:22.04"
     */
    imageRef: varchar("image_ref", { length: 255 }).notNull(),

    // ==================== 状态控制 ====================
    /**
     * 是否启用
     * 控制该镜像是否在前端展示和可用
     * @default true
     */
    isActive: boolean("is_active").default(true),
  },
  (table) => [
    // image_ref 唯一索引，确保镜像地址不重复
    uniqueIndex("idx_images_image_ref").on(table.imageRef),
  ]
);

/** 镜像表查询返回类型 (推断自表定义) */
export type Image = typeof images.$inferSelect;

/** 镜像表插入数据类型 (推断自表定义) */
export type NewImage = typeof images.$inferInsert;
