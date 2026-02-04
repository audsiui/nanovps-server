import { authPlugin } from '../plugins/auth';
import { authController } from '../modules/auth/auth.controller';
import { regionController } from '../modules/regions/region.controller';
import { imageController } from '../modules/images/image.controller';
import Elysia from 'elysia';

export const routes = new Elysia()
  .use(authController)
  .use(regionController)
  .use(imageController)
  .get('/health', () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
  }));
