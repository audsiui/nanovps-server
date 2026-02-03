import { Elysia } from 'elysia';

import { cors } from '@elysiajs/cors';
import { initDatabase, sql } from './db';
import { routes } from './routes';
import openapi from '@elysiajs/openapi';

async function bootstrap() {
  // 初始化数据库（创建表）
  await initDatabase();

  const app = new Elysia()
    // 全局中间件
    .use(cors())
    .use(openapi())
    // 全局错误处理
    .onError(({ code, error, set }) => {
      set.status = code === 'VALIDATION' ? 400 : 500;

      return {
        success: false,
        message: error.message || '服务器内部错误',
        code,
      };
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
