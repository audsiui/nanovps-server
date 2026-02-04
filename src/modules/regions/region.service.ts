/**
 * 区域业务逻辑层
 *
 * @file region.service.ts
 * @description 处理区域模块的业务逻辑和数据校验
 */
import {
  findAll,
  findById,
  findByCode,
  create,
  update,
  remove,
  existsByCode,
} from './region.repository';
import type { NewRegion } from '../../db/schema/regions';

/**
 * 获取区域列表（支持可选分页）
 * 不传 page 和 pageSize 则返回所有数据
 */
export async function getRegions(options?: {
  isActive?: boolean;
  orderBy?: 'sortOrder' | 'createdAt';
  order?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}) {
  return findAll(options);
}

/**
 * 获取区域详情
 */
export async function getRegionById(id: number) {
  const region = await findById(id);
  if (!region) {
    throw new Error('区域不存在');
  }
  return region;
}

/**
 * 创建区域
 */
export async function createRegion(data: NewRegion) {
  // 检查 code 是否已存在
  const exists = await existsByCode(data.code);
  if (exists) {
    throw new Error('区域代码已存在');
  }

  return create(data);
}

/**
 * 更新区域
 */
export async function updateRegion(id: number, data: Partial<NewRegion>) {
  // 检查区域是否存在
  const region = await findById(id);
  if (!region) {
    throw new Error('区域不存在');
  }

  // 如果修改了 code，检查新 code 是否已存在
  if (data.code && data.code !== region.code) {
    const exists = await existsByCode(data.code, id);
    if (exists) {
      throw new Error('区域代码已存在');
    }
  }

  return update(id, data);
}

/**
 * 删除区域
 */
export async function deleteRegion(id: number) {
  // 检查区域是否存在
  const region = await findById(id);
  if (!region) {
    throw new Error('区域不存在');
  }

  // TODO: 检查是否有关联的节点，如果有则不允许删除
  // const hasNodes = await countNodesByRegionId(id);
  // if (hasNodes > 0) {
  //   throw new Error('该区域下存在节点，无法删除');
  // }

  const deleted = await remove(id);
  if (!deleted) {
    throw new Error('删除失败');
  }

  return true;
}
