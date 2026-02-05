/**
 * 套餐模板业务逻辑层
 *
 * @file plan-template.service.ts
 * @description 处理套餐模板模块的业务逻辑
 */
import {
  findAll,
  findById,
  create,
  update,
  remove,
} from './plan-template.repository';
import type { NewPlanTemplate } from '../../db/schema/planTemplates';

/**
 * 获取套餐模板列表
 */
export async function getPlanTemplateList(params?: {
  page?: number;
  pageSize?: number;
  keyword?: string;
}) {
  const { page = 1, pageSize = 10 } = params || {};

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
 * 创建套餐模板
 */
export async function createPlanTemplate(data: {
  name: string;
  cpu: number;
  ramMb: number;
  diskGb: number;
  trafficGb?: number;
  bandwidthMbps?: number;
  portCount?: number;
  remark?: string;
}) {
  const newData: NewPlanTemplate = {
    name: data.name,
    cpu: data.cpu,
    ramMb: data.ramMb,
    diskGb: data.diskGb,
    trafficGb: data.trafficGb,
    bandwidthMbps: data.bandwidthMbps,
    portCount: data.portCount,
    remark: data.remark,
  };

  return create(newData);
}

/**
 * 更新套餐模板
 */
export async function updatePlanTemplate(
  id: number,
  data: Partial<{
    name: string;
    cpu: number;
    ramMb: number;
    diskGb: number;
    trafficGb?: number;
    bandwidthMbps?: number;
    portCount?: number;
    remark?: string;
  }>,
) {
  const exists = await findById(id);
  if (!exists) {
    throw new Error('套餐模板不存在');
  }

  return update(id, data);
}

/**
 * 删除套餐模板
 */
export async function deletePlanTemplate(id: number) {
  const exists = await findById(id);
  if (!exists) {
    throw new Error('套餐模板不存在');
  }

  // TODO: 检查是否有节点在使用该套餐模板

  const deleted = await remove(id);
  if (!deleted) {
    throw new Error('删除失败');
  }

  return { id };
}

/**
 * 根据ID获取套餐模板详情
 */
export async function getPlanTemplateById(id: number) {
  const template = await findById(id);
  if (!template) {
    throw new Error('套餐模板不存在');
  }
  return template;
}
