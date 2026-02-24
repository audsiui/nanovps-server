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
  deletePortMapping,
  NatPortStatus,
} from './nat-port.service';
import { findByInstanceId } from './nat-port.repository';
import { getInstanceById } from '../instances/instance.service';

export const natPortController = new Elysia({
  prefix: '/nat-ports',
  detail: { tags: ['端口映射'] },
})
  .use(authPlugin)
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
            protocol: 'tcp' | 'udp';
            internalPort: number;
            externalPort: number;
            description?: string;
          };

        const mapping = await createPortMapping(instanceId, user.userId, {
          protocol,
          internalPort,
          externalPort,
          description,
        });

        return success(mapping, '端口映射创建成功');
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
        protocol: t.Union([t.Literal('tcp'), t.Literal('udp')]),
        internalPort: t.Number({ minimum: 1, maximum: 65535 }),
        externalPort: t.Number({ minimum: 1, maximum: 65535 }),
        description: t.Optional(t.String({ maxLength: 50 })),
      }),
      detail: {
        summary: '创建端口映射',
        description: '为实例创建新的 NAT 端口映射',
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
