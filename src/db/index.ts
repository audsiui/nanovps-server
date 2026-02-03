import { SQL } from "bun";
import { initUsersTable, initNodesTable } from "./schema";

let connectedCount = 0;
let closedCount = 0;

// PostgreSQL 连接配置
export const sql = new SQL({
  hostname: "localhost",
  port: 5432,
  database: "nanovps-server",
  username: "postgres",
  password: "yshinu144",
  max: 5,                    // 减少连接数，一般 5 个足够
  idleTimeout: 600,          // 空闲 10 分钟后关闭（避免频繁重连）
  connectionTimeout: 30,
  onconnect: () => {
    connectedCount++;
    if (connectedCount === 1) {
      console.log("✅ Connected to PostgreSQL");
    }
  },
  onclose: () => {
    closedCount++;
    if (closedCount === connectedCount) {
      console.log("❌ PostgreSQL connections closed");
    }
  },
});

// 初始化数据库表
export async function initDatabase() {
  try {
    await initUsersTable(sql);
    await initNodesTable(sql);

    console.log("✅ Database initialized successfully");
  } catch (error) {
    console.error("❌ Database initialization failed:", error);
    throw error;
  }
}
