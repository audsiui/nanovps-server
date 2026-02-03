import type { User as DbUser } from "../db/schema";

// 用户角色
export type UserRole = "user" | "admin";

// 用户状态: 1=正常, 0=未验证, 2=封禁
export type UserStatus = 1 | 0 | 2;

/**
 * 用户模型
 * 基于 Drizzle ORM 推断类型，role 和 status 使用具体枚举类型
 */
export type User = Omit<DbUser, "role" | "status"> & {
  role: UserRole;
  status: UserStatus;
};

// 创建用户请求
export interface CreateUserRequest {
  email: string;
  password: string;
}

// 用户响应（不包含敏感字段，如 passwordHash、twoFactorAuth，id转为string）
export type UserResponse = Omit<User, "id" | "passwordHash" | "twoFactorAuth"> & {
  id: string;
};

// 登录请求
export interface LoginRequest {
  email: string;
  password: string;
}

// 登录响应
export interface LoginResponse {
  user: UserResponse;
  token?: string;
}

// Token 响应（双 Token 模式）
export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // Access Token 过期时间（秒）
}

// 登录响应（双 Token 模式）
export interface LoginWithTokensResponse extends TokenResponse {
  user: UserResponse;
}
