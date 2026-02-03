import { Elysia } from 'elysia';

import { cors } from '@elysiajs/cors';
import { routes } from './routes';
import openapi from '@elysiajs/openapi';
import { errors } from './utils/response';
import jwt from '@elysiajs/jwt';
import { authController } from './modules/auth/auth.controller';

async function bootstrap() {
  const app = new Elysia()
    .use(
      jwt({
        name: 'jwt',
        secret: process.env.JWT_SECRET || 'CHANGE_ME_TO_STRONG_RANDOM',
        exp: '30m', // Access Token 30 分钟过期
      }),
    )
    .use(cors())
    .use(openapi())
    // 全局错误处理
    .onError(({ code, error, set }) => {
      if (code === 'VALIDATION') {
        set.status = 400;
        return errors.validation('请求参数错误');
      }

      if (code === 'NOT_FOUND') {
        set.status = 404;
        return errors.notFound('接口不存在');
      }

      set.status = 500;
      return errors.internal('服务器内部错误');
    })
    // 根路由
    .get('/', () => ({
      name: 'NanoVPS Server API',
      version: '1.0.0',
      status: 'running',
    }))

    // 挂载所有路由
    .use(routes)

    // 启动服务器
    .listen(3001);

  console.log(
    `🦊 Elysia is running at http://${app.server?.hostname}:${app.server?.port}`,
  );
  console.log(
    `📚 OpenAPI docs: http://${app.server?.hostname}:${app.server?.port}/openapi`,
  );

  return app;
}

bootstrap().catch(console.error);
