/**
 * 区域控制器
 *
 * @file region.controller.ts
 * @description 区域模块的API接口定义，仅管理员可访问
 * 只使用 GET 和 POST 请求：
 * - GET: 查询（列表支持可选分页）
 * - POST: 创建、更新、删除
 */
import Elysia, { t } from 'elysia';
import { authPlugin } from '../../plugins/auth';
import { success, created, errors } from '../../utils/response';
import {
  getRegions,
  getRegionById,
  createRegion,
  updateRegion,
  deleteRegion,
} from './region.service';

export const regionController = new Elysia({
  prefix: '/admin/regions',
  detail: { tags: ['区域管理'] },
})
  .use(authPlugin)
  // 获取区域列表（GET 查询，带可选分页）
  .get(
    '/list',
    async ({ query }) => {
      const { isActive, orderBy, order, page, pageSize } = query;

      // 如果传了分页参数，则分页查询；否则查询所有
      const hasPagination = page !== undefined && pageSize !== undefined;

      const result = await getRegions({
        isActive: isActive !== undefined ? isActive === 'true' : undefined,
        orderBy: orderBy as 'sortOrder' | 'createdAt',
        order: order as 'asc' | 'desc',
        page: hasPagination ? Number(page) : undefined,
        pageSize: hasPagination ? Number(pageSize) : undefined,
      });

      return success(result);
    },
    {
      auth: ['admin'],
      query: t.Object({
        isActive: t.Optional(t.String()),
        orderBy: t.Optional(t.String()),
        order: t.Optional(t.String()),
        page: t.Optional(t.String()),
        pageSize: t.Optional(t.String()),
      }),
      detail: {
        summary: '获取区域列表',
        description: '获取区域列表，支持按状态筛选和排序。不传 page/pageSize 则返回所有数据',
      },
    },
  )
  // 获取区域详情（GET 查询）
  .get(
    '/detail/:id',
    async ({ params, set }) => {
      try {
        const region = await getRegionById(Number(params.id));
        return success(region);
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
        summary: '获取区域详情',
        description: '根据ID获取区域详细信息',
      },
    },
  )
  // 创建区域（POST）
  .post(
    '/create',
    async ({ body, set }) => {
      try {
        const region = await createRegion(body);
        set.status = 201;
        return created(region, '区域创建成功');
      } catch (error: any) {
        set.status = 409;
        return errors.conflict(error.message);
      }
    },
    {
      auth: ['admin'],
      body: t.Object({
        name: t.String({ minLength: 1, maxLength: 100 }),
        code: t.String({ minLength: 1, maxLength: 20 }),
        sortOrder: t.Optional(t.Number({ default: 0 })),
        isActive: t.Optional(t.Boolean({ default: true })),
      }),
      detail: {
        summary: '创建区域',
        description: '创建新的区域，code 必须唯一',
      },
    },
  )
  // 更新区域（POST）
  .post(
    '/update',
    async ({ body, set }) => {
      try {
        const { id, ...updateData } = body;
        const region = await updateRegion(Number(id), updateData);
        return success(region, '区域更新成功');
      } catch (error: any) {
        if (error.message === '区域不存在') {
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
        name: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
        code: t.Optional(t.String({ minLength: 1, maxLength: 20 })),
        sortOrder: t.Optional(t.Number()),
        isActive: t.Optional(t.Boolean()),
      }),
      detail: {
        summary: '更新区域',
        description: '更新区域信息，id 必填，code 修改时需保证唯一性',
      },
    },
  )
  // 删除区域（POST）
  .post(
    '/delete',
    async ({ body, set }) => {
      try {
        const { id } = body;
        await deleteRegion(Number(id));
        return success(null, '区域删除成功');
      } catch (error: any) {
        if (error.message === '区域不存在') {
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
        summary: '删除区域',
        description: '删除指定区域，id 必填（如果区域下存在节点则无法删除）',
      },
    },
  );
