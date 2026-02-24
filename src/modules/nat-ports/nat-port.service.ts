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
  update,
  updateSyncStatus,
  remove,
  countByInstanceId,
} from './nat-port.repository';
import { findById as findInstanceById } from '../instances/instance.repository';
import { findById as findNodeById } from '../nodes/node.repository';
import { findById as findPlanTemplateById } from '../plan-templates/plan-template.repository';
import { sendPortForwardCommand, sendPortUnforwardCommand, isNodeConnected } from '../agent-channel/command.service';
import type { NewNatPortMapping } from '../../db/schema';

/**
 * 端口映射状态枚举
 */
export const NatPortStatus = {
  DISABLED: 0,
  ENABLED: 1,
  SYNCING: 2,
  SYNC_ERROR: 3,
} as const;

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
  }
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

  // 检查外部端口是否被占用
  const occupied = await isPortOccupied(instance.nodeId, data.externalPort);
  if (occupied) {
    throw new Error(`端口 ${data.externalPort} 已被占用`);
  }

  // 验证端口范围
  if (data.internalPort < 1 || data.internalPort > 65535) {
    throw new Error('内网端口必须在 1-65535 之间');
  }
  if (data.externalPort < 1 || data.externalPort > 65535) {
    throw new Error('外网端口必须在 1-65535 之间');
  }

  // 创建映射记录
  const mapping: NewNatPortMapping = {
    instanceId,
    nodeId: instance.nodeId,
    protocol: data.protocol,
    internalPort: data.internalPort,
    externalPort: data.externalPort,
    description: data.description,
    status: NatPortStatus.ENABLED,
    lastSyncedAt: null,
  };

  const created = await create(mapping);

  // 同步到 Agent
  if (isNodeConnected(instance.nodeId)) {
    try {
      const result = await sendPortForwardCommand(instance.nodeId, {
        protocol: data.protocol,
        port: data.externalPort,
        targetIp: instance.internalIp!,
        targetPort: data.internalPort,
        ipType: 'ipv4',
      });

      if (result.success) {
        await updateSyncStatus(created.id, NatPortStatus.ENABLED);
      } else {
        await updateSyncStatus(created.id, NatPortStatus.SYNC_ERROR, result.message);
      }
    } catch (error: any) {
      await updateSyncStatus(created.id, NatPortStatus.SYNC_ERROR, error.message);
    }
  } else {
    await updateSyncStatus(created.id, NatPortStatus.SYNC_ERROR, '节点离线');
  }

  return created;
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
      await updateSyncStatus(mapping.id, NatPortStatus.ENABLED);
    } catch (error: any) {
      await updateSyncStatus(mapping.id, NatPortStatus.SYNC_ERROR, error.message);
    }
  }
}
