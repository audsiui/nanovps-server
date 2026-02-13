/**
 * Agent 命令下发服务
 *
 * @file command.service.ts
 * @description 管理 Agent WebSocket 连接，发送命令并处理响应
 */
import { randomUUID } from 'crypto';
import { ServerWebSocket } from 'elysia/dist/ws/bun';

/**
 * Agent 动作类型（与 agent 项目保持一致）
 */
export type AgentAction =
  | 'container:create'
  | 'container:start'
  | 'container:stop'
  | 'container:restart'
  | 'container:remove'
  | 'container:remove-force'
  | 'agent:upgrade'
  | 'agent:restart'
  | 'net:forward'
  | 'net:unforward';

/**
 * 服务端下发的命令
 */
export interface ServerCommand {
  type: 'cmd';
  id: string;
  action: AgentAction;
  payload: any;
}

/**
 * Agent 响应
 */
export interface CommandResponse {
  type: 'response';
  refId: string;
  success: boolean;
  message?: string;
  data?: any;
}

/**
 * 创建容器参数（与 agent 项目保持一致）
 */
export interface CreateContainerPayload {
  name: string;
  image: string;
  hostname?: string;
  memory?: number;
  memorySwap?: number;
  storageOpt?: string;
  cpus?: number;
  pidsLimit?: number;
  sshPort?: number;
  network?: string;
  ip?: string;
  ip6?: string;
  env?: Record<string, string>;
  userns?: string;
  restartPolicy?: string;
}

/**
 * 端口转发参数
 */
export interface PortForwardPayload {
  protocol: 'tcp' | 'udp' | 'all';
  port: number;
  targetIp: string;
  targetPort?: number;
  ipType: 'ipv4' | 'ipv6' | 'all';
}

// 节点连接映射表
const nodeConnections = new Map<number, ServerWebSocket<any>>();

// 等待响应的 Promise 映射表
const pendingResponses = new Map<string, {
  resolve: (value: CommandResponse) => void;
  reject: (reason: any) => void;
  timeout: Timer;
}>();

// 命令超时时间（毫秒）
const COMMAND_TIMEOUT = 60000;

/**
 * 注册节点 WebSocket 连接
 */
export function registerNodeConnection(nodeId: number, ws: ServerWebSocket<any>): void {
  nodeConnections.set(nodeId, ws);
  console.log(`[Command] 节点连接已注册 [nodeId=${nodeId}]`);
}

/**
 * 注销节点 WebSocket 连接
 */
export function unregisterNodeConnection(nodeId: number): void {
  nodeConnections.delete(nodeId);
  // 清理该节点所有等待中的命令
  for (const [cmdId, pending] of pendingResponses) {
    if (pending.timeout) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('节点连接已断开'));
      pendingResponses.delete(cmdId);
    }
  }
  console.log(`[Command] 节点连接已注销 [nodeId=${nodeId}]`);
}

/**
 * 检查节点是否在线
 */
export function isNodeConnected(nodeId: number): boolean {
  return nodeConnections.has(nodeId);
}

/**
 * 处理 Agent 响应
 * 由 agent-channel.controller 调用
 */
export function handleCommandResponse(response: CommandResponse): void {
  const pending = pendingResponses.get(response.refId);
  if (!pending) {
    console.warn(`[Command] 收到未知命令的响应 [refId=${response.refId}]`);
    return;
  }

  clearTimeout(pending.timeout);
  pendingResponses.delete(response.refId);
  pending.resolve(response);
}

/**
 * 发送命令到指定节点
 */
export async function sendCommand<T = any>(
  nodeId: number,
  action: AgentAction,
  payload: any
): Promise<{ success: boolean; data?: T; message?: string }> {
  const ws = nodeConnections.get(nodeId);
  if (!ws) {
    return {
      success: false,
      message: `节点 ${nodeId} 未连接`,
    };
  }

  const commandId = randomUUID();
  const command: ServerCommand = {
    type: 'cmd',
    id: commandId,
    action,
    payload,
  };

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      pendingResponses.delete(commandId);
      console.warn(`[Command] 命令超时 [nodeId=${nodeId}, action=${action}, cmdId=${commandId}]`);
      resolve({
        success: false,
        message: '命令执行超时',
      });
    }, COMMAND_TIMEOUT);

    pendingResponses.set(commandId, {
      resolve: (response: CommandResponse) => {
        resolve({
          success: response.success,
          data: response.data,
          message: response.message,
        });
      },
      reject: (error: any) => {
        resolve({
          success: false,
          message: error.message || '命令执行失败',
        });
      },
      timeout,
    });

    // 发送命令
    ws.send(JSON.stringify(command));
    console.log(`[Command] 命令已发送 [nodeId=${nodeId}, action=${action}, cmdId=${commandId}]`);
  });
}

/**
 * 创建容器命令
 */
export async function sendContainerCreateCommand(
  nodeId: number,
  options: CreateContainerPayload
): Promise<{ success: boolean; containerId?: string; containerName?: string; message?: string }> {
  const result = await sendCommand<{ id: string; name: string }>(nodeId, 'container:create', options);
  
  return {
    success: result.success,
    containerId: result.data?.id,
    containerName: result.data?.name,
    message: result.message,
  };
}

/**
 * 启动容器命令
 */
export async function sendContainerStartCommand(
  nodeId: number,
  containerId: string
): Promise<{ success: boolean; message?: string }> {
  return sendCommand(nodeId, 'container:start', { containerId });
}

/**
 * 停止容器命令
 */
export async function sendContainerStopCommand(
  nodeId: number,
  containerId: string
): Promise<{ success: boolean; message?: string }> {
  return sendCommand(nodeId, 'container:stop', { containerId });
}

/**
 * 重启容器命令
 */
export async function sendContainerRestartCommand(
  nodeId: number,
  containerId: string
): Promise<{ success: boolean; message?: string }> {
  return sendCommand(nodeId, 'container:restart', { containerId });
}

/**
 * 删除容器命令
 */
export async function sendContainerRemoveCommand(
  nodeId: number,
  containerId: string,
  force: boolean = false
): Promise<{ success: boolean; message?: string }> {
  return sendCommand(nodeId, force ? 'container:remove-force' : 'container:remove', { containerId });
}

/**
 * 设置端口转发命令
 */
export async function sendPortForwardCommand(
  nodeId: number,
  options: PortForwardPayload
): Promise<{ success: boolean; message?: string }> {
  return sendCommand(nodeId, 'net:forward', options);
}

/**
 * 移除端口转发命令
 */
export async function sendPortUnforwardCommand(
  nodeId: number,
  options: PortForwardPayload
): Promise<{ success: boolean; message?: string }> {
  return sendCommand(nodeId, 'net:unforward', options);
}

/**
 * 获取所有在线节点 ID
 */
export function getConnectedNodeIds(): number[] {
  return Array.from(nodeConnections.keys());
}
