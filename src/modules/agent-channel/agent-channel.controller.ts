import Elysia from 'elysia';
import { findByAgentToken } from '../nodes/node.repository';
import type { Node } from '../../db/schema/nodes';


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

      const node = await findByAgentToken(agentToken);
      
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
