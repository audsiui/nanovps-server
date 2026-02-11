/**
 * 节点 Redis 缓存服务
 *
 * @file node-cache.service.ts
 * @description 管理节点数据在 Redis 中的缓存，支持全量加载和增量刷新
 */
import { redis } from '../../db/redis';
import { findAll, findById } from './node.repository';
import type { Node } from '../../db/schema/nodes';

/** Redis 键名常量 */
const REDIS_KEYS = {
  /** 所有节点列表的哈希表 */
  NODES_HASH: 'nodes:all',
  /** 节点缓存状态标记 */
  NODES_CACHE_READY: 'nodes:cache:ready',
} as const;

/**
 * 初始化节点缓存
 * 服务启动时调用，将所有节点数据加载到 Redis
 */
export async function initNodeCache(): Promise<void> {
  try {
    console.log('[NodeCache] 开始加载节点数据到 Redis...');

    // 清空旧缓存
    await redis.del(REDIS_KEYS.NODES_HASH);
    await redis.del(REDIS_KEYS.NODES_CACHE_READY);

    // 从数据库加载所有节点
    const { list: nodes } = await findAll({ page: 1, pageSize: 10000 });

    if (nodes.length === 0) {
      console.log('[NodeCache] 数据库中没有节点数据');
      await redis.set(REDIS_KEYS.NODES_CACHE_READY, 'true');
      return;
    }

    // 构建哈希表数据
    const hashData: Record<string, string> = {};
    for (const node of nodes) {
      hashData[String(node.id)] = JSON.stringify(node);
    }

    // 批量写入 Redis
    await redis.hmset(REDIS_KEYS.NODES_HASH, hashData);
    await redis.set(REDIS_KEYS.NODES_CACHE_READY, 'true');

    console.log(`[NodeCache] 成功加载 ${nodes.length} 个节点到 Redis`);
  } catch (error) {
    console.error('[NodeCache] 初始化节点缓存失败:', error);
    throw error;
  }
}

/**
 * 刷新单个节点缓存
 * 新增或更新节点时调用
 */
export async function refreshNodeCache(nodeId: number): Promise<void> {
  try {
    const node = await findById(nodeId);
    if (node) {
      await redis.hset(REDIS_KEYS.NODES_HASH, String(nodeId), JSON.stringify(node));
      console.log(`[NodeCache] 已刷新节点 ${nodeId} 的缓存`);
    }
  } catch (error) {
    console.error(`[NodeCache] 刷新节点 ${nodeId} 缓存失败:`, error);
    throw error;
  }
}

/**
 * 从缓存中删除节点
 * 删除节点时调用
 */
export async function removeNodeFromCache(nodeId: number): Promise<void> {
  try {
    await redis.hdel(REDIS_KEYS.NODES_HASH, String(nodeId));
    console.log(`[NodeCache] 已从缓存中删除节点 ${nodeId}`);
  } catch (error) {
    console.error(`[NodeCache] 从缓存删除节点 ${nodeId} 失败:`, error);
    throw error;
  }
}

/**
 * 获取单个节点（优先从缓存读取）
 */
export async function getNodeFromCache(nodeId: number): Promise<Node | null> {
  try {
    const cached = await redis.hget(REDIS_KEYS.NODES_HASH, String(nodeId));
    if (cached) {
      return JSON.parse(cached) as Node;
    }
    return null;
  } catch (error) {
    console.error(`[NodeCache] 从缓存获取节点 ${nodeId} 失败:`, error);
    return null;
  }
}

/**
 * 获取所有节点（从缓存读取）
 */
export async function getAllNodesFromCache(): Promise<Node[]> {
  try {
    const hashData = await redis.hgetall(REDIS_KEYS.NODES_HASH);
    if (!hashData || Object.keys(hashData).length === 0) {
      return [];
    }

    const nodes: Node[] = [];
    for (const key in hashData) {
      nodes.push(JSON.parse(hashData[key]) as Node);
    }

    // 按 ID 降序排序
    return nodes.sort((a, b) => b.id - a.id);
  } catch (error) {
    console.error('[NodeCache] 从缓存获取所有节点失败:', error);
    return [];
  }
}

/**
 * 检查缓存是否已就绪
 */
export async function isNodeCacheReady(): Promise<boolean> {
  try {
    const ready = await redis.get(REDIS_KEYS.NODES_CACHE_READY);
    return ready === 'true';
  } catch (error) {
    console.error('[NodeCache] 检查缓存状态失败:', error);
    return false;
  }
}

/**
 * 全量刷新缓存
 * 手动触发缓存重建
 */
export async function rebuildNodeCache(): Promise<void> {
  console.log('[NodeCache] 手动重建节点缓存...');
  await initNodeCache();
}
