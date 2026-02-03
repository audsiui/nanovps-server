/**
 * Token 服务
 * 处理 Access Token 和 Refresh Token 的生成、验证和管理
 * 使用 Bun 原生 Redis 客户端
 */

import { redis } from "../../db/redis";

// Refresh Token 配置
const REFRESH_TOKEN_PREFIX = 'auth:rt:';
const REFRESH_TOKEN_TTL = 7 * 24 * 60 * 60; // 7 天，单位：秒

// Refresh Token 存储的数据结构
interface RefreshTokenData {
  userId: string;
  email: string;
  role: string;
  ip?: string;
  device?: string;
  createdAt: string;
}

/**
 * 生成随机 Refresh Token (UUID v4)
 */
export function generateRefreshToken(): string {
  return crypto.randomUUID();
}

/**
 * 存储 Refresh Token 到 Redis
 * 使用 set + expire 实现带过期时间的存储
 */
export async function storeRefreshToken(
  refreshToken: string,
  data: RefreshTokenData,
): Promise<void> {
  const key = `${REFRESH_TOKEN_PREFIX}${refreshToken}`;
  const value = JSON.stringify(data);
  await redis.set(key, value);
  await redis.expire(key, REFRESH_TOKEN_TTL);
}

/**
 * 验证 Refresh Token 是否有效
 * 返回 token 数据，如果无效则返回 null
 */
export async function verifyRefreshToken(
  refreshToken: string,
): Promise<RefreshTokenData | null> {
  const key = `${REFRESH_TOKEN_PREFIX}${refreshToken}`;
  const value = await redis.get(key);

  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as RefreshTokenData;
  } catch {
    return null;
  }
}

/**
 * 删除 Refresh Token（登出或踢人）
 */
export async function revokeRefreshToken(refreshToken: string): Promise<void> {
  const key = `${REFRESH_TOKEN_PREFIX}${refreshToken}`;
  await redis.del(key);
}

/**
 * 删除用户的所有 Refresh Token（封号或强制下线所有设备）
 * 使用 SCAN 命令遍历匹配的键
 */
export async function revokeAllUserTokens(userId: string): Promise<void> {
  const pattern = `${REFRESH_TOKEN_PREFIX}*`;

  let cursor = '0';
  do {
    // 使用 send 执行原始 SCAN 命令
    const result = await redis.send('SCAN', [
      cursor,
      'MATCH',
      pattern,
      'COUNT',
      '100',
    ]) as [string, string[]];

    cursor = result[0];
    const keys = result[1];

    // 获取所有 token 并检查是否属于该用户
    for (const key of keys) {
      const value = await redis.get(key);
      if (value) {
        try {
          const data = JSON.parse(value) as RefreshTokenData;
          if (data.userId === userId) {
            await redis.del(key);
          }
        } catch {
          // 解析失败，跳过
        }
      }
    }
  } while (cursor !== '0');
}

/**
 * 获取用户的所有活跃 Token（用于查看登录设备）
 */
export async function getUserActiveTokens(
  userId: string,
): Promise<Array<{ refreshToken: string; data: RefreshTokenData }>> {
  const pattern = `${REFRESH_TOKEN_PREFIX}*`;
  const result: Array<{ refreshToken: string; data: RefreshTokenData }> = [];

  let cursor = '0';
  do {
    const scanResult = await redis.send('SCAN', [
      cursor,
      'MATCH',
      pattern,
      'COUNT',
      '100',
    ]) as [string, string[]];

    cursor = scanResult[0];
    const keys = scanResult[1];

    for (const key of keys) {
      const value = await redis.get(key);
      if (value) {
        try {
          const data = JSON.parse(value) as RefreshTokenData;
          if (data.userId === userId) {
            const refreshToken = key.replace(REFRESH_TOKEN_PREFIX, '');
            result.push({ refreshToken, data });
          }
        } catch {
          // 解析失败，跳过
        }
      }
    }
  } while (cursor !== '0');

  return result;
}

/**
 * 刷新 Refresh Token（Token Rotation 安全模式）
 * 删除旧 token，生成新 token
 */
export async function rotateRefreshToken(
  oldRefreshToken: string,
  data: RefreshTokenData,
): Promise<string> {
  // 删除旧 token
  await revokeRefreshToken(oldRefreshToken);

  // 生成新 token
  const newRefreshToken = generateRefreshToken();
  await storeRefreshToken(newRefreshToken, data);

  return newRefreshToken;
}

/**
 * 续期 Refresh Token（简单模式，不更换 token 值）
 */
export async function extendRefreshToken(
  refreshToken: string,
  data: RefreshTokenData,
): Promise<void> {
  const key = `${REFRESH_TOKEN_PREFIX}${refreshToken}`;
  const value = JSON.stringify(data);
  await redis.set(key, value);
  await redis.expire(key, REFRESH_TOKEN_TTL);
}

export { REFRESH_TOKEN_TTL, REFRESH_TOKEN_PREFIX };
export type { RefreshTokenData };
