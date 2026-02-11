import Elysia from 'elysia';
import { getAllNodesFromCache } from '../nodes/node-cache.service';
import {
  saveLatestReport,
  shouldSaveToDb,
  setLastDbTime,
  type AgentReport,
} from './report-cache.service';
import { saveReport, type ContainerData } from './report.repository';
import type { Node } from '../../db/schema/nodes';

// WebSocket 连接与节点的映射表
const wsNodeMap = new Map<string, Node>();

export const agentChannelController = new Elysia({
  prefix: '/agent',
  detail: { tags: ['Agent 消息通道'] },
}).ws('/', {
  async beforeHandle({ query, set }) {
    const agentToken = query.key?.toString();

    if (!agentToken) {
      set.status = 401;
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
      console.log(`[Agent] 节点已连接 [nodeId=${node.id}, name=${node.name}]`);
    }
  },

  async message(ws, message) {
    const node = wsNodeMap.get(ws.id);
    if (!node) {
      console.error(`[Agent] 无法找到节点信息 [ws.id=${ws.id}]`);
      return;
    }

    const report = message as AgentReport;

    // 只处理 report 类型的消息
    if (report.type !== 'report' || !report.data) {
      console.log(`[Agent] 收到非上报消息 [nodeId=${node.id}]:`, report);
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
      wsNodeMap.delete(ws.id);
    }
  },

  detail: {
    summary: 'Agent 消息通道',
    description:
      '节点 Agent 通过 WebSocket 连接上报消息，需提供 ?key=AGENT_TOKEN',
  },
});
