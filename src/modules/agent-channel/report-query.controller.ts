/**
 * Agent 上报数据查询控制器
 *
 * @file report-query.controller.ts
 * @description 提供 HTTP 接口供前端轮询查询实时数据（Host + Containers）
 */
import Elysia, { t } from 'elysia';
import { authPlugin } from '../../plugins/auth';
import { success, errors } from '../../utils/response';
import {
  getHostLatest,
  getAllContainersLatest,
  getAgentFullData,
  getContainerLatest,
} from './report-cache.service';

export const reportQueryController = new Elysia({
  prefix: '/admin/reports',
  detail: { tags: ['监控数据查询'] },
})
  .use(authPlugin)
  // 查询某 Agent 的完整实时数据（Host + Containers）
  .get(
    '/realtime/:agentId',
    async ({ params, query, set }) => {
      try {
        const { agentId } = params;
        const dataType = query.type || 'all'; // all | host | containers

        let result;

        switch (dataType) {
          case 'host':
            // 只查询主机数据
            const host = await getHostLatest(agentId);
            if (!host) {
              set.status = 404;
              return errors.notFound('未找到该 Agent 的主机数据');
            }
            result = { host };
            break;

          case 'containers':
            // 只查询容器数据
            const containers = await getAllContainersLatest(agentId);
            result = { containers };
            break;

          case 'all':
          default:
            // 查询全部数据
            const fullData = await getAgentFullData(agentId);
            if (!fullData.host) {
              set.status = 404;
              return errors.notFound('未找到该 Agent 的数据');
            }
            result = fullData;
            break;
        }

        return success(result);
      } catch (error: any) {
        console.error(`[ReportQuery] 查询实时数据失败:`, error);
        set.status = 500;
        return errors.internal('查询失败');
      }
    },
    {
      auth: false,
      params: t.Object({
        agentId: t.String({ minLength: 1 }),
      }),
      query: t.Object({
        type: t.Optional(t.Union([t.Literal('all'), t.Literal('host'), t.Literal('containers')])),
      }),
      detail: {
        summary: '查询 Agent 实时数据',
        description: '根据 agentId 查询实时数据，支持查询主机、容器或全部数据。前端建议每 10-30 秒轮询一次。',
      },
    }
  )
  // 查询单个容器的实时数据
  .get(
    '/realtime/:agentId/container/:containerId',
    async ({ params, set }) => {
      try {
        const { agentId, containerId } = params;

        const container = await getContainerLatest(agentId, containerId);

        if (!container) {
          set.status = 404;
          return errors.notFound('未找到该容器数据');
        }

        return success({ container });
      } catch (error: any) {
        console.error(`[ReportQuery] 查询容器数据失败:`, error);
        set.status = 500;
        return errors.internal('查询失败');
      }
    },
    {
      auth: false,
      params: t.Object({
        agentId: t.String({ minLength: 1 }),
        containerId: t.String({ minLength: 1 }),
      }),
      detail: {
        summary: '查询单个容器实时数据',
        description: '根据 agentId 和 containerId 查询特定容器的实时数据',
      },
    }
  )
  // 批量查询多个 Agent 的实时数据
  .post(
    '/realtime/batch',
    async ({ body, set }) => {
      try {
        const { agentIds, type = 'all' } = body;

        const results: Record<string, any> = {};

        for (const agentId of agentIds) {
          switch (type) {
            case 'host':
              const host = await getHostLatest(agentId);
              if (host) {
                results[agentId] = { host };
              }
              break;

            case 'containers':
              const containers = await getAllContainersLatest(agentId);
              results[agentId] = { containers };
              break;

            case 'all':
            default:
              const fullData = await getAgentFullData(agentId);
              if (fullData.host) {
                results[agentId] = fullData;
              }
              break;
          }
        }

        return success({
          count: Object.keys(results).length,
          data: results,
        });
      } catch (error: any) {
        console.error(`[ReportQuery] 批量查询失败:`, error);
        set.status = 500;
        return errors.internal('查询失败');
      }
    },
    {
      auth: false,
      body: t.Object({
        agentIds: t.Array(t.String({ minLength: 1 }), { minItems: 1, maxItems: 100 }),
        type: t.Optional(t.Union([t.Literal('all'), t.Literal('host'), t.Literal('containers')])),
      }),
      detail: {
        summary: '批量查询 Agent 实时数据',
        description: '一次性查询多个 Agent 的实时数据，减少前端轮询次数',
      },
    }
  );
