/**
 * 镜像业务逻辑层
 *
 * @file image.service.ts
 * @description 处理镜像模块的业务逻辑和数据校验
 */
import {
  findAll,
  findById,
  findByImageRef,
  create,
  update,
  remove,
  existsByImageRef,
} from './image.repository';
import type { NewImage } from '../../db/schema/images';

/**
 * 获取镜像列表（支持可选分页）
 * 不传 page 和 pageSize 则返回所有数据
 */
export async function getImages(options?: {
  isActive?: boolean;
  family?: string;
  page?: number;
  pageSize?: number;
}) {
  return findAll(options);
}

/**
 * 获取镜像详情
 */
export async function getImageById(id: number) {
  const image = await findById(id);
  if (!image) {
    throw new Error('镜像不存在');
  }
  return image;
}

/**
 * 创建镜像
 */
export async function createImage(data: NewImage) {
  // 检查 imageRef 是否已存在
  const exists = await existsByImageRef(data.imageRef);
  if (exists) {
    throw new Error('镜像地址已存在');
  }

  return create(data);
}

/**
 * 更新镜像
 */
export async function updateImage(id: number, data: Partial<NewImage>) {
  // 检查镜像是否存在
  const image = await findById(id);
  if (!image) {
    throw new Error('镜像不存在');
  }

  // 如果修改了 imageRef，检查新地址是否已存在
  if (data.imageRef && data.imageRef !== image.imageRef) {
    const exists = await existsByImageRef(data.imageRef, id);
    if (exists) {
      throw new Error('镜像地址已存在');
    }
  }

  return update(id, data);
}

/**
 * 删除镜像
 */
export async function deleteImage(id: number) {
  // 检查镜像是否存在
  const image = await findById(id);
  if (!image) {
    throw new Error('镜像不存在');
  }

  const deleted = await remove(id);
  if (!deleted) {
    throw new Error('删除失败');
  }

  return true;
}
