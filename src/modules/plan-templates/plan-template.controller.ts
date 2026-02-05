/**
 * 套餐模板控制器
 *
 * @file plan-template.controller.ts
 * @description 套餐模板模块的API接口定义，仅管理员可访问
 */
import Elysia, { t } from 'elysia';
import { authPlugin } from '../../plugins/auth';
import { success, created, errors } from '../../utils/response';
import {
  getPlanTemplateList,
  createPlanTemplate,
  updatePlanTemplate,
  deletePlanTemplate,
  getPlanTemplateById,
} from './plan-template.service';

export const planTemplateController = new Elysia({
  prefix: '/admin/plan-templates',
  detail: { tags: ['套餐模板'] },
})
  .use(authPlugin)
  // 获取套餐模板列表（GET）
  .get(
    '/list',
    async ({ query }) => {
      const page = query.page ? Number(query.page) : 1;
      const pageSize = query.pageSize ? Number(query.pageSize) : 10;
      const keyword = query.keyword;

      const result = await getPlanTemplateList({
        page,
        pageSize,
        keyword,
      });

      return success(result);
    },
    {
      auth: ['admin'],
      query: t.Object({
        page: t.Optional(t.String()),
        pageSize: t.Optional(t.String()),
        keyword: t.Optional(t.String()),
      }),
      detail: {
        summary: '获取套餐模板列表',
        description: '支持分页、关键词搜索',
      },
    },
  )
  // 获取套餐模板详情（GET）
  .get(
    '/detail/:id',
    async ({ params, set }) => {
      try {
        const template = await getPlanTemplateById(Number(params.id));
        return success(template);
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
        summary: '获取套餐模板详情',
        description: '根据ID获取套餐模板详细信息',
      },
    },
  )
  // 创建套餐模板（POST）
  .post(
    '/create',
    async ({ body, set }) => {
      try {
        const template = await createPlanTemplate(body);
        set.status = 201;
        return created(template, '套餐模板创建成功');
      } catch (error: any) {
        set.status = 400;
        return errors.badRequest(error.message);
      }
    },
    {
      auth: ['admin'],
      body: t.Object({
        name: t.String({ minLength: 1, maxLength: 50 }),
        cpu: t.Number({ minimum: 1 }),
        ramMb: t.Number({ minimum: 128 }),
        diskGb: t.Number({ minimum: 1 }),
        trafficGb: t.Optional(t.Number({ minimum: 0 })),
        bandwidthMbps: t.Optional(t.Number({ minimum: 1 })),
        portCount: t.Optional(t.Number({ minimum: 1 })),
        remark: t.Optional(t.String()),
      }),
      detail: {
        summary: '创建套餐模板',
        description: '创建新的套餐模板',
      },
    },
  )
  // 更新套餐模板（POST）
  .post(
    '/update',
    async ({ body, set }) => {
      try {
        const { id, ...updateData } = body;
        const template = await updatePlanTemplate(Number(id), updateData);
        return success(template, '套餐模板更新成功');
      } catch (error: any) {
        if (error.message === '套餐模板不存在') {
          set.status = 404;
          return errors.notFound(error.message);
        }
        if (error.message.includes('正在被') && error.message.includes('使用')) {
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
        name: t.Optional(t.String({ minLength: 1, maxLength: 50 })),
        cpu: t.Optional(t.Number({ minimum: 1 })),
        ramMb: t.Optional(t.Number({ minimum: 128 })),
        diskGb: t.Optional(t.Number({ minimum: 1 })),
        trafficGb: t.Optional(t.Number({ minimum: 0 })),
        bandwidthMbps: t.Optional(t.Number({ minimum: 1 })),
        portCount: t.Optional(t.Number({ minimum: 1 })),
        remark: t.Optional(t.String()),
      }),
      detail: {
        summary: '更新套餐模板',
        description: '更新套餐模板信息。如果套餐正在被节点使用，则只能修改名称和备注',
      },
    },
  )
  // 删除套餐模板（POST）
  .post(
    '/delete',
    async ({ body, set }) => {
      try {
        const { id } = body;
        const result = await deletePlanTemplate(Number(id));
        return success(result, '套餐模板删除成功');
      } catch (error: any) {
        if (error.message === '套餐模板不存在') {
          set.status = 404;
          return errors.notFound(error.message);
        }
        if (error.message.includes('正在被') && error.message.includes('使用')) {
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
        summary: '删除套餐模板',
        description: '删除套餐模板',
      },
    },
  );
