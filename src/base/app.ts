import { Elysia, type ElysiaConfig } from 'elysia';
import { jwt } from '@elysiajs/jwt';

// 创建带 JWT 的 App 工厂函数
export const createApp = (config?: ElysiaConfig<any>) =>
  new Elysia(config).use(
    jwt({
      name: 'jwt',
      secret: process.env.JWT_SECRET || 'CHANGE_ME_TO_STRONG_RANDOM',
      exp: '7d',
    }),
  );

// 基础应用实例（用于 routes）
export const baseApp = createApp();

// 导出类型
export type BaseApp = typeof baseApp;
