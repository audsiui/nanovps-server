import { Elysia } from 'elysia';

import { cors } from '@elysiajs/cors';
import { initDatabase } from './db';
import { routes } from './routes';
import openapi from '@elysiajs/openapi';
import { errors } from './utils/response';

async function bootstrap() {
  // 初始化数据库（创建表）
  await initDatabase();

  const app = new Elysia()
    // 全局中间件
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
      return errors.internal(error.message);
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
    .listen(3000);

  console.log(
    `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
  );
  console.log(`📚 OpenAPI docs: http://localhost:3000/openapi`);

  return app;
}

bootstrap().catch(console.error);
