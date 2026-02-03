import { Elysia } from 'elysia';
import { usersController } from '../modules/users/users.controller';
import { authPlugin } from '../plugins/auth';

// 聚合所有路由
export const routes = new Elysia()
  .use(usersController)
  .get('/health', () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
  }));
