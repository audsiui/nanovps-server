/**
 * NAT 端口映射控制器
 *
 * @file nat-port.controller.ts
 * @description NAT 端口映射的 API 接口定义
 */
import Elysia, { t } from 'elysia';
import { authPlugin } from '../../plugins/auth';
import { success, errors } from '../../utils/response';
import {
  createPortMapping,
  createPortMappings,
  deletePortMapping,
} from './nat-port.service';
import { findByInstanceId } from './nat-port.repository';
import { getInstanceById } from '../instances/instance.service';
import { isNodeConnected } from '../agent-channel/command.service';

export const natPortController = new Elysia({
  prefix: '/nat-ports',
  detail: { tags: ['端口映射'] },
})
  .use(authPlugin)
  // 校验端口是否可用
  .get(
    '/validate',
    async ({ query, user, set }) => {
      try {
        const { instanceId, externalPort, protocol } = query;
        
        // 验证实例权限
        const instance = await getInstanceById(Number(instanceId), user.userId);
        
        // 检查端口范围（限制在 10000-50000）
        const extPort = Number(externalPort);
        if (extPort < 10000 || extPort > 50000) {
          set.status = 400;
          return errors.badRequest('外网端口必须在 10000-50000 之间');
        }
        
        // 检查节点是否在线
        if (!isNodeConnected(instance.nodeId)) {
          set.status = 503;
          return errors.badRequest('节点离线，无法校验端口');
        }
        
        // 检查端口是否被占用（排除当前实例）
        const { isPortOccupied } = await import('./nat-port.repository');
        const isOccupied = await isPortOccupied(instance.nodeId, extPort, protocol as 'tcp' | 'udp', Number(instanceId));
        
        return success({
          available: !isOccupied,
          message: isOccupied ? '端口已被占用' : '端口可用',
        });
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
      query: t.Object({
        instanceId: t.Number(),
        externalPort: t.Number({ minimum: 10000, maximum: 50000 }),
        protocol: t.Union([t.Literal('tcp'), t.Literal('udp')]),
      }),
      detail: {
        summary: '校验端口是否可用',
        description: '检查指定外部端口是否被占用（端口范围：10000-50000）',
      },
    }
  )
  // 获取实例的端口映射列表
  .get(
    '/instance/:instanceId',
    async ({ params, user, set }) => {
      try {
        // 验证实例权限
        await getInstanceById(Number(params.instanceId), user.userId);

        const mappings = await findByInstanceId(Number(params.instanceId));

        return success({
          list: mappings,
          total: mappings.length,
        });
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
        instanceId: t.String(),
      }),
      detail: {
        summary: '获取实例端口映射列表',
        description: '获取指定实例的所有 NAT 端口映射',
      },
    }
  )
  // 创建端口映射
  .post(
    '',
    async ({ body, user, set }) => {
      try {
        const { instanceId, protocol, internalPort, externalPort, description } =
          body as {
            instanceId: number;
            protocol: 'tcp' | 'udp' | 'both';
            internalPort: number;
            externalPort: number;
            description?: string;
          };

        // 如果是 both，使用批量创建
        const results = await createPortMappings(instanceId, user.userId, {
          protocol,
          internalPort,
          externalPort,
          description,
        });

        return success(results.length === 1 ? results[0] : results, '端口映射创建成功');
      } catch (error: any) {
        if (error.message === '实例不存在') {
          set.status = 404;
          return errors.notFound(error.message);
        }
        if (error.message === '无权操作此实例') {
          set.status = 403;
          return errors.forbidden(error.message);
        }
        if (
          error.message.includes('端口数量') ||
          error.message.includes('已被占用') ||
          error.message.includes('端口必须')
        ) {
          set.status = 400;
          return errors.badRequest(error.message);
        }
        set.status = 400;
        return errors.badRequest(error.message);
      }
    },
    {
      auth: true,
      body: t.Object({
        instanceId: t.Number(),
        protocol: t.Union([t.Literal('tcp'), t.Literal('udp'), t.Literal('both')]),
        internalPort: t.Number({ minimum: 1, maximum: 65535 }),
        externalPort: t.Number({ minimum: 10000, maximum: 50000 }),
        description: t.Optional(t.String({ maxLength: 50 })),
      }),
      detail: {
        summary: '创建端口映射',
        description: '为实例创建新的 NAT 端口映射，支持 TCP、UDP 或 TCP+UDP 同时创建',
      },
    }
  )
  // 删除端口映射
  .delete(
    '/:id',
    async ({ params, user, set }) => {
      try {
        await deletePortMapping(Number(params.id), user.userId);
        return success({ status: 'deleted' }, '端口映射已删除');
      } catch (error: any) {
        if (error.message === '端口映射不存在') {
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
        summary: '删除端口映射',
        description: '删除指定的 NAT 端口映射',
      },
    }
  );
