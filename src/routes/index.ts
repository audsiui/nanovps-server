import { authPlugin } from '../plugins/auth';
import { authController } from '../modules/auth/auth.controller';
import { regionController } from '../modules/regions/region.controller';
import { imageController } from '../modules/images/image.controller';
import { nodeController } from '../modules/nodes/node.controller';
import { planTemplateController } from '../modules/plan-templates/plan-template.controller';
import { nodePlanController } from '../modules/node-plans/node-plan.controller';
import Elysia from 'elysia';

export const routes = new Elysia()
  .use(authController)
  .use(regionController)
  .use(imageController)
  .use(nodeController)
  .use(planTemplateController)
  .use(nodePlanController)
  .get('/health', () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
  }));
