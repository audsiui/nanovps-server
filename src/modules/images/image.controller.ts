/**
 * 镜像控制器
 *
 * @file image.controller.ts
 * @description 镜像模块的API接口定义
 */
import Elysia, { t } from 'elysia';
import { authPlugin } from '../../plugins/auth';
import { success, created, errors } from '../../utils/response';
import {
  getImages,
  getImageById,
  createImage,
  updateImage,
  deleteImage,
} from './image.service';

// 用户端镜像控制器
export const userImageController = new Elysia({
  prefix: '/images',
  detail: { tags: ['镜像'] },
})
  .use(authPlugin)
  // 获取可用镜像列表（用户端）
  .get(
    '/available',
    async () => {
      const result = await getImages({ isActive: true });
      return success(result);
    },
    {
      auth: true,
      detail: {
        summary: '获取可用镜像列表',
        description: '获取所有可用的镜像列表（用户端）',
      },
    },
  );

// 管理端镜像控制器
export const imageController = new Elysia({
  prefix: '/admin/images',
  detail: { tags: ['镜像管理'] },
})
  .use(authPlugin)
  // 获取镜像列表（GET 查询，带可选分页）
  .get(
    '/list',
    async ({ query }) => {
      const { isActive, family, page, pageSize } = query;

      // 如果传了分页参数，则分页查询；否则查询所有
      const hasPagination = page !== undefined && pageSize !== undefined;

      const result = await getImages({
        isActive: isActive !== undefined ? isActive === 'true' : undefined,
        family,
        page: hasPagination ? Number(page) : undefined,
        pageSize: hasPagination ? Number(pageSize) : undefined,
      });

      return success(result);
    },
    {
      auth: ['admin'],
      query: t.Object({
        isActive: t.Optional(t.String()),
        family: t.Optional(t.String()),
        page: t.Optional(t.String()),
        pageSize: t.Optional(t.String()),
      }),
      detail: {
        summary: '获取镜像列表',
        description: '获取镜像列表，支持按状态、家族筛选。不传 page/pageSize 则返回所有数据',
      },
    },
  )
  // 获取镜像详情（GET 查询）
  .get(
    '/detail/:id',
    async ({ params, set }) => {
      try {
        const image = await getImageById(Number(params.id));
        return success(image);
      } catch (error: any) {
        set.status = 404;
        return errors.notFound(error.message);
      }
    },
    {
      auth: ['admin'],
      params: t.Object({
        id: t.String(),
      }),
      detail: {
        summary: '获取镜像详情',
        description: '根据ID获取镜像详细信息',
      },
    },
  )
  // 创建镜像（POST）
  .post(
    '/create',
    async ({ body, set }) => {
      try {
        const image = await createImage(body);
        set.status = 201;
        return created(image, '镜像创建成功');
      } catch (error: any) {
        set.status = 409;
        return errors.conflict(error.message);
      }
    },
    {
      auth: ['admin'],
      body: t.Object({
        name: t.String({ minLength: 1, maxLength: 50 }),
        family: t.Optional(t.String({ minLength: 1, maxLength: 20 })),
        description: t.Optional(t.String({ maxLength: 255 })),
        imageRef: t.String({ minLength: 1, maxLength: 255 }),
        isActive: t.Optional(t.Boolean()),
      }),
      detail: {
        summary: '创建镜像',
        description: '创建新的镜像，imageRef 必须唯一',
      },
    },
  )
  // 更新镜像（POST）
  .post(
    '/update',
    async ({ body, set }) => {
      try {
        const { id, ...updateData } = body;
        const image = await updateImage(Number(id), updateData);
        return success(image, '镜像更新成功');
      } catch (error: any) {
        if (error.message === '镜像不存在') {
          set.status = 404;
          return errors.notFound(error.message);
        }
        set.status = 409;
        return errors.conflict(error.message);
      }
    },
    {
      auth: ['admin'],
      body: t.Object({
        id: t.Number(),
        name: t.Optional(t.String({ minLength: 1, maxLength: 50 })),
        family: t.Optional(t.String({ minLength: 1, maxLength: 20 })),
        description: t.Optional(t.String({ maxLength: 255 })),
        imageRef: t.Optional(t.String({ minLength: 1, maxLength: 255 })),
        isActive: t.Optional(t.Boolean()),
      }),
      detail: {
        summary: '更新镜像',
        description: '更新镜像信息，id 必填，imageRef 修改时需保证唯一性',
      },
    },
  )
  // 删除镜像（POST）
  .post(
    '/delete',
    async ({ body, set }) => {
      try {
        const { id } = body;
        await deleteImage(Number(id));
        return success(null, '镜像删除成功');
      } catch (error: any) {
        if (error.message === '镜像不存在') {
          set.status = 404;
          return errors.notFound(error.message);
        }
        set.status = 400;
        return errors.badRequest(error.message);
      }
    },
    {
      auth: ['admin'],
      body: t.Object({
        id: t.Number(),
      }),
      detail: {
        summary: '删除镜像',
        description: '删除指定镜像，id 必填',
      },
    },
  );
