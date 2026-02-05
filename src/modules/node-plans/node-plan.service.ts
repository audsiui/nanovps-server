/**
 * 节点套餐业务逻辑层
 *
 * @file node-plan.service.ts
 * @description 处理节点套餐模块的业务逻辑
 */
import {
  findAll,
  findById,
  create,
  update,
  remove,
  existsByNodeAndTemplate,
} from './node-plan.repository';
import { findById as findNodeById } from '../nodes/node.repository';
import { findById as findTemplateById } from '../plan-templates/plan-template.repository';
import type { NewNodePlan, BillingCycle } from '../../db/schema/nodePlans';

/**
 * 获取节点套餐列表
 */
export async function getNodePlanList(params: {
  nodeId?: number;
  planTemplateId?: number;
  status?: number;
  page?: number;
  pageSize?: number;
}) {
  const { page = 1, pageSize = 10 } = params;

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

/**
 * 为节点配置套餐（给服务器配置套餐）
 */
export async function createNodePlan(data: {
  nodeId: number;
  planTemplateId: number;
  stock?: number;
  billingCycles: BillingCycle[];
  status?: number;
  sortOrder?: number;
}) {
  // 验证节点是否存在
  const node = await findNodeById(data.nodeId);
  if (!node) {
    throw new Error('节点不存在');
  }

  // 验证套餐模板是否存在
  const template = await findTemplateById(data.planTemplateId);
  if (!template) {
    throw new Error('套餐模板不存在');
  }

  // 检查该节点是否已配置此套餐
  const exists = await existsByNodeAndTemplate(data.nodeId, data.planTemplateId);
  if (exists) {
    throw new Error('该节点已配置此套餐模板');
  }

  // 验证计费周期配置
  if (!data.billingCycles || data.billingCycles.length === 0) {
    throw new Error('至少配置一个计费周期');
  }

  for (const cycle of data.billingCycles) {
    if (!cycle.cycle || !cycle.name || !cycle.months || cycle.price === undefined) {
      throw new Error('计费周期配置不完整');
    }
    if (cycle.price < 0) {
      throw new Error('价格不能为负数');
    }
  }

  const newData: NewNodePlan = {
    nodeId: data.nodeId,
    planTemplateId: data.planTemplateId,
    stock: data.stock ?? -1,
    billingCycles: data.billingCycles,
    status: data.status ?? 1,
    sortOrder: data.sortOrder ?? 0,
  };

  return create(newData);
}

/**
 * 更新节点套餐配置
 */
export async function updateNodePlan(
  id: number,
  data: Partial<{
    stock: number;
    billingCycles: BillingCycle[];
    status: number;
    sortOrder: number;
  }>,
) {
  // 检查节点套餐是否存在
  const nodePlan = await findById(id);
  if (!nodePlan) {
    throw new Error('节点套餐不存在');
  }

  // 验证计费周期配置
  if (data.billingCycles) {
    if (data.billingCycles.length === 0) {
      throw new Error('至少配置一个计费周期');
    }
    for (const cycle of data.billingCycles) {
      if (!cycle.cycle || !cycle.name || !cycle.months || cycle.price === undefined) {
        throw new Error('计费周期配置不完整');
      }
      if (cycle.price < 0) {
        throw new Error('价格不能为负数');
      }
    }
  }

  // 验证库存
  if (data.stock !== undefined && data.stock < -1) {
    throw new Error('库存不能小于-1');
  }

  return update(id, data);
}

/**
 * 删除节点套餐
 */
export async function deleteNodePlan(id: number) {
  const nodePlan = await findById(id);
  if (!nodePlan) {
    throw new Error('节点套餐不存在');
  }

  const deleted = await remove(id);
  if (!deleted) {
    throw new Error('删除失败');
  }

  return { id };
}

/**
 * 根据ID获取节点套餐详情
 */
export async function getNodePlanById(id: number) {
  const nodePlan = await findById(id);
  if (!nodePlan) {
    throw new Error('节点套餐不存在');
  }
  return nodePlan;
}

/**
 * 获取指定节点的所有套餐
 */
export async function getNodePlansByNodeId(nodeId: number, page?: number, pageSize?: number) {
  // 验证节点是否存在
  const node = await findNodeById(nodeId);
  if (!node) {
    throw new Error('节点不存在');
  }

  return getNodePlanList({ nodeId, page, pageSize });
}
