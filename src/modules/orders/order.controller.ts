/**
 * 订单控制器
 *
 * @file order.controller.ts
 * @description 订单模块的API接口定义
 */
import Elysia, { t } from 'elysia';
import { authPlugin } from '../../plugins/auth';
import { success, created, errors } from '../../utils/response';
import {
  createOrder,
  getOrderById,
  getOrderByOrderNo,
  getUserOrders,
  calculateOrderAmount,
} from './order.service';

export const orderController = new Elysia({
  prefix: '/orders',
  detail: { tags: ['订单'] },
})
  .use(authPlugin)
  // 计算订单金额（预览）
  .get(
    '/calculate',
    async ({ query, user, set }) => {
      try {
        const { nodePlanId, billingCycle, durationMonths, promoCode } = query;

        const result = await calculateOrderAmount({
          nodePlanId: Number(nodePlanId),
          billingCycle,
          durationMonths: Number(durationMonths),
          promoCode,
          userId: user.userId,
        });

        return success(result);
      } catch (error: any) {
        set.status = 400;
        return errors.badRequest(error.message);
      }
    },
    {
      auth: true,
      query: t.Object({
        nodePlanId: t.String(),
        billingCycle: t.String(),
        durationMonths: t.String(),
        promoCode: t.Optional(t.String()),
      }),
      detail: {
        summary: '计算订单金额',
        description: '预览订单金额，支持优惠码验证',
      },
    }
  )
  // 创建订单
  .post(
    '/create',
    async ({ body, user, set }) => {
      try {
        const { nodePlanId, billingCycle, durationMonths, promoCode } = body;

        const result = await createOrder({
          userId: user.userId,
          nodePlanId,
          billingCycle,
          durationMonths,
          promoCode,
        });

        set.status = 201;
        return created(result, '订单创建成功');
      } catch (error: any) {
        set.status = 400;
        return errors.badRequest(error.message);
      }
    },
    {
      auth: true,
      body: t.Object({
        nodePlanId: t.Number(),
        billingCycle: t.String(),
        durationMonths: t.Number({ minimum: 1 }),
        promoCode: t.Optional(t.String()),
      }),
      detail: {
        summary: '创建订单',
        description: '创建实例购买订单，支持使用优惠码',
      },
    }
  )
  // 获取我的订单列表
  .get(
    '/my-orders',
    async ({ query, user }) => {
      const page = query.page ? Number(query.page) : 1;
      const pageSize = query.pageSize ? Number(query.pageSize) : 10;
      const status = query.status;

      const result = await getUserOrders({
        userId: user.userId,
        page,
        pageSize,
        status,
      });

      return success(result);
    },
    {
      auth: true,
      query: t.Object({
        page: t.Optional(t.String()),
        pageSize: t.Optional(t.String()),
        status: t.Optional(t.String()),
      }),
      detail: {
        summary: '获取我的订单列表',
        description: '获取当前用户的订单列表',
      },
    }
  )
  // 获取订单详情
  .get(
    '/detail/:id',
    async ({ params, user, set }) => {
      try {
        const order = await getOrderById(Number(params.id));
        
        // 只能查看自己的订单
        if (order.userId !== user.userId) {
          set.status = 403;
          return errors.forbidden('无权访问此订单');
        }

        return success(order);
      } catch (error: any) {
        if (error.message === '订单不存在') {
          set.status = 404;
          return errors.notFound(error.message);
        }
        set.status = 400;
        return errors.badRequest(error.message);
      }
    },
    {
      auth: true,
      params: t.Object({
        id: t.String(),
      }),
      detail: {
        summary: '获取订单详情',
        description: '根据ID获取订单详情',
      },
    }
  );
