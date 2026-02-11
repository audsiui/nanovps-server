/**
 * Agent 上报数据 Redis 缓存服务
 *
 * @file report-cache.service.ts
 * @description 管理 Agent 上报数据的 Redis 缓存，包括实时数据和入库时间控制
 */
import { redis } from '../../db/redis';

/** Redis Key 前缀常量 */
const REDIS_KEYS = {
  /** 最新上报数据 */
  LATEST_REPORT: 'report:latest',
  /** 上次入库时间戳 */
  LAST_DB_TIME: 'report:lastDbTime',
} as const;

/** 入库间隔（毫秒）- 10 分钟 */
export const DB_SAVE_INTERVAL = 10 * 60 * 1000;

/**
 * 上报数据结构
 */
export interface AgentReport {
  type: 'report';
  data: {
    agentId: string;
    timestamp: number;
    host: {
      uptime: number;
      cpu: {
        cores: number;
        usagePercent: number;
      };
      memory: {
        total: number;
        used: number;
        usagePercent: number;
      };
      network: {
        rxRate: number;
        txRate: number;
        rxTotal: number;
        txTotal: number;
      };
      disks: Array<{
        fs: string;
        type: string;
        size: number;
        used: number;
        usePercent: number;
      }>;
    };
    containers: Array<{
      id: string;
      name: string;
      cpuPercent: number;
      memory: {
        usage: number;
        limit: number;
        usagePercent: number;
      };
      network: {
        rxRate: number;
        txRate: number;
        rxTotal: number;
        txTotal: number;
      };
    }>;
  };
}

/**
 * 保存最新上报数据到 Redis
 * 无条件更新，供前端实时读取
 */
export async function saveLatestReport(agentId: string, report: AgentReport): Promise<void> {
  try {
    const key = `${REDIS_KEYS.LATEST_REPORT}:${agentId}`;
    await redis.set(key, JSON.stringify(report), 'EX', 3600); // 1 小时过期
  } catch (error) {
    console.error(`[ReportCache] 保存最新上报数据失败 [agentId=${agentId}]:`, error);
    throw error;
  }
}

/**
 * 从 Redis 获取最新上报数据
 */
export async function getLatestReport(agentId: string): Promise<AgentReport | null> {
  try {
    const key = `${REDIS_KEYS.LATEST_REPORT}:${agentId}`;
    const data = await redis.get(key);
    if (data) {
      return JSON.parse(data) as AgentReport;
    }
    return null;
  } catch (error) {
    console.error(`[ReportCache] 获取最新上报数据失败 [agentId=${agentId}]:`, error);
    return null;
  }
}

/**
 * 获取上次入库时间戳
 * @returns 时间戳（毫秒），如果不存在返回 null
 */
export async function getLastDbTime(agentId: string): Promise<number | null> {
  try {
    const key = `${REDIS_KEYS.LAST_DB_TIME}:${agentId}`;
    const timestamp = await redis.get(key);
    if (timestamp) {
      return parseInt(timestamp, 10);
    }
    return null;
  } catch (error) {
    console.error(`[ReportCache] 获取上次入库时间失败 [agentId=${agentId}]:`, error);
    return null;
  }
}

/**
 * 设置上次入库时间戳
 */
export async function setLastDbTime(agentId: string, timestamp: number): Promise<void> {
  try {
    const key = `${REDIS_KEYS.LAST_DB_TIME}:${agentId}`;
    await redis.set(key, String(timestamp), 'EX', 86400); // 24 小时过期
  } catch (error) {
    console.error(`[ReportCache] 设置入库时间失败 [agentId=${agentId}]:`, error);
    throw error;
  }
}

/**
 * 判断是否需要保存到数据库
 * 逻辑：
 * - 从未写入过（lastDbTime 为 null）→ 需要保存
 * - 距离上次写入 >= 10 分钟 → 需要保存
 * - 距离上次写入 < 10 分钟 → 不需要保存
 */
export async function shouldSaveToDb(agentId: string, currentTimestamp: number): Promise<boolean> {
  const lastDbTime = await getLastDbTime(agentId);
  
  // 从未写入过
  if (lastDbTime === null) {
    console.log(`[ReportCache] [agentId=${agentId}] 首次上报，需要入库`);
    return true;
  }
  
  // 检查时间间隔
  const elapsed = currentTimestamp - lastDbTime;
  if (elapsed >= DB_SAVE_INTERVAL) {
    console.log(`[ReportCache] [agentId=${agentId}] 间隔 ${(elapsed / 1000 / 60).toFixed(1)} 分钟 >= 10 分钟，需要入库`);
    return true;
  }
  
  console.log(`[ReportCache] [agentId=${agentId}] 间隔 ${(elapsed / 1000 / 60).toFixed(1)} 分钟 < 10 分钟，跳过入库`);
  return false;
}

/**
 * 获取所有 Agent 的最新上报数据
 * 用于前端展示全量实时状态
 */
export async function getAllLatestReports(): Promise<Record<string, AgentReport>> {
  try {
    const pattern = `${REDIS_KEYS.LATEST_REPORT}:*`;
    const keys = [];
    
    // 使用 scan 遍历所有匹配的 key
    let cursor = '0';
    do {
      const result = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = result[0];
      keys.push(...result[1]);
    } while (cursor !== '0');
    
    const reports: Record<string, AgentReport> = {};
    
    for (const key of keys) {
      const data = await redis.get(key);
      if (data) {
        // 从 key 中提取 agentId: report:latest:{agentId}
        const agentId = key.split(':').pop()!;
        reports[agentId] = JSON.parse(data) as AgentReport;
      }
    }
    
    return reports;
  } catch (error) {
    console.error('[ReportCache] 获取所有最新上报数据失败:', error);
    return {};
  }
}
