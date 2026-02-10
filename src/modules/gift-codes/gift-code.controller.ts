/**
 * 赠金码控制器
 *
 * @file gift-code.controller.ts
 * @description 赠金码模块的API接口定义
 */
import Elysia, { t } from 'elysia';
import { authPlugin } from '../../plugins/auth';
import { success, created, errors } from '../../utils/response';
import {
  getGiftCodeList,
  getGiftCodeById,
  createGiftCode,
  updateGiftCode,
  deleteGiftCode,
  useGiftCode,
  getGiftCodeUsageRecords,
} from './gift-code.service';

export const giftCodeController = new Elysia({
  prefix: '/gift-codes',
  detail: { tags: ['赠金码'] },
})
  .use(authPlugin)
  // ========== 管理员接口 ==========
  // 获取赠金码列表（管理员）
  .get(
    '/admin/list',
    async ({ query }) => {
      const page = query.page ? Number(query.page) : 1;
      const pageSize = query.pageSize ? Number(query.pageSize) : 10;
      const keyword = query.keyword;
      const isActive = query.isActive !== undefined ? query.isActive === 'true' : undefined;

      const result = await getGiftCodeList({
        page,
        pageSize,
        keyword,
        isActive,
      });

      return success(result);
    },
    {
      auth: ['admin'],
      query: t.Object({
        page: t.Optional(t.String()),
        pageSize: t.Optional(t.String()),
        keyword: t.Optional(t.String()),
        isActive: t.Optional(t.String()),
      }),
      detail: {
        summary: '获取赠金码列表',
        description: '管理员获取赠金码列表，支持分页和搜索',
      },
    },
  )
  // 获取赠金码详情（管理员）
  .get(
    '/admin/detail/:id',
    async ({ params, set }) => {
      try {
        const giftCode = await getGiftCodeById(Number(params.id));
        return success(giftCode);
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
        summary: '获取赠金码详情',
        description: '根据ID获取赠金码详细信息',
      },
    },
  )
  // 创建赠金码（管理员）
  .post(
    '/admin/create',
    async ({ body, set }) => {
      try {
        const giftCode = await createGiftCode(body);
        set.status = 201;
        return created(giftCode, '赠金码创建成功');
      } catch (error: any) {
        set.status = 400;
        return errors.badRequest(error.message);
      }
    },
    {
      auth: ['admin'],
      body: t.Object({
        code: t.String({ minLength: 1, maxLength: 50 }),
        description: t.Optional(t.String({ maxLength: 255 })),
        amount: t.String(),
        usageLimit: t.Optional(t.Number({ minimum: 1 })),
        perUserLimit: t.Optional(t.Number({ minimum: 1 })),
        startAt: t.Optional(t.String()),
        endAt: t.Optional(t.String()),
        isActive: t.Optional(t.Boolean()),
      }),
      detail: {
        summary: '创建赠金码',
        description: '创建新的赠金码，用户使用后可直接获得余额赠金',
      },
    },
  )
  // 更新赠金码（管理员）
  .post(
    '/admin/update',
    async ({ body, set }) => {
      try {
        const { id, ...updateData } = body;
        const giftCode = await updateGiftCode(Number(id), updateData);
        return success(giftCode, '赠金码更新成功');
      } catch (error: any) {
        if (error.message === '赠金码不存在') {
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
        code: t.Optional(t.String({ minLength: 1, maxLength: 50 })),
        description: t.Optional(t.String({ maxLength: 255 })),
        amount: t.Optional(t.String()),
        usageLimit: t.Optional(t.Number({ minimum: 1 })),
        perUserLimit: t.Optional(t.Number({ minimum: 1 })),
        startAt: t.Optional(t.String()),
        endAt: t.Optional(t.String()),
        isActive: t.Optional(t.Boolean()),
      }),
      detail: {
        summary: '更新赠金码',
        description: '更新赠金码信息',
      },
    },
  )
  // 删除赠金码（管理员）
  .post(
    '/admin/delete',
    async ({ body, set }) => {
      try {
        await deleteGiftCode(Number(body.id));
        return success(null, '赠金码删除成功');
      } catch (error: any) {
        if (error.message === '赠金码不存在') {
          set.status = 404;
          return errors.notFound(error.message);
        }
        if (error.message.includes('已被使用')) {
          set.status = 409;
          return errors.conflict(error.message);
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
        summary: '删除赠金码',
        description: '删除赠金码（仅未使用的可删除）',
      },
    },
  )
  // 获取赠金码使用记录（管理员）
  .get(
    '/admin/usage-records',
    async ({ query }) => {
      const page = query.page ? Number(query.page) : 1;
      const pageSize = query.pageSize ? Number(query.pageSize) : 10;
      const giftCodeId = query.giftCodeId ? Number(query.giftCodeId) : undefined;

      const result = await getGiftCodeUsageRecords({
        giftCodeId,
        page,
        pageSize,
      });

      return success(result);
    },
    {
      auth: ['admin'],
      query: t.Object({
        giftCodeId: t.Optional(t.String()),
        page: t.Optional(t.String()),
        pageSize: t.Optional(t.String()),
      }),
      detail: {
        summary: '获取赠金码使用记录',
        description: '管理员查看赠金码使用记录',
      },
    },
  )
  // ========== 用户接口 ==========
  // 使用赠金码
  .post(
    '/use',
    async ({ body, user, set }) => {
      try {
        const { code } = body;

        const result = await useGiftCode({
          code,
          userId: user.userId,
        });

        if (!result.success) {
          set.status = 400;
          return errors.badRequest(result.message);
        }

        return success(result, result.message);
      } catch (error: any) {
        set.status = 400;
        return errors.badRequest(error.message);
      }
    },
    {
      auth: true,
      body: t.Object({
        code: t.String(),
      }),
      detail: {
        summary: '使用赠金码',
        description: '用户使用赠金码，领取余额赠金',
      },
    },
  )
  // 获取我的使用记录
  .get(
    '/my-usages',
    async ({ query, user }) => {
      const page = query.page ? Number(query.page) : 1;
      const pageSize = query.pageSize ? Number(query.pageSize) : 10;

      const result = await getGiftCodeUsageRecords({
        userId: user.userId,
        page,
        pageSize,
      });

      return success(result);
    },
    {
      auth: true,
      query: t.Object({
        page: t.Optional(t.String()),
        pageSize: t.Optional(t.String()),
      }),
      detail: {
        summary: '获取我的赠金码使用记录',
        description: '用户查看自己使用过的赠金码记录',
      },
    },
  );
