import { baseApp } from '../base/app';
import { authPlugin } from '../plugins/auth';
import { usersController } from '../modules/users/users.controller';
import { authController } from '../modules/auth/auth.controller';
import Elysia from 'elysia';

// 聚合所有路由，使用 baseApp 作为基础（已包含 JWT）
export const routes = new Elysia()
  .use(authPlugin)
  .use(authController)
  .use(usersController)
  .get('/health', () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
  }));
