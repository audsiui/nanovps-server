import { authPlugin } from '../plugins/auth';
import { authController } from '../modules/auth/auth.controller';
import { regionController } from '../modules/regions/region.controller';
import { imageController } from '../modules/images/image.controller';
import { nodeController } from '../modules/nodes/node.controller';
import { planTemplateController } from '../modules/plan-templates/plan-template.controller';
import { nodePlanController } from '../modules/node-plans/node-plan.controller';
import { catalogController } from '../modules/catalog/catalog.controller';
import { promoCodeController } from '../modules/promo-codes/promo-code.controller';
import { orderController } from '../modules/orders/order.controller';
import { rechargeController } from '../modules/recharge/recharge.controller';
import { giftCodeController } from '../modules/gift-codes/gift-code.controller';
import { wsTestController } from '../modules/ws-test/ws-test.controller';
import Elysia from 'elysia';

export const routes = new Elysia()
  .use(authController)
  .use(regionController)
  .use(imageController)
  .use(nodeController)
  .use(planTemplateController)
  .use(nodePlanController)
  .use(catalogController)
  .use(promoCodeController)
  .use(giftCodeController)
  .use(orderController)
  .use(rechargeController)
  .use(wsTestController)
  .get('/health', () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
  }));
