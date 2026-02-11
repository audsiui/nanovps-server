import Elysia from 'elysia';
import { getAllNodesFromCache } from '../nodes/node-cache.service';


 export const agentChannelController = new Elysia({
  prefix: '/agent',
  detail: { tags: ['Agent 消息通道'] },
})
  .ws('/', {
    async beforeHandle({ query, set }) {
      const agentToken = query.key?.toString();

      if (!agentToken) {
        set.status = 401;
        return { error: 'Missing Agent Token' };
      }

      // 从 Redis 缓存查询节点（遍历所有缓存的节点匹配 agentToken）
      const nodes = await getAllNodesFromCache();
      const node = nodes.find(n => n.agentToken === agentToken);
      
      if (!node) {
        set.status = 401;
        return { error: 'Invalid Agent Token' };
      }

    },
    
    open(ws) {
      console.log(`[Agent] 节点已连接`);
    },
    
    message(ws, message) {
      console.log(`[Agent]:`, message);
    },
    
    close(ws) {
      console.log(`[Agent] 节点已断开`);
    },
    
    detail: {
      summary: 'Agent 消息通道',
      description: '节点 Agent 通过 WebSocket 连接上报消息，需提供 ?key=AGENT_TOKEN',
    },
  });;
