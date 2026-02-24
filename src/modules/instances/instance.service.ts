/**
 * 实例业务逻辑层
 *
 * @file instance.service.ts
 * @description 实例相关的业务逻辑处理
 */
import {
  findById,
  findByIdWithDetails,
  findByUserId,
  create,
  update,
  updateStatus,
  updateContainerInfo,
  softDelete,
  getUsedIpsByNodeId,
  findByNodeIdAndStatus,
} from './instance.repository';
import { findById as findNodePlanById } from '../node-plans/node-plan.repository';
import { findById as findImageById } from '../images/image.repository';
import { sendContainerCreateCommand, isNodeConnected, sendContainerRemoveCommand } from '../agent-channel/command.service';
import type { NewInstance, Instance } from '../../db/schema';
import { db, instances } from '../../db';
import { sql, eq } from 'drizzle-orm';

/**
 * 实例状态枚举
 */
export const InstanceStatus = {
  CREATING: 0,
  RUNNING: 1,
  STOPPED: 2,
  PAUSED: 3,
  ERROR: 4,
  DESTROYING: 5,
  DESTROYED: 6,
} as const;

/**
 * 网络配置常量
 */
const NETWORK_CONFIG = {
  name: 'vps-net',
  ipv4Base: '10.89.0',
  ipv6Base: 'fd00:dead:beef::',
  sshPortBase: 10000,
};

/**
 * 生成随机 hostname 后缀
 */
function generateHostnameSuffix(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * 生成随机密码
 */
function generatePassword(length = 12): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * 计算内网 IPv4 地址
 * 规则：10.89.0.(实例ID + 1)
 */
function calculateIPv4(instanceId: number): string {
  const lastOctet = instanceId + 1;
  if (lastOctet > 254) {
    throw new Error('IP 地址空间不足');
  }
  return `${NETWORK_CONFIG.ipv4Base}.${lastOctet}`;
}

/**
 * 计算内网 IPv6 地址
 * 规则：fd00:dead:beef::(实例ID + 1)
 */
function calculateIPv6(instanceId: number): string {
  const suffix = instanceId + 1;
  return `${NETWORK_CONFIG.ipv6Base}${suffix.toString(16)}`;
}

/**
 * 计算 SSH 端口
 * 规则：10000 + 实例ID
 */
function calculateSSHPort(instanceId: number): number {
  return NETWORK_CONFIG.sshPortBase + instanceId;
}

/**
 * 创建实例（供订单服务调用）
 * 注意：此函数只创建数据库记录，不实际创建容器
 */
export async function createInstance(params: {
  userId: number;
  nodeId: number;
  nodePlanId: number;
  imageId: number;
  expiresAt: Date;
}): Promise<Instance> {
  const { userId, nodeId, nodePlanId, imageId, expiresAt } = params;

  // 验证套餐是否存在
  const nodePlan = await findNodePlanById(nodePlanId);
  if (!nodePlan) {
    throw new Error('套餐不存在');
  }

  // 验证镜像是否存在
  const image = await findImageById(imageId);
  if (!image) {
    throw new Error('镜像不存在');
  }
  if (!image.isActive) {
    throw new Error('镜像已下架');
  }

  // 先插入一条临时记录获取 ID
  const tempHostname = `vps-${generateHostnameSuffix()}`;
  
  const instanceData: NewInstance = {
    userId,
    nodeId,
    nodePlanId,
    imageId,
    name: tempHostname,
    hostname: tempHostname,
    cpu: 1,
    ramMb: 512,
    diskGb: 10,
    status: InstanceStatus.CREATING,
    expiresAt,
  };

  // 插入数据库获取 ID
  const [newInstance] = await db
    .insert(instances)
    .values(instanceData)
    .returning();

  // 使用 ID 计算 IP 和端口
  const instanceId = newInstance.id;
  const internalIp = calculateIPv4(instanceId);
  const sshPort = calculateSSHPort(instanceId);

  // 更新记录（填入正确的 IP 和端口，以及套餐的资源配置）
  const [updatedInstance] = await db
    .update(instances)
    .set({
      internalIp,
      sshPort,
      // 从套餐模板获取资源配置
      cpu: sql`(SELECT cpu FROM plan_templates WHERE id = (SELECT plan_template_id FROM node_plans WHERE id = ${nodePlanId}))`,
      ramMb: sql`(SELECT ram_mb FROM plan_templates WHERE id = (SELECT plan_template_id FROM node_plans WHERE id = ${nodePlanId}))`,
      diskGb: sql`(SELECT disk_gb FROM plan_templates WHERE id = (SELECT plan_template_id FROM node_plans WHERE id = ${nodePlanId}))`,
      trafficGb: sql`(SELECT traffic_gb FROM plan_templates WHERE id = (SELECT plan_template_id FROM node_plans WHERE id = ${nodePlanId}))`,
      bandwidthMbps: sql`(SELECT bandwidth_mbps FROM plan_templates WHERE id = (SELECT plan_template_id FROM node_plans WHERE id = ${nodePlanId}))`,
      updatedAt: new Date(),
    })
    .where(eq(instances.id, instanceId))
    .returning();

  return updatedInstance;
}

/**
 * 获取实例详情
 */
export async function getInstanceById(id: number, userId?: number): Promise<any> {
  const instance = await findByIdWithDetails(id);
  if (!instance) {
    throw new Error('实例不存在');
  }

  // 如果指定了 userId，验证所有权
  if (userId !== undefined && instance.userId !== userId) {
    throw new Error('无权访问此实例');
  }

  return instance;
}

/**
 * 获取用户实例列表
 */
export async function getUserInstances(params: {
  userId: number;
  page: number;
  pageSize: number;
  status?: number;
}) {
  const { page = 1, pageSize = 10 } = params;

  if (page < 1) {
    throw new Error('页码不能小于1');
  }
  if (pageSize < 1 || pageSize > 100) {
    throw new Error('每页数量范围为1-100');
  }

  const { list, total } = await findByUserId(params);

  return {
    list,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

/**
 * 更新实例容器信息（Agent 创建成功后调用）
 */
export async function setContainerInfo(
  instanceId: number,
  containerId: string,
  internalIp: string
): Promise<Instance> {
  const instance = await findById(instanceId);
  if (!instance) {
    throw new Error('实例不存在');
  }

  const updated = await updateContainerInfo(instanceId, { containerId, internalIp });
  if (!updated) {
    throw new Error('更新实例失败');
  }

  return updated;
}

/**
 * 设置实例为错误状态
 */
export async function setInstanceError(instanceId: number, errorMessage?: string): Promise<Instance> {
  const instance = await findById(instanceId);
  if (!instance) {
    throw new Error('实例不存在');
  }

  const updated = await updateStatus(instanceId, InstanceStatus.ERROR);
  if (!updated) {
    throw new Error('更新实例状态失败');
  }

  return updated;
}

/**
 * 获取实例的容器创建参数（供 Agent 命令使用）
 */
export async function getContainerCreateParams(instanceId: number): Promise<{
  nodeId: number;
  containerName: string;
  imageRef: string;
  hostname: string;
  memory: number;
  cpus: number;
  sshPort: number;
  internalIp: string;
  internalIp6: string;
  network: string;
  diskGb: number;
}> {
  const instance = await findByIdWithDetails(instanceId);
  if (!instance) {
    throw new Error('实例不存在');
  }

  if (!instance.image) {
    throw new Error('实例镜像信息缺失');
  }

  return {
    nodeId: instance.nodeId,
    containerName: `user-${instance.userId}-${instance.id}`,
    imageRef: instance.image.imageRef,
    hostname: instance.hostname || `vps-${instance.id}`,
    memory: instance.ramMb * 1024 * 1024,
    cpus: instance.cpu,
    sshPort: calculateSSHPort(instance.id),
    internalIp: instance.internalIp || calculateIPv4(instance.id),
    internalIp6: calculateIPv6(instance.id),
    network: NETWORK_CONFIG.name,
    diskGb: instance.diskGb,
  };
}

/**
 * 生成实例的 root 密码
 */
export function generateRootPassword(): string {
  return generatePassword(12);
}

/**
 * 启动实例（只更新状态，实际操作由 controller 调用 agent）
 */
export async function startInstance(instanceId: number): Promise<Instance> {
  const instance = await findById(instanceId);
  if (!instance) {
    throw new Error('实例不存在');
  }
  if (instance.status === InstanceStatus.CREATING) {
    throw new Error('实例正在创建中');
  }
  if (instance.status === InstanceStatus.DESTROYED) {
    throw new Error('实例已销毁');
  }

  const updated = await update(instanceId, {
    status: InstanceStatus.RUNNING,
    lastStartedAt: new Date(),
  });
  
  if (!updated) {
    throw new Error('启动实例失败');
  }
  
  return updated;
}

/**
 * 停止实例（只更新状态）
 */
export async function stopInstance(instanceId: number): Promise<Instance> {
  const instance = await findById(instanceId);
  if (!instance) {
    throw new Error('实例不存在');
  }

  const updated = await updateStatus(instanceId, InstanceStatus.STOPPED);
  if (!updated) {
    throw new Error('停止实例失败');
  }
  
  return updated;
}

/**
 * 重启实例（状态保持 RUNNING）
 */
export async function restartInstance(instanceId: number): Promise<Instance> {
  const instance = await findById(instanceId);
  if (!instance) {
    throw new Error('实例不存在');
  }
  if (instance.status !== InstanceStatus.RUNNING) {
    throw new Error('只有运行中的实例才能重启');
  }

  return instance;
}

/**
 * 删除实例（软删除）
 */
export async function deleteInstance(instanceId: number, userId: number): Promise<Instance> {
  const instance = await findById(instanceId);
  if (!instance) {
    throw new Error('实例不存在');
  }
  if (instance.userId !== userId) {
    throw new Error('无权操作此实例');
  }

  const updated = await softDelete(instanceId);
  if (!updated) {
    throw new Error('删除实例失败');
  }
  
  return updated;
}


/**
 * 重试节点上待创建的实例
 * 当节点上线时调用，为所有 CREATING 状态的实例触发容器创建
 */
export async function retryPendingInstances(nodeId: number): Promise<void> {
  const pendingInstances = await findByNodeIdAndStatus(nodeId, [InstanceStatus.CREATING, InstanceStatus.ERROR]);
  
  if (pendingInstances.length === 0) {
    return;
  }
  
  console.log(`[Instance] 发现 ${pendingInstances.length} 个待创建实例 [nodeId=${nodeId}]`);
  
  for (const instance of pendingInstances) {
    triggerContainerCreationForInstance(instance.id, nodeId).catch((err) => {
      console.error(`[Instance] 容器创建失败 [instanceId=${instance.id}]:`, err);
    });
  }
}

/**
 * 为单个实例触发容器创建
 */
async function triggerContainerCreationForInstance(instanceId: number, nodeId: number): Promise<void> {
  try {
    const params = await getContainerCreateParams(instanceId);
    const rootPassword = generateRootPassword();
    
    const result = await sendContainerCreateCommand(nodeId, {
      name: params.containerName,
      image: params.imageRef,
      hostname: params.hostname,
      memory: params.memory,
      memorySwap: params.memory * 2,
      storageOpt: `size=${params.diskGb}G`,
      cpus: params.cpus,
      sshPort: params.sshPort,
      network: params.network,
      ip: params.internalIp,
      ip6: params.internalIp6,
      env: {
        ROOT_PASSWORD: rootPassword,
      },
      restartPolicy: 'always',
    });
    
    if (result.success && result.containerId) {
      await setContainerInfo(instanceId, result.containerId, params.internalIp);
      console.log(`[Instance] 容器创建成功 [instanceId=${instanceId}, containerId=${result.containerId}]`);
      
      // 创建 SSH 端口映射
      try {
        const { create, countByInstanceId } = await import('../nat-ports/nat-port.repository');
        const { NatPortStatus } = await import('../nat-ports/nat-port.service');
        const { sendPortForwardCommand } = await import('../agent-channel/command.service');
        
        const existingCount = await countByInstanceId(instanceId);
        if (existingCount === 0) {
          await create({
            instanceId,
            nodeId,
            protocol: 'tcp',
            internalPort: 22,
            externalPort: params.sshPort,
            description: 'SSH',
            status: NatPortStatus.ENABLED,
            lastSyncedAt: new Date(),
          });
        }
        
        await sendPortForwardCommand(nodeId, {
          protocol: 'tcp',
          port: params.sshPort,
          targetIp: params.internalIp,
          targetPort: 22,
          ipType: 'ipv4',
        });
        
        console.log(`[Instance] SSH 端口映射已创建 [instanceId=${instanceId}]`);
      } catch (error: any) {
        console.error(`[Instance] 创建 SSH 端口映射失败：${error.message}`);
      }
    } else {
      await setInstanceError(instanceId, result.message);
      console.error(`[Instance] 容器创建失败 [instanceId=${instanceId}]: ${result.message}`);
    }
  } catch (error: any) {
    await setInstanceError(instanceId, error.message);
    console.error(`[Instance] 容器创建异常 [instanceId=${instanceId}]:`, error);
  }
}


/**
 * 重装实例
 * @param instanceId 实例 ID
 * @param userId 用户 ID
 * @param options 重装选项
 */
export async function reinstallInstance(
  instanceId: number,
  userId: number,
  options: {
    imageId: number;
    password?: string;
  }
): Promise<Instance> {
  const instance = await findById(instanceId);
  if (!instance) {
    throw new Error('实例不存在');
  }
  if (instance.userId !== userId) {
    throw new Error('无权操作此实例');
  }
  if (instance.status === InstanceStatus.DESTROYED) {
    throw new Error('实例已销毁');
  }

  const nodeId = instance.nodeId;

  const newImage = await findImageById(options.imageId);
  if (!newImage) {
    throw new Error('镜像不存在');
  }
  await update(instanceId, { imageId: options.imageId });

  const rootPassword = options.password || generateRootPassword();

  const params = await getContainerCreateParams(instanceId);

  if (instance.containerId) {
    const isOnline = isNodeConnected(nodeId);
    if (isOnline) {
      await sendContainerRemoveCommand(nodeId, instance.containerId, true);
    }
  }

  const result = await sendContainerCreateCommand(nodeId, {
    name: params.containerName,
    image: params.imageRef,
    hostname: params.hostname,
    memory: params.memory,
    memorySwap: params.memory * 2,
    storageOpt: `size=${params.diskGb}G`,
    cpus: params.cpus,
    sshPort: params.sshPort,
    network: params.network,
    ip: params.internalIp,
    ip6: params.internalIp6,
    env: {
      ROOT_PASSWORD: rootPassword,
    },
    restartPolicy: 'always',
  });

  if (result.success && result.containerId) {
    await setContainerInfo(instanceId, result.containerId, params.internalIp);
    
    // 重新创建 SSH 端口映射（因为容器内网 IP 可能变化）
    try {
      const { create, countByInstanceId } = await import('../nat-ports/nat-port.repository');
      const { NatPortStatus } = await import('../nat-ports/nat-port.service');
      const { sendPortForwardCommand } = await import('../agent-channel/command.service');
      
      // 检查是否已有 SSH 端口映射
      const existingCount = await countByInstanceId(instanceId);
      if (existingCount === 0) {
        // 没有端口映射，创建 SSH 端口
        await create({
          instanceId,
          nodeId,
          protocol: 'tcp',
          internalPort: 22,
          externalPort: params.sshPort,
          description: 'SSH',
          status: NatPortStatus.ENABLED,
          lastSyncedAt: new Date(),
        });
      }
      
      // 无论是否有记录，都重新设置 iptables 规则（确保 IP 正确）
      await sendPortForwardCommand(nodeId, {
        protocol: 'tcp',
        port: params.sshPort,
        targetIp: params.internalIp,
        targetPort: 22,
        ipType: 'ipv4',
      });
      
      console.log(`[Instance] SSH 端口映射已重新设置 [instanceId=${instanceId}]`);
    } catch (error: any) {
      console.error(`[Instance] 重新设置 SSH 端口映射失败：${error.message}`);
    }
  } else {
    throw new Error(result.message || '重装失败');
  }

  const updated = await findById(instanceId);
  if (!updated) {
    throw new Error('重装后查询实例失败');
  }

  return updated;
}
