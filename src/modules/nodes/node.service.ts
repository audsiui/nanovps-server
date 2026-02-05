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
  existsByName,
  existsByAgentToken,
  findAll,
} from './node.repository';
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

  return create(newNodeData);
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

  return update(id, data);
}

/**
 * 根据ID获取节点详情
 */
export async function getNodeById(id: number) {
  const node = await findById(id);
  if (!node) {
    throw new Error('节点不存在');
  }
  return node;
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

  return {
    list,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}
