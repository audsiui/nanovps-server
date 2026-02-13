/**
 * 实例控制器
 *
 * @file instance.controller.ts
 * @description 实例模块的 API 接口定义
 */
import Elysia, { t } from 'elysia';
import { authPlugin } from '../../plugins/auth';
import { success, errors } from '../../utils/response';
import {
  getInstanceById,
  getUserInstances,
  startInstance,
  stopInstance,
  restartInstance,
  deleteInstance,
  getContainerCreateParams,
  setContainerInfo,
  setInstanceError,
  generateRootPassword,
  InstanceStatus,
} from './instance.service';
import {
  sendContainerStartCommand,
  sendContainerStopCommand,
  sendContainerRestartCommand,
  sendContainerRemoveCommand,
  isNodeConnected,
} from '../agent-channel/command.service';
import { getContainerLatest } from '../agent-channel/report-cache.service';
import { findContainerHistory } from '../agent-channel/report.repository';
import { findById as findNodeById } from '../nodes/node.repository';
import { findById as findInstanceById } from './instance.repository';

export const instanceController = new Elysia({
  prefix: '/instances',
  detail: { tags: ['实例'] },
})
  .use(authPlugin)
  // 获取我的实例列表
  .get(
    '/my',
    async ({ query, user }) => {
      const page = query.page ? Number(query.page) : 1;
      const pageSize = query.pageSize ? Number(query.pageSize) : 10;
      const status = query.status ? Number(query.status) : undefined;

      const result = await getUserInstances({
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
        summary: '获取我的实例列表',
        description: '获取当前用户的 VPS 实例列表',
      },
    }
  )
  // 获取实例详情
  .get(
    '/:id',
    async ({ params, user, set }) => {
      try {
        const instance = await getInstanceById(Number(params.id), user.userId);
        return success(instance);
      } catch (error: any) {
        if (error.message === '实例不存在') {
          set.status = 404;
          return errors.notFound(error.message);
        }
        if (error.message === '无权访问此实例') {
          set.status = 403;
          return errors.forbidden(error.message);
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
        summary: '获取实例详情',
        description: '根据 ID 获取实例详细信息',
      },
    }
  )
  // 启动实例
  .post(
    '/:id/start',
    async ({ params, user, set }) => {
      try {
        const instance = await getInstanceById(Number(params.id), user.userId);

        if (!instance.containerId) {
          set.status = 400;
          return errors.badRequest('实例尚未创建完成');
        }

        if (instance.status === InstanceStatus.DESTROYED) {
          set.status = 400;
          return errors.badRequest('实例已销毁');
        }

        // 检查节点是否在线
        if (!isNodeConnected(instance.nodeId)) {
          set.status = 503;
          return errors.badRequest('节点离线，请稍后重试');
        }

        // 发送启动命令
        const result = await sendContainerStartCommand(instance.nodeId, instance.containerId);
        if (!result.success) {
          set.status = 500;
          return errors.internal(result.message || '启动失败');
        }

        // 更新状态
        await startInstance(instance.id);

        return success({ status: 'started' }, '实例已启动');
      } catch (error: any) {
        if (error.message === '实例不存在') {
          set.status = 404;
          return errors.notFound(error.message);
        }
        if (error.message === '无权访问此实例') {
          set.status = 403;
          return errors.forbidden(error.message);
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
        summary: '启动实例',
        description: '启动一个已停止的 VPS 实例',
      },
    }
  )
  // 停止实例
  .post(
    '/:id/stop',
    async ({ params, user, set }) => {
      try {
        const instance = await getInstanceById(Number(params.id), user.userId);

        if (!instance.containerId) {
          set.status = 400;
          return errors.badRequest('实例尚未创建完成');
        }

        if (instance.status === InstanceStatus.DESTROYED) {
          set.status = 400;
          return errors.badRequest('实例已销毁');
        }

        // 检查节点是否在线
        if (!isNodeConnected(instance.nodeId)) {
          set.status = 503;
          return errors.badRequest('节点离线，请稍后重试');
        }

        // 发送停止命令
        const result = await sendContainerStopCommand(instance.nodeId, instance.containerId);
        if (!result.success) {
          set.status = 500;
          return errors.internal(result.message || '停止失败');
        }

        // 更新状态
        await stopInstance(instance.id);

        return success({ status: 'stopped' }, '实例已停止');
      } catch (error: any) {
        if (error.message === '实例不存在') {
          set.status = 404;
          return errors.notFound(error.message);
        }
        if (error.message === '无权访问此实例') {
          set.status = 403;
          return errors.forbidden(error.message);
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
        summary: '停止实例',
        description: '停止一个运行中的 VPS 实例',
      },
    }
  )
  // 重启实例
  .post(
    '/:id/restart',
    async ({ params, user, set }) => {
      try {
        const instance = await getInstanceById(Number(params.id), user.userId);

        if (!instance.containerId) {
          set.status = 400;
          return errors.badRequest('实例尚未创建完成');
        }

        if (instance.status === InstanceStatus.DESTROYED) {
          set.status = 400;
          return errors.badRequest('实例已销毁');
        }

        // 检查节点是否在线
        if (!isNodeConnected(instance.nodeId)) {
          set.status = 503;
          return errors.badRequest('节点离线，请稍后重试');
        }

        // 发送重启命令
        const result = await sendContainerRestartCommand(instance.nodeId, instance.containerId);
        if (!result.success) {
          set.status = 500;
          return errors.internal(result.message || '重启失败');
        }

        return success({ status: 'restarted' }, '实例已重启');
      } catch (error: any) {
        if (error.message === '实例不存在') {
          set.status = 404;
          return errors.notFound(error.message);
        }
        if (error.message === '无权访问此实例') {
          set.status = 403;
          return errors.forbidden(error.message);
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
        summary: '重启实例',
        description: '重启一个 VPS 实例',
      },
    }
  )
  // 删除实例
  .delete(
    '/:id',
    async ({ params, user, set }) => {
      try {
        const instance = await getInstanceById(Number(params.id), user.userId);

        // 检查节点是否在线
        const nodeOnline = isNodeConnected(instance.nodeId);

        // 如果有容器且节点在线，先删除容器
        if (instance.containerId && nodeOnline) {
          const result = await sendContainerRemoveCommand(instance.nodeId, instance.containerId, true);
          if (!result.success) {
            console.warn(`[Instance] 删除容器失败 [id=${instance.id}]: ${result.message}`);
          }
        }

        // 软删除实例记录
        await deleteInstance(instance.id, user.userId);

        return success({ status: 'deleted' }, '实例已删除');
      } catch (error: any) {
        if (error.message === '实例不存在') {
          set.status = 404;
          return errors.notFound(error.message);
        }
        if (error.message === '无权操作此实例') {
          set.status = 403;
          return errors.forbidden(error.message);
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
        summary: '删除实例',
        description: '删除一个 VPS 实例（软删除）',
      },
    }
  )
  // 获取实例实时状态（Redis 热数据）
  .get(
    '/:id/status',
    async ({ params, user, set }) => {
      try {
        // 1. 查询实例
        const instance = await findInstanceById(Number(params.id));
        if (!instance) {
          set.status = 404;
          return errors.notFound('实例不存在');
        }

        // 2. 权限验证：只能查看自己的实例
        if (instance.userId !== user.userId) {
          set.status = 403;
          return errors.forbidden('无权访问此实例');
        }

        // 3. 检查实例是否有容器
        if (!instance.containerId) {
          return success({
            status: 'creating',
            message: '实例创建中',
            instanceStatus: instance.status,
          });
        }

        // 4. 查询节点获取 agentToken
        const node = await findNodeById(instance.nodeId);
        if (!node) {
          set.status = 500;
          return errors.internal('节点信息缺失');
        }

        // 5. 从 Redis 查询容器实时数据
        const containerData = await getContainerLatest(node.agentToken, instance.containerId);

        if (!containerData) {
          return success({
            status: 'offline',
            message: '节点离线或数据暂不可用',
            instanceStatus: instance.status,
          });
        }

        return success({
          status: 'online',
          instanceStatus: instance.status,
          containerId: containerData.id,
          containerName: containerData.name,
          timestamp: containerData.timestamp,
          cpuPercent: containerData.cpuPercent,
          memory: containerData.memory,
          network: containerData.network,
        });
      } catch (error: any) {
        console.error(`[Instance] 查询实时状态失败:`, error);
        set.status = 500;
        return errors.internal('查询失败');
      }
    },
    {
      auth: true,
      params: t.Object({
        id: t.String(),
      }),
      detail: {
        summary: '获取实例实时状态',
        description: '获取实例的实时监控数据（CPU、内存、网络），建议前端每 10-30 秒轮询一次',
      },
    }
  )
  // 获取实例历史监控数据
  .get(
    '/:id/history',
    async ({ params, query, user, set }) => {
      try {
        // 1. 查询实例
        const instance = await findInstanceById(Number(params.id));
        if (!instance) {
          set.status = 404;
          return errors.notFound('实例不存在');
        }

        // 2. 权限验证：只能查看自己的实例
        if (instance.userId !== user.userId) {
          set.status = 403;
          return errors.forbidden('无权访问此实例');
        }

        // 3. 检查实例是否有容器
        if (!instance.containerId) {
          return success({ list: [], total: 0 });
        }

        // 4. 计算时间范围（默认 24 小时）
        const endTime = query.endTime ? Number(query.endTime) : Date.now();
        const startTime = query.startTime ? Number(query.startTime) : endTime - 24 * 60 * 60 * 1000;

        // 5. 查询节点
        const node = await findNodeById(instance.nodeId);
        if (!node) {
          return success({ list: [], total: 0 });
        }

        // 6. 查询数据库历史数据
        const history = await findContainerHistory({
          agentId: node.agentToken,
          containerId: instance.containerId,
          startTime,
          endTime,
        });

        return success(history);
      } catch (error: any) {
        console.error(`[Instance] 查询历史数据失败:`, error);
        set.status = 500;
        return errors.internal('查询失败');
      }
    },
    {
      auth: true,
      params: t.Object({
        id: t.String(),
      }),
      query: t.Object({
        startTime: t.Optional(t.String()),
        endTime: t.Optional(t.String()),
      }),
      detail: {
        summary: '获取实例历史监控数据',
        description: '获取实例的历史监控数据，默认查询最近 24 小时',
      },
    }
  );
