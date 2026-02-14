/**
 * 节点业务逻辑层
 *
 * @file node.service.ts
 * @description 处理节点模块的业务逻辑和数据校验
 */
import {
  findById,
  findByName,
  findByAgentToken,
  create,
  update,
  remove,
  existsByName,
  existsByAgentToken,
  findAll,
} from './node.repository';
import { refreshNodeCache, removeNodeFromCache } from './node-cache.service';
import { isNodeConnected, getConnectedNodeIds } from '../agent-channel/command.service';
import { getAgentFullData } from '../agent-channel/report-cache.service';
import type { NewNode } from '../../db/schema/nodes';

/**
 * 创建节点
 * 所有字段必传，除了 ipv6
 */
export async function createNode(data: {
  name: string;
  agentToken: string;
  ipv4: string;
  ipv6?: string;
  totalCpu: number;
  totalRamMb: number;
  allocatableDiskGb: number;
  status: number;
  regionId?: number;
}) {
  // 检查名称是否已存在
  const nameExists = await existsByName(data.name);
  if (nameExists) {
    throw new Error('节点名称已存在');
  }

  // 检查 Agent Token 是否已存在
  const tokenExists = await existsByAgentToken(data.agentToken);
  if (tokenExists) {
    throw new Error('Agent Token 已存在');
  }

  const newNodeData: NewNode = {
    name: data.name,
    agentToken: data.agentToken,
    ipv4: data.ipv4,
    ipv6: data.ipv6,
    totalCpu: data.totalCpu,
    totalRamMb: data.totalRamMb,
    allocatableDiskGb: data.allocatableDiskGb,
    status: data.status,
    regionId: data.regionId,
  };

  const result = await create(newNodeData);

  // 刷新缓存
  await refreshNodeCache(result.id);

  return result;
}

/**
 * 更新节点
 * 不可编辑硬盘（allocatableDiskGb）
 */
export async function updateNode(
  id: number,
  data: {
    name?: string;
    agentToken?: string;
    ipv4?: string;
    ipv6?: string;
    totalCpu?: number;
    totalRamMb?: number;
    status?: number;
    regionId?: number;
  },
) {
  // 检查节点是否存在
  const node = await findById(id);
  if (!node) {
    throw new Error('节点不存在');
  }

  // 如果修改了名称，检查新名称是否已存在
  if (data.name && data.name !== node.name) {
    const nameExists = await existsByName(data.name, id);
    if (nameExists) {
      throw new Error('节点名称已存在');
    }
  }

  // 如果修改了 Agent Token，检查新 Token 是否已存在
  if (data.agentToken && data.agentToken !== node.agentToken) {
    const tokenExists = await existsByAgentToken(data.agentToken, id);
    if (tokenExists) {
      throw new Error('Agent Token 已存在');
    }
  }

  const result = await update(id, data);

  // 刷新缓存
  if (result) {
    await refreshNodeCache(result.id);
  }

  return result;
}

/**
 * 根据ID获取节点详情
 */
export async function getNodeById(id: number) {
  const node = await findById(id);
  if (!node) {
    throw new Error('节点不存在');
  }
  return {
    ...node,
    isOnline: isNodeConnected(id),
  };
}


/**
 * 获取节点列表
 * 支持分页、状态筛选、区域筛选、关键词搜索
 */
export async function getNodeList(params: {
  page?: number;
  pageSize?: number;
  status?: number;
  regionId?: number;
  keyword?: string;
}) {
  const { page = 1, pageSize = 10 } = params;

  // 参数校验
  if (page < 1) {
    throw new Error('页码不能小于1');
  }
  if (pageSize < 1 || pageSize > 100) {
    throw new Error('每页数量范围为1-100');
  }

  const { list, total } = await findAll(params);

  // 获取所有在线节点 ID
  const onlineNodeIds = new Set(getConnectedNodeIds());

  // 为每个节点添加 isOnline 字段
  const listWithOnline = list.map((node) => ({
    ...node,
    isOnline: onlineNodeIds.has(node.id),
  }));

  return {
    list: listWithOnline,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

/**
 * 删除节点
 */
export async function deleteNode(id: number) {
  // 检查节点是否存在
  const node = await findById(id);
  if (!node) {
    throw new Error('节点不存在');
  }

  await remove(id);

  // 从缓存中删除
  await removeNodeFromCache(id);
}


/**
 * 获取节点实时数据（从 Redis 缓存）
 */
export async function getNodeRealtime(id: number) {
  const node = await findById(id);
  if (!node) {
    throw new Error('节点不存在');
  }

  const isOnline = isNodeConnected(id);

  // 如果节点离线，返回基本信息
  if (!isOnline) {
    return {
      nodeId: node.id,
      nodeName: node.name,
      isOnline: false,
      timestamp: null,
      host: null,
      containers: [],
    };
  }

  // 从 Redis 获取实时数据
  const agentId = node.agentToken;
  const fullData = await getAgentFullData(agentId);

  return {
    nodeId: node.id,
    nodeName: node.name,
    isOnline: true,
    timestamp: fullData.host?.timestamp || null,
    host: fullData.host ? {
      uptime: fullData.host.uptime,
      cpu: fullData.host.cpu,
      memory: fullData.host.memory,
      network: fullData.host.network,
      disks: fullData.host.disks,
    } : null,
    containers: Object.values(fullData.containers).map((c) => ({
      id: c.id,
      name: c.name,
      cpuPercent: c.cpuPercent,
      memory: c.memory,
      network: c.network,
      timestamp: c.timestamp,
    })),
  };
}
