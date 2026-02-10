/**
 * 充值控制器
 *
 * @file recharge.controller.ts
 * @description 充值模块的API接口定义
 */
import Elysia, { t } from 'elysia';
import { authPlugin } from '../../plugins/auth';
import { success, created, errors } from '../../utils/response';
import {
  createRecharge,
  getRechargeById,
  getUserRecharges,
} from './recharge.service';

export const rechargeController = new Elysia({
  prefix: '/recharge',
  detail: { tags: ['充值'] },
})
  .use(authPlugin)
  // 创建充值
  .post(
    '/create',
    async ({ body, user, set }) => {
      try {
        const { amount, channel } = body;

        const result = await createRecharge({
          userId: user.userId,
          amount,
          channel,
        });

        set.status = 201;
        return created(result, '充值订单创建成功');
      } catch (error: any) {
        set.status = 400;
        return errors.badRequest(error.message);
      }
    },
    {
      auth: true,
      body: t.Object({
        amount: t.Number({ minimum: 0.01 }),
        channel: t.Union([
          t.Literal('alipay'),
          t.Literal('wechat'),
          t.Literal('stripe'),
          t.Literal('paypal'),
        ]),
      }),
      detail: {
        summary: '创建充值',
        description: '创建充值订单',
      },
    }
  )
  // 获取我的充值记录
  .get(
    '/my-recharges',
    async ({ query, user }) => {
      const page = query.page ? Number(query.page) : 1;
      const pageSize = query.pageSize ? Number(query.pageSize) : 10;
      const status = query.status;

      const result = await getUserRecharges({
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
        summary: '获取我的充值记录',
        description: '获取当前用户的充值记录列表',
      },
    }
  )
  // 获取充值详情
  .get(
    '/detail/:id',
    async ({ params, user, set }) => {
      try {
        const recharge = await getRechargeById(Number(params.id));
        
        // 只能查看自己的充值记录
        if (recharge.userId !== user.userId) {
          set.status = 403;
          return errors.forbidden('无权访问此充值记录');
        }

        return success(recharge);
      } catch (error: any) {
        if (error.message === '充值记录不存在') {
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
        summary: '获取充值详情',
        description: '根据ID获取充值详情',
      },
    }
  );
