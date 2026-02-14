/**
 * 节点控制器
 *
 * @file node.controller.ts
 * @description 节点模块的API接口定义，仅管理员可访问
 * 只使用 GET 和 POST 请求：
 * - GET: 查询
 * - POST: 创建、更新
 */
import Elysia, { t } from 'elysia';
import { authPlugin } from '../../plugins/auth';
import { success, created, errors } from '../../utils/response';
import { createNode, updateNode, deleteNode, getNodeById, getNodeList, getNodeRealtime } from './node.service';

export const nodeController = new Elysia({
  prefix: '/admin/nodes',
  detail: { tags: ['节点管理'] },
})
  .use(authPlugin)
  // 创建节点（POST）
  .post(
    '/create',
    async ({ body, set }) => {
      try {
        const node = await createNode(body);
        set.status = 201;
        return created(node, '节点创建成功');
      } catch (error: any) {
        set.status = 409;
        return errors.conflict(error.message);
      }
    },
    {
      auth: ['admin'],
      body: t.Object({
        name: t.String({ minLength: 1, maxLength: 50 }),
        agentToken: t.String({ minLength: 1, maxLength: 64 }),
        ipv4: t.String({ minLength: 1, maxLength: 15 }),
        ipv6: t.Optional(t.String({ maxLength: 45 })),
        totalCpu: t.Number({ minimum: 1 }),
        totalRamMb: t.Number({ minimum: 1 }),
        allocatableDiskGb: t.Number({ minimum: 0 }),
        status: t.Number({ default: 1 }),
        regionId: t.Optional(t.Number()),
      }),
      detail: {
        summary: '创建节点',
        description: '创建新的服务器节点，所有字段必传（ipv6 可选）',
      },
    },
  )
  // 更新节点（POST）
  .post(
    '/update',
    async ({ body, set }) => {
      try {
        const { id, ...updateData } = body;
        const node = await updateNode(Number(id), updateData);
        return success(node, '节点更新成功');
      } catch (error: any) {
        if (error.message === '节点不存在') {
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
        agentToken: t.Optional(t.String({ minLength: 1, maxLength: 64 })),
        ipv4: t.Optional(t.String({ minLength: 1, maxLength: 15 })),
        ipv6: t.Optional(t.String({ maxLength: 45 })),
        totalCpu: t.Optional(t.Number({ minimum: 1 })),
        totalRamMb: t.Optional(t.Number({ minimum: 1 })),
        status: t.Optional(t.Number()),
        regionId: t.Optional(t.Number()),
      }),
      detail: {
        summary: '更新节点',
        description: '更新节点信息，id 必填，不可编辑硬盘容量',
      },
    },
  )
  // 获取节点详情（GET 查询）
  .get(
    '/detail/:id',
    async ({ params, set }) => {
      try {
        const node = await getNodeById(Number(params.id));
        return success(node);
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
        summary: '获取节点详情',
        description: '根据ID获取节点详细信息',
      },
    },
  )
  // 获取节点实时数据（GET）
  .get(
    '/realtime/:id',
    async ({ params, set }) => {
      try {
        const data = await getNodeRealtime(Number(params.id));
        return success(data);
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
        summary: '获取节点实时数据',
        description: '获取节点的实时监控数据（CPU、内存、网络、容器等）',
      },
    },
  )
  // 获取节点列表（GET）
  .get(
    '/list',
    async ({ query }) => {
      const page = query.page ? Number(query.page) : 1;
      const pageSize = query.pageSize ? Number(query.pageSize) : 10;
      const status = query.status ? Number(query.status) : undefined;
      const regionId = query.regionId ? Number(query.regionId) : undefined;
      const keyword = query.keyword;

      const result = await getNodeList({
        page,
        pageSize,
        status,
        regionId,
        keyword,
      });

      return success(result);
    },
    {
      auth: ['admin'],
      query: t.Object({
        page: t.Optional(t.String()),
        pageSize: t.Optional(t.String()),
        status: t.Optional(t.String()),
        regionId: t.Optional(t.String()),
        keyword: t.Optional(t.String()),
      }),
      detail: {
        summary: '获取节点列表',
        description: '支持分页、状态筛选、区域筛选、关键词搜索',
      },
    },
  )
  // 删除节点（POST）
  .post(
    '/delete',
    async ({ body, set }) => {
      try {
        await deleteNode(body.id);
        return success(null, '节点删除成功');
      } catch (error: any) {
        if (error.message === '节点不存在') {
          set.status = 404;
          return errors.notFound(error.message);
        }
        set.status = 500;
        return errors.internal(error.message);
      }
    },
    {
      auth: ['admin'],
      body: t.Object({
        id: t.Number(),
      }),
      detail: {
        summary: '删除节点',
        description: '根据ID删除节点',
      },
    },
  );
