/**
 * NAT 端口映射业务逻辑层
 *
 * @file nat-port.service.ts
 * @description NAT 端口映射的业务逻辑处理
 */
import {
  findById,
  findByInstanceId,
  findByNodeId,
  isPortOccupied,
  create,
  remove,
  countByInstanceId,
} from './nat-port.repository';
import { findById as findInstanceById } from '../instances/instance.repository';
import { findById as findNodeById } from '../nodes/node.repository';
import { findById as findPlanTemplateById } from '../plan-templates/plan-template.repository';
import { sendPortForwardCommand, sendPortUnforwardCommand, isNodeConnected } from '../agent-channel/command.service';
import type { NewNatPortMapping } from '../../db/schema';

/**
 * 创建端口映射
 */
export async function createPortMapping(
  instanceId: number,
  userId: number,
  data: {
    protocol: 'tcp' | 'udp';
    internalPort: number;
    externalPort: number;
    description?: string;
  },
  skipPortCheck: boolean = false // 批量创建时跳过端口检查
) {
  const instance = await findInstanceById(instanceId);
  if (!instance) {
    throw new Error('实例不存在');
  }
  if (instance.userId !== userId) {
    throw new Error('无权操作此实例');
  }

  // 检查实例状态
  if (instance.status === 6) {
    throw new Error('实例已销毁');
  }

  // 获取节点信息
  const node = await findNodeById(instance.nodeId);
  if (!node) {
    throw new Error('节点不存在');
  }

  // 获取套餐配置
  const plan = await findPlanTemplateById(instance.nodePlanId);
  if (!plan) {
    throw new Error('套餐配置不存在');
  }

  // 检查端口数量限制（SSH 端口不计入）
  const currentCount = await countByInstanceId(instanceId);
  const maxPorts = plan.portCount;

  if (maxPorts !== null && currentCount >= maxPorts) {
    throw new Error(`端口数量已达上限（当前套餐限制：${maxPorts}个）`);
  }

  // 检查外部端口是否被占用（排除当前实例）
  if (!skipPortCheck) {
    const occupied = await isPortOccupied(instance.nodeId, data.externalPort, data.protocol, instanceId);
    if (occupied) {
      throw new Error(`端口 ${data.externalPort} 已被占用`);
    }
  }

  // 验证端口范围（外网端口限制在 10000-50000）
  if (data.internalPort < 1 || data.internalPort > 65535) {
    throw new Error('内网端口必须在 1-65535 之间');
  }
  if (data.externalPort < 10000 || data.externalPort > 50000) {
    throw new Error('外网端口必须在 10000-50000 之间');
  }

  // 创建映射记录
  const mapping: NewNatPortMapping = {
    instanceId,
    nodeId: instance.nodeId,
    protocol: data.protocol,
    internalPort: data.internalPort,
    externalPort: data.externalPort,
    description: data.description,
  };

  const created = await create(mapping);

  // 同步到 Agent
  if (isNodeConnected(instance.nodeId)) {
    try {
      await sendPortForwardCommand(instance.nodeId, {
        protocol: data.protocol,
        port: data.externalPort,
        targetIp: instance.internalIp!,
        targetPort: data.internalPort,
        ipType: 'ipv4',
      });
    } catch (error: any) {
      console.error(`[NAT] 同步 Agent 失败：${error.message}`);
    }
  }

  return created;
}

/**
 * 批量创建端口映射（支持 TCP+UDP 同时创建）
 */
export async function createPortMappings(
  instanceId: number,
  userId: number,
  data: {
    protocol: 'tcp' | 'udp' | 'both';
    internalPort: number;
    externalPort: number;
    description?: string;
  }
) {
  const protocols: Array<'tcp' | 'udp'> = data.protocol === 'both' ? ['tcp', 'udp'] : [data.protocol];
  const results = [];
  
  // 先检查所有协议是否都可用
  const instance = await findInstanceById(instanceId);
  if (!instance) {
    throw new Error('实例不存在');
  }
  
  for (const protocol of protocols) {
    const occupied = await isPortOccupied(instance.nodeId, data.externalPort, protocol, instanceId);
    if (occupied) {
      throw new Error(`${protocol.toUpperCase()} 端口 ${data.externalPort} 已被占用`);
    }
  }
  
  // 都可用后再创建
  for (const protocol of protocols) {
    const result = await createPortMapping(instanceId, userId, {
      protocol,
      internalPort: data.internalPort,
      externalPort: data.externalPort,
      description: data.description,
    }, true); // 跳过端口检查，因为已经检查过了
    results.push(result);
  }
  
  return results;
}

/**
 * 删除端口映射
 */
export async function deletePortMapping(
  id: number,
  userId: number
) {
  const mapping = await findById(id);
  if (!mapping) {
    throw new Error('端口映射不存在');
  }

  const instance = await findInstanceById(mapping.instanceId);
  if (!instance) {
    throw new Error('实例不存在');
  }
  if (instance.userId !== userId) {
    throw new Error('无权操作此实例');
  }

  // 删除 Agent 上的规则
  if (isNodeConnected(mapping.nodeId)) {
    try {
      await sendPortUnforwardCommand(mapping.nodeId, {
        protocol: mapping.protocol,
        port: mapping.externalPort,
        targetIp: instance.internalIp!,
        targetPort: mapping.internalPort,
        ipType: 'ipv4',
      });
    } catch (error: any) {
      console.error(`[NAT] 删除 Agent 规则失败：${error.message}`);
    }
  }

  // 删除数据库记录
  await remove(id);

  return true;
}

/**
 * 同步实例的所有端口映射到 Agent（用于节点上线时）
 */
export async function syncInstancePortMappings(instanceId: number): Promise<void> {
  const instance = await findInstanceById(instanceId);
  if (!instance || !instance.internalIp) {
    return;
  }

  if (!isNodeConnected(instance.nodeId)) {
    return;
  }

  const mappings = await findByInstanceId(instanceId);

  for (const mapping of mappings) {
    try {
      await sendPortForwardCommand(instance.nodeId, {
        protocol: mapping.protocol,
        port: mapping.externalPort,
        targetIp: instance.internalIp,
        targetPort: mapping.internalPort,
        ipType: 'ipv4',
      });
    } catch (error: any) {
      console.error(`[NAT] 同步端口失败：${error.message}`);
    }
  }
}
