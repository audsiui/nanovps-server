import Elysia from 'elysia';
import { getAllNodesFromCache } from '../nodes/node-cache.service';
import {
  saveLatestReport,
  shouldSaveToDb,
  setLastDbTime,
  type AgentReport,
} from './report-cache.service';
import { saveReport, type ContainerData } from './report.repository';
import {
  registerNodeConnection,
  unregisterNodeConnection,
  handleCommandResponse,
  type CommandResponse,
} from './command.service';
import { retryPendingInstances } from '../instances/instance.service';
import type { Node } from '../../db/schema/nodes';

// WebSocket 连接与节点的映射表
const wsNodeMap = new Map<string, Node>();

export const agentChannelController = new Elysia({
  prefix: '/agent',
  detail: { tags: ['Agent 消息通道'] },
}).ws('/ws', {
  async beforeHandle({ query, set }) {
    const agentToken = query.key?.toString();

    if (!agentToken) {
      set.status = 401;
      console.log("未检测到key")
      return { error: 'Missing Agent Token' };
    }

    // 从 Redis 缓存查询节点（遍历所有缓存的节点匹配 agentToken）
    const nodes = await getAllNodesFromCache();
    const node = nodes.find((n) => n.agentToken === agentToken);

    if (!node) {
      set.status = 401;
      return { error: 'Invalid Agent Token' };
    }

    // 验证通过，不传递数据
  },

  async open(ws) {
    const agentToken = ws.data.query.key || '';

    // 查询节点信息
    const nodes = await getAllNodesFromCache();
    const node = nodes.find((n) => n.agentToken === agentToken);

    if (node) {
      wsNodeMap.set(ws.id, node);
      // 注册到命令服务，支持下行命令
      registerNodeConnection(node.id, ws);
      console.log(`[Agent] 节点已连接 [nodeId=${node.id}, name=${node.name}]`);
      
      // 重试待创建的实例
      retryPendingInstances(node.id).catch((err) => {
        console.error(`[Agent] 重试待创建实例失败 [nodeId=${node.id}]:`, err);
      });
    }
  },

  async message(ws, message: any) {
    const node = wsNodeMap.get(ws.id);
    if (!node) {
      console.error(`[Agent] 无法找到节点信息 [ws.id=${ws.id}]`);
      return;
    }

    // 处理命令响应
    if (message.type === 'response') {
      handleCommandResponse(message as CommandResponse);
      return;
    }

    // 处理上报消息
    const report = message as AgentReport;
    if (report.type !== 'report' || !report.data) {
      console.log(`[Agent] 收到未知类型消息 [nodeId=${node.id}]:`, report);
      return;
    }

    const { agentId, timestamp, host, containers } = report.data;

    console.log(
      `[Agent] 收到上报 [nodeId=${node.id}, agentId=${agentId}, timestamp=${timestamp}]`,
    );

    try {
      // 1. 无条件更新 Redis（热数据）
      await saveLatestReport(agentId, report);

      // 2. 判断是否需要入库（10 分钟节流）
      const shouldSave = await shouldSaveToDb(agentId, timestamp);

      if (shouldSave) {
        // 3. 保存到数据库（主机数据存 JSONB，容器数据存独立表）
        await saveReport(
          {
            nodeId: node.id,
            agentId,
            timestamp,
            hostSnapshot: host,
          },
          containers as ContainerData[]
        );

        // 4. 更新入库时间戳
        await setLastDbTime(agentId, timestamp);

        console.log(
          `[Agent] 数据已入库 [nodeId=${node.id}, agentId=${agentId}]`,
        );
      }
    } catch (error) {
      console.error(`[Agent] 处理上报数据失败 [nodeId=${node.id}]:`, error);
    }
  },

  close(ws) {
    const node = wsNodeMap.get(ws.id);
    if (node) {
      console.log(`[Agent] 节点已断开 [nodeId=${node.id}, name=${node.name}]`);
      // 从命令服务注销
      unregisterNodeConnection(node.id);
      wsNodeMap.delete(ws.id);
    }
  },

  detail: {
    summary: 'Agent 消息通道',
    description:
      '节点 Agent 通过 WebSocket 连接上报消息，需提供 ?key=AGENT_TOKEN',
  },
});
