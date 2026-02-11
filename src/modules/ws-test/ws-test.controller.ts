import Elysia from 'elysia';

export const wsTestController = new Elysia({
  prefix: '/ws',
  detail: { tags: ['WebSocket'] },
})
  .ws('/', {
    open(ws) {
      console.log('[WebSocket] 客户端已连接');
    },
    message(ws, message) {
      console.log('[WebSocket] 收到消息:', message);
    },
    close(ws) {
      console.log('[WebSocket] 客户端已断开');
    },
    detail: {
      summary: 'WebSocket 消息接收',
      description: '连接后发送的消息会被打印到控制台',
    },
  });
