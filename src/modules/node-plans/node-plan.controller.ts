/**
 * 节点套餐控制器
 *
 * @file node-plan.controller.ts
 * @description 节点套餐模块的API接口定义，仅管理员可访问
 * 给服务器配置套餐的核心接口
 */
import Elysia, { t } from 'elysia';
import { authPlugin } from '../../plugins/auth';
import { success, created, errors } from '../../utils/response';
import {
  getNodePlanList,
  createNodePlan,
  updateNodePlan,
  deleteNodePlan,
  getNodePlanById,
  getNodePlansByNodeId,
} from './node-plan.service';

// 计费周期配置项的类型定义
const BillingCycleSchema = t.Object({
  cycle: t.String(),
  name: t.String(),
  months: t.Number(),
  price: t.Number(),
  enabled: t.Boolean(),
  sortOrder: t.Number(),
});

export const nodePlanController = new Elysia({
  prefix: '/admin/node-plans',
  detail: { tags: ['节点套餐'] },
})
  .use(authPlugin)
  // 获取节点套餐列表（GET）
  .get(
    '/list',
    async ({ query }) => {
      const page = query.page ? Number(query.page) : 1;
      const pageSize = query.pageSize ? Number(query.pageSize) : 10;
      const nodeId = query.nodeId ? Number(query.nodeId) : undefined;
      const planTemplateId = query.planTemplateId ? Number(query.planTemplateId) : undefined;
      const status = query.status ? Number(query.status) : undefined;

      const result = await getNodePlanList({
        page,
        pageSize,
        nodeId,
        planTemplateId,
        status,
      });

      return success(result);
    },
    {
      auth: ['admin'],
      query: t.Object({
        page: t.Optional(t.String()),
        pageSize: t.Optional(t.String()),
        nodeId: t.Optional(t.String()),
        planTemplateId: t.Optional(t.String()),
        status: t.Optional(t.String()),
      }),
      detail: {
        summary: '获取节点套餐列表',
        description: '支持分页、按节点筛选、按套餐模板筛选、状态筛选',
      },
    },
  )
  // 获取指定节点的套餐列表（GET）
  .get(
    '/node/:nodeId',
    async ({ params, query, set }) => {
      try {
        const nodeId = Number(params.nodeId);
        const page = query.page ? Number(query.page) : 1;
        const pageSize = query.pageSize ? Number(query.pageSize) : 10;

        const result = await getNodePlansByNodeId(nodeId, page, pageSize);
        return success(result);
      } catch (error: any) {
        if (error.message === '节点不存在') {
          set.status = 404;
          return errors.notFound(error.message);
        }
        set.status = 400;
        return errors.badRequest(error.message);
      }
    },
    {
      auth: ['admin'],
      params: t.Object({
        nodeId: t.String(),
      }),
      query: t.Object({
        page: t.Optional(t.String()),
        pageSize: t.Optional(t.String()),
      }),
      detail: {
        summary: '获取指定节点的套餐列表',
        description: '查询某个服务器节点上配置的所有可售套餐',
      },
    },
  )
  // 获取节点套餐详情（GET）
  .get(
    '/detail/:id',
    async ({ params, set }) => {
      try {
        const nodePlan = await getNodePlanById(Number(params.id));
        return success(nodePlan);
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
        summary: '获取节点套餐详情',
        description: '根据ID获取节点套餐详细信息',
      },
    },
  )
  // 给服务器配置套餐（POST）
  .post(
    '/create',
    async ({ body, set }) => {
      try {
        const nodePlan = await createNodePlan(body);
        set.status = 201;
        return created(nodePlan, '套餐配置成功');
      } catch (error: any) {
        if (error.message === '节点不存在' || error.message === '套餐模板不存在') {
          set.status = 404;
          return errors.notFound(error.message);
        }
        if (error.message === '该节点已配置此套餐模板') {
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
        nodeId: t.Number({ minimum: 1 }),
        planTemplateId: t.Number({ minimum: 1 }),
        stock: t.Optional(t.Number({ minimum: -1 })),
        billingCycles: t.Array(BillingCycleSchema, { minItems: 1 }),
        status: t.Optional(t.Number({ default: 1 })),
        sortOrder: t.Optional(t.Number({ default: 0 })),
      }),
      detail: {
        summary: '给服务器配置套餐',
        description: '为指定服务器节点配置可售套餐，包含库存、定价、状态等配置',
      },
    },
  )
  // 更新节点套餐配置（POST）
  .post(
    '/update',
    async ({ body, set }) => {
      try {
        const { id, ...updateData } = body;
        const nodePlan = await updateNodePlan(Number(id), updateData);
        return success(nodePlan, '套餐配置更新成功');
      } catch (error: any) {
        if (error.message === '节点套餐不存在') {
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
        stock: t.Optional(t.Number({ minimum: -1 })),
        billingCycles: t.Optional(t.Array(BillingCycleSchema)),
        status: t.Optional(t.Number()),
        sortOrder: t.Optional(t.Number()),
      }),
      detail: {
        summary: '更新节点套餐配置',
        description: '更新节点套餐的库存、价格、状态等配置',
      },
    },
  )
  // 删除节点套餐（POST）
  .post(
    '/delete',
    async ({ body, set }) => {
      try {
        const { id } = body;
        const result = await deleteNodePlan(Number(id));
        return success(result, '套餐配置删除成功');
      } catch (error: any) {
        if (error.message === '节点套餐不存在') {
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
        summary: '删除节点套餐',
        description: '删除节点上的套餐配置',
      },
    },
  );
