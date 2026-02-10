/**
 * 产品目录控制器
 *
 * @file catalog.controller.ts
 * @description 为前端应用端提供区域-节点-套餐的层级数据查询接口
 * 需要登录认证
 */
import Elysia, { t } from 'elysia';
import { authPlugin } from '../../plugins/auth';
import { success, errors } from '../../utils/response';
import {
  getCatalog,
  getCatalogByRegionId,
  getPlanDetail,
} from './catalog.service';

export const catalogController = new Elysia({
  prefix: '/catalog',
  detail: { tags: ['产品目录'] },
})
  .use(authPlugin)
  // 获取完整产品目录
  .get(
    '/',
    async () => {
      try {
        const catalog = await getCatalog();
        return success(catalog);
      } catch (error: any) {
        console.error('获取产品目录失败:', error);
        return errors.internal('获取产品目录失败');
      }
    },
    {
      auth: true,
      detail: {
        summary: '获取完整产品目录',
        description: '返回所有启用的区域及其在线节点和可售套餐的层级数据',
      },
    }
  )
  // 获取指定区域的产品目录
  .get(
    '/region/:id',
    async ({ params, set }) => {
      try {
        const catalog = await getCatalogByRegionId(Number(params.id));
        if (!catalog) {
          set.status = 404;
          return errors.notFound('区域不存在或已禁用');
        }
        return success(catalog);
      } catch (error: any) {
        console.error('获取区域产品目录失败:', error);
        return errors.internal('获取区域产品目录失败');
      }
    },
    {
      auth: true,
      params: t.Object({
        id: t.String(),
      }),
      detail: {
        summary: '获取指定区域的产品目录',
        description: '根据区域ID获取该区域下的节点和套餐信息',
      },
    }
  )
  // 获取套餐详情
  .get(
    '/plan/:id',
    async ({ params, set }) => {
      try {
        const plan = await getPlanDetail(Number(params.id));
        if (!plan) {
          set.status = 404;
          return errors.notFound('套餐不存在或已下架');
        }
        return success(plan);
      } catch (error: any) {
        console.error('获取套餐详情失败:', error);
        return errors.internal('获取套餐详情失败');
      }
    },
    {
      auth: true,
      params: t.Object({
        id: t.String(),
      }),
      detail: {
        summary: '获取套餐详情',
        description: '获取指定套餐的详细信息，包含模板配置、节点和区域信息',
      },
    }
  );
