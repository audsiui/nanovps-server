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
import { findAll as findNodePlansByTemplateId } from '../node-plans/node-plan.repository';
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
 * 如果套餐模板正在被节点使用，则只能修改名称和备注
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

  // 检查是否有节点正在使用该套餐模板
  const { total: usageCount } = await findNodePlansByTemplateId({ planTemplateId: id });
  const isInUse = usageCount > 0;

  if (isInUse) {
    // 如果正在使用，只允许修改名称和备注
    const allowedFields: Partial<typeof data> = {};
    if (data.name !== undefined) allowedFields.name = data.name;
    if (data.remark !== undefined) allowedFields.remark = data.remark;

    // 检查是否尝试修改了其他字段
    const restrictedFields = ['cpu', 'ramMb', 'diskGb', 'trafficGb', 'bandwidthMbps', 'portCount'];
    const attemptedFields = restrictedFields.filter(field => data[field as keyof typeof data] !== undefined);

    if (attemptedFields.length > 0) {
      throw new Error(`该套餐模板正在被 ${usageCount} 个节点使用，无法修改资源配置（${attemptedFields.join(', ')}）`);
    }

    if (Object.keys(allowedFields).length === 0) {
      throw new Error('没有可修改的字段');
    }

    return update(id, allowedFields);
  }

  return update(id, data);
}

/**
 * 删除套餐模板
 * 如果有节点正在使用该套餐模板，则不允许删除
 */
export async function deletePlanTemplate(id: number) {
  const exists = await findById(id);
  if (!exists) {
    throw new Error('套餐模板不存在');
  }

  // 检查是否有节点正在使用该套餐模板
  const { total: usageCount } = await findNodePlansByTemplateId({ planTemplateId: id });
  if (usageCount > 0) {
    throw new Error(`该套餐模板正在被 ${usageCount} 个节点使用，无法删除`);
  }

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
