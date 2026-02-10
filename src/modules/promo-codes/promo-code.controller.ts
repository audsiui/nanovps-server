/**
 * 优惠码控制器
 *
 * @file promo-code.controller.ts
 * @description 优惠码模块的API接口定义
 */
import Elysia, { t } from 'elysia';
import { authPlugin } from '../../plugins/auth';
import { success, created, errors } from '../../utils/response';
import {
  getPromoCodeList,
  getPromoCodeById,
  createPromoCode,
  updatePromoCode,
  deletePromoCode,
  validateAndCalculate,
  getPromoCodeUsageRecords,
} from './promo-code.service';

export const promoCodeController = new Elysia({
  prefix: '/promo-codes',
  detail: { tags: ['优惠码'] },
})
  .use(authPlugin)
  // ========== 管理员接口 ==========
  // 获取优惠码列表（管理员）
  .get(
    '/admin/list',
    async ({ query }) => {
      const page = query.page ? Number(query.page) : 1;
      const pageSize = query.pageSize ? Number(query.pageSize) : 10;
      const keyword = query.keyword;
      const isActive = query.isActive !== undefined ? query.isActive === 'true' : undefined;

      const result = await getPromoCodeList({
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
        summary: '获取优惠码列表',
        description: '管理员获取优惠码列表，支持分页和搜索',
      },
    },
  )
  // 获取优惠码详情（管理员）
  .get(
    '/admin/detail/:id',
    async ({ params, set }) => {
      try {
        const promoCode = await getPromoCodeById(Number(params.id));
        return success(promoCode);
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
        summary: '获取优惠码详情',
        description: '根据ID获取优惠码详细信息',
      },
    },
  )
  // 创建优惠码（管理员）
  .post(
    '/admin/create',
    async ({ body, set }) => {
      try {
        const promoCode = await createPromoCode(body);
        set.status = 201;
        return created(promoCode, '优惠码创建成功');
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
        type: t.Union([t.Literal('fixed'), t.Literal('percentage')]),
        value: t.String(),
        minAmount: t.Optional(t.String()),
        maxDiscount: t.Optional(t.String()),
        usageType: t.Optional(t.Union([t.Literal('purchase'), t.Literal('recharge'), t.Literal('both')])),
        usageLimit: t.Optional(t.Number({ minimum: 1 })),
        perUserLimit: t.Optional(t.Number({ minimum: 1 })),
        startAt: t.Optional(t.String()),
        endAt: t.Optional(t.String()),
        isActive: t.Optional(t.Boolean()),
      }),
      detail: {
        summary: '创建优惠码',
        description: '创建新的优惠码',
      },
    },
  )
  // 更新优惠码（管理员）
  .post(
    '/admin/update',
    async ({ body, set }) => {
      try {
        const { id, ...updateData } = body;
        const promoCode = await updatePromoCode(Number(id), updateData);
        return success(promoCode, '优惠码更新成功');
      } catch (error: any) {
        if (error.message === '优惠码不存在') {
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
        type: t.Optional(t.Union([t.Literal('fixed'), t.Literal('percentage')])),
        value: t.Optional(t.String()),
        minAmount: t.Optional(t.String()),
        maxDiscount: t.Optional(t.String()),
        usageType: t.Optional(t.Union([t.Literal('purchase'), t.Literal('recharge'), t.Literal('both')])),
        usageLimit: t.Optional(t.Number({ minimum: 1 })),
        perUserLimit: t.Optional(t.Number({ minimum: 1 })),
        startAt: t.Optional(t.String()),
        endAt: t.Optional(t.String()),
        isActive: t.Optional(t.Boolean()),
      }),
      detail: {
        summary: '更新优惠码',
        description: '更新优惠码信息',
      },
    },
  )
  // 删除优惠码（管理员）
  .post(
    '/admin/delete',
    async ({ body, set }) => {
      try {
        await deletePromoCode(Number(body.id));
        return success(null, '优惠码删除成功');
      } catch (error: any) {
        if (error.message === '优惠码不存在') {
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
        summary: '删除优惠码',
        description: '删除优惠码（仅未使用的可删除）',
      },
    },
  )
  // 获取优惠码使用记录（管理员）
  .get(
    '/admin/usage-records',
    async ({ query }) => {
      const page = query.page ? Number(query.page) : 1;
      const pageSize = query.pageSize ? Number(query.pageSize) : 10;
      const promoCodeId = query.promoCodeId ? Number(query.promoCodeId) : undefined;

      const result = await getPromoCodeUsageRecords({
        promoCodeId,
        page,
        pageSize,
      });

      return success(result);
    },
    {
      auth: ['admin'],
      query: t.Object({
        promoCodeId: t.Optional(t.String()),
        page: t.Optional(t.String()),
        pageSize: t.Optional(t.String()),
      }),
      detail: {
        summary: '获取优惠码使用记录',
        description: '管理员查看优惠码使用记录',
      },
    },
  )
  // ========== 用户接口 ==========
  // 验证优惠码（预览折扣）
  .get(
    '/validate',
    async ({ query, user, set }) => {
      try {
        const { code, amount, usageType } = query;
        
        if (!code || !amount || !usageType) {
          set.status = 400;
          return errors.badRequest('缺少必要参数');
        }

        const result = await validateAndCalculate(
          code,
          Number(amount),
          usageType as 'purchase' | 'recharge',
          user.userId
        );

        return success(result);
      } catch (error: any) {
        set.status = 400;
        return errors.badRequest(error.message);
      }
    },
    {
      auth: true,
      query: t.Object({
        code: t.String(),
        amount: t.String(),
        usageType: t.Union([t.Literal('purchase'), t.Literal('recharge')]),
      }),
      detail: {
        summary: '验证优惠码',
        description: '验证优惠码有效性并计算折扣金额',
      },
    },
  )
  // 获取我的使用记录
  .get(
    '/my-usages',
    async ({ query, user }) => {
      const page = query.page ? Number(query.page) : 1;
      const pageSize = query.pageSize ? Number(query.pageSize) : 10;

      const result = await getPromoCodeUsageRecords({
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
        summary: '获取我的优惠码使用记录',
        description: '用户查看自己使用过的优惠码记录',
      },
    },
  );
