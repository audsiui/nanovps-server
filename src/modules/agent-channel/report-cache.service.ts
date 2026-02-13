/**
 * Agent 上报数据 Redis 缓存服务
 *
 * @file report-cache.service.ts
 * @description 管理 Agent 上报数据的 Redis 缓存，支持 Host 和 Containers 分开存储
 */
import { redis } from '../../db/redis';

/** Redis Key 前缀常量 */
const REDIS_KEYS = {
  /** 主机最新数据 */
  HOST_LATEST: 'report:host:latest',
  /** 容器最新数据 */
  CONTAINER_LATEST: 'report:container:latest',
  /** 容器列表（存储某 Agent 下的所有容器 ID） */
  CONTAINERS_LIST: 'report:containers:list',
  /** 上次入库时间戳 */
  LAST_DB_TIME: 'report:lastDbTime',
} as const;

/** 入库间隔（毫秒）- 10 分钟 */
export const DB_SAVE_INTERVAL = 10 * 60 * 1000;

/**
 * Host 数据结构
 */
export interface HostData {
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
}

/**
 * Container 数据结构
 */
export interface ContainerData {
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
}

/**
 * 完整上报数据结构
 */
export interface AgentReport {
  type: 'report';
  data: {
    agentId: string;
    timestamp: number;
    host: HostData;
    containers: ContainerData[];
  };
}

// ==================== Host 相关操作 ====================

/**
 * 保存主机最新数据到 Redis
 */
export async function saveHostLatest(agentId: string, timestamp: number, host: HostData): Promise<void> {
  try {
    const key = `${REDIS_KEYS.HOST_LATEST}:${agentId}`;
    const data = {
      timestamp,
      ...host,
    };
    await redis.set(key, JSON.stringify(data), 'EX', 3600); // 1 小时过期
  } catch (error) {
    console.error(`[ReportCache] 保存主机数据失败 [agentId=${agentId}]:`, error);
    throw error;
  }
}

/**
 * 从 Redis 获取主机最新数据
 */
export async function getHostLatest(agentId: string): Promise<(HostData & { timestamp: number }) | null> {
  try {
    const key = `${REDIS_KEYS.HOST_LATEST}:${agentId}`;
    const data = await redis.get(key);
    if (data) {
      return JSON.parse(data) as HostData & { timestamp: number };
    }
    return null;
  } catch (error) {
    console.error(`[ReportCache] 获取主机数据失败 [agentId=${agentId}]:`, error);
    return null;
  }
}

// ==================== Container 相关操作 ====================

/**
 * 保存单个容器最新数据到 Redis
 */
export async function saveContainerLatest(
  agentId: string,
  containerId: string,
  timestamp: number,
  container: ContainerData
): Promise<void> {
  try {
    const key = `${REDIS_KEYS.CONTAINER_LATEST}:${agentId}:${containerId}`;
    const data = {
      timestamp,
      ...container,
    };
    await redis.set(key, JSON.stringify(data), 'EX', 3600); // 1 小时过期
  } catch (error) {
    console.error(`[ReportCache] 保存容器数据失败 [agentId=${agentId}, containerId=${containerId}]:`, error);
    throw error;
  }
}

/**
 * 从 Redis 获取单个容器最新数据
 */
export async function getContainerLatest(
  agentId: string,
  containerId: string
): Promise<(ContainerData & { timestamp: number }) | null> {
  try {
    const key = `${REDIS_KEYS.CONTAINER_LATEST}:${agentId}:${containerId}`;
    const data = await redis.get(key);
    if (data) {
      return JSON.parse(data) as ContainerData & { timestamp: number };
    }
    return null;
  } catch (error) {
    console.error(`[ReportCache] 获取容器数据失败 [agentId=${agentId}, containerId=${containerId}]:`, error);
    return null;
  }
}

/**
 * 更新容器列表（保存某 Agent 下的所有容器 ID）
 */
export async function updateContainersList(agentId: string, containerIds: string[]): Promise<void> {
  try {
    const key = `${REDIS_KEYS.CONTAINERS_LIST}:${agentId}`;
    await redis.set(key, JSON.stringify(containerIds), 'EX', 3600);
  } catch (error) {
    console.error(`[ReportCache] 更新容器列表失败 [agentId=${agentId}]:`, error);
    throw error;
  }
}

/**
 * 获取容器列表
 */
export async function getContainersList(agentId: string): Promise<string[]> {
  try {
    const key = `${REDIS_KEYS.CONTAINERS_LIST}:${agentId}`;
    const data = await redis.get(key);
    if (data) {
      return JSON.parse(data) as string[];
    }
    return [];
  } catch (error) {
    console.error(`[ReportCache] 获取容器列表失败 [agentId=${agentId}]:`, error);
    return [];
  }
}

/**
 * 获取某 Agent 下的所有容器最新数据
 */
export async function getAllContainersLatest(
  agentId: string
): Promise<Record<string, ContainerData & { timestamp: number }>> {
  try {
    const containerIds = await getContainersList(agentId);
    const containers: Record<string, ContainerData & { timestamp: number }> = {};

    for (const containerId of containerIds) {
      const container = await getContainerLatest(agentId, containerId);
      if (container) {
        containers[containerId] = container;
      }
    }

    return containers;
  } catch (error) {
    console.error(`[ReportCache] 获取所有容器数据失败 [agentId=${agentId}]:`, error);
    return {};
  }
}

/**
 * 获取某 Agent 下的所有数据（Host + Containers）
 */
export async function getAgentFullData(agentId: string): Promise<{
  host: (HostData & { timestamp: number }) | null;
  containers: Record<string, ContainerData & { timestamp: number }>;
}> {
  const [host, containers] = await Promise.all([
    getHostLatest(agentId),
    getAllContainersLatest(agentId),
  ]);

  return { host, containers };
}

// ==================== 批量查询操作 ====================

/**
 * 获取所有 Agent 的主机数据
 */
export async function getAllHostsLatest(): Promise<Record<string, HostData & { timestamp: number }>> {
  try {
    const pattern = `${REDIS_KEYS.HOST_LATEST}:*`;
    const keys: string[] = [];

    // 使用 scan 遍历所有匹配的 key
    let cursor = '0';
    do {
      const result = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = result[0];
      keys.push(...result[1]);
    } while (cursor !== '0');

    const hosts: Record<string, HostData & { timestamp: number }> = {};

    for (const key of keys) {
      const data = await redis.get(key);
      if (data) {
        // 从 key 中提取 agentId: report:host:latest:{agentId}
        const agentId = key.split(':').pop()!;
        hosts[agentId] = JSON.parse(data) as HostData & { timestamp: number };
      }
    }

    return hosts;
  } catch (error) {
    console.error('[ReportCache] 获取所有主机数据失败:', error);
    return {};
  }
}

/**
 * 获取所有容器数据（跨所有 Agent）
 */
export async function getAllContainersGlobal(): Promise<
  Record<string, Record<string, ContainerData & { timestamp: number }>>
> {
  try {
    const pattern = `${REDIS_KEYS.CONTAINER_LATEST}:*`;
    const keys: string[] = [];

    // 使用 scan 遍历所有匹配的 key
    let cursor = '0';
    do {
      const result = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = result[0];
      keys.push(...result[1]);
    } while (cursor !== '0');

    const result: Record<string, Record<string, ContainerData & { timestamp: number }>> = {};

    for (const key of keys) {
      const data = await redis.get(key);
      if (data) {
        // 从 key 中提取: report:container:latest:{agentId}:{containerId}
        const parts = key.split(':');
        const agentId = parts[parts.length - 2];
        const containerId = parts[parts.length - 1];

        if (!result[agentId]) {
          result[agentId] = {};
        }
        result[agentId][containerId] = JSON.parse(data) as ContainerData & { timestamp: number };
      }
    }

    return result;
  } catch (error) {
    console.error('[ReportCache] 获取所有容器数据失败:', error);
    return {};
  }
}

// ==================== 入库控制相关（保持不变） ====================

/**
 * 获取上次入库时间戳
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
    console.log(
      `[ReportCache] [agentId=${agentId}] 间隔 ${(elapsed / 1000 / 60).toFixed(1)} 分钟 >= 10 分钟，需要入库`
    );
    return true;
  }

  console.log(`[ReportCache] [agentId=${agentId}] 间隔 ${(elapsed / 1000 / 60).toFixed(1)} 分钟 < 10 分钟，跳过入库`);
  return false;
}

// ==================== 兼容旧接口（保存完整上报数据） ====================

/**
 * 保存完整上报数据到 Redis（分开存储 Host 和 Containers）
 */
export async function saveLatestReport(agentId: string, report: AgentReport): Promise<void> {
  try {
    const { timestamp, host, containers } = report.data;

    // 1. 保存主机数据
    await saveHostLatest(agentId, timestamp, host);

    // 2. 保存每个容器数据
    const containerIds: string[] = [];
    for (const container of containers) {
      await saveContainerLatest(agentId, container.id, timestamp, container);
      containerIds.push(container.id);
    }

    // 3. 更新容器列表
    await updateContainersList(agentId, containerIds);

    console.log(`[ReportCache] 数据已保存 [agentId=${agentId}, containers=${containers.length}]`);
  } catch (error) {
    console.error(`[ReportCache] 保存上报数据失败 [agentId=${agentId}]:`, error);
    throw error;
  }
}

/**
 * 获取完整上报数据（从分开存储的数据组装）
 */
export async function getLatestReport(agentId: string): Promise<AgentReport | null> {
  try {
    const { host, containers } = await getAgentFullData(agentId);

    if (!host) {
      return null;
    }

    // 组装成原始格式
    const containerList = Object.values(containers);

    return {
      type: 'report',
      data: {
        agentId,
        timestamp: host.timestamp,
        host: {
          uptime: host.uptime,
          cpu: host.cpu,
          memory: host.memory,
          network: host.network,
          disks: host.disks,
        },
        containers: containerList.map((c) => ({
          id: c.id,
          name: c.name,
          cpuPercent: c.cpuPercent,
          memory: c.memory,
          network: c.network,
        })),
      },
    };
  } catch (error) {
    console.error(`[ReportCache] 获取完整上报数据失败 [agentId=${agentId}]:`, error);
    return null;
  }
}

/**
 * 获取所有 Agent 的最新上报数据
 */
export async function getAllLatestReports(): Promise<Record<string, AgentReport>> {
  try {
    const hosts = await getAllHostsLatest();
    const allContainers = await getAllContainersGlobal();

    const reports: Record<string, AgentReport> = {};

    for (const agentId in hosts) {
      const host = hosts[agentId];
      const containers = allContainers[agentId] || {};
      const containerList = Object.values(containers);

      reports[agentId] = {
        type: 'report',
        data: {
          agentId,
          timestamp: host.timestamp,
          host: {
            uptime: host.uptime,
            cpu: host.cpu,
            memory: host.memory,
            network: host.network,
            disks: host.disks,
          },
          containers: containerList.map((c) => ({
            id: c.id,
            name: c.name,
            cpuPercent: c.cpuPercent,
            memory: c.memory,
            network: c.network,
          })),
        },
      };
    }

    return reports;
  } catch (error) {
    console.error('[ReportCache] 获取所有上报数据失败:', error);
    return {};
  }
}
