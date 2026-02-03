/**
 * 数据库入口文件
 *
 * 负责创建 PostgreSQL 连接池并初始化 Drizzle ORM 实例。
 * 所有数据库操作都应从此文件导入 db 实例。
 *
 * 环境变量依赖:
 *   - DATABASE_URL: PostgreSQL 连接字符串
 *
 * 使用示例:
 *   import { db, schema } from "@/db";
 *   const users = await db.select().from(schema.users);
 */
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

/** PostgreSQL 连接池实例 */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/** Drizzle ORM 数据库操作实例 */
export const db = drizzle(pool, { schema });

// 导出 schema 供其他地方使用
export { schema };
export * from "./schema";
