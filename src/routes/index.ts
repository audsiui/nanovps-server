import { authPlugin } from '../plugins/auth';
import { authController } from '../modules/auth/auth.controller';
import Elysia from 'elysia';

export const routes = new Elysia()
  .use(authPlugin)
  .use(authController)
  .get('/health', () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
  }));
