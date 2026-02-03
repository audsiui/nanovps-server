import { findByEmail, createUser } from "./auth.repository";
import type { User, UserResponse } from "../../types/user";

// 注册请求类型
export interface RegisterRequest {
  email: string;
  password: string;
}

// 登录请求类型
export interface LoginRequest {
  email: string;
  password: string;
}

// 注册响应类型
export interface RegisterResponse extends UserResponse {}

// 登录响应类型
export interface LoginResponse {
  user: UserResponse;
}

// 密码哈希
export async function hashPassword(password: string): Promise<string> {
  return Bun.password.hash(password, {
    algorithm: "bcrypt",
    cost: 10,
  });
}

// 验证密码
export async function verifyPassword(
  password: string,
  passwordHash: string
): Promise<boolean> {
  return Bun.password.verify(password, passwordHash);
}

// 用户注册
export async function register(data: RegisterRequest): Promise<RegisterResponse> {
  // 检查邮箱是否已存在
  const existingUser = await findByEmail(data.email);
  if (existingUser) {
    throw new Error("邮箱已被注册");
  }

  // 密码哈希
  const passwordHash = await hashPassword(data.password);

  // 创建用户
  const user = await createUser({
    email: data.email,
    password_hash: passwordHash,
  });

  return {
    id: user.id.toString(),
    email: user.email,
    balance: user.balance,
    currency: user.currency,
    role: user.role,
    status: user.status,
    apiKey: user.apiKey,
    lastLoginIp: user.lastLoginIp,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

// 用户登录
export async function login(data: LoginRequest): Promise<LoginResponse> {
  // 查找用户
  const user = await findByEmail(data.email);
  if (!user) {
    throw new Error("邮箱或密码错误");
  }

  // 验证密码
  const isPasswordValid = await verifyPassword(
    data.password,
    user.password_hash
  );

  if (!isPasswordValid) {
    throw new Error("邮箱或密码错误");
  }

  // 检查用户状态
  if (user.status === 0) {
    throw new Error("账号未激活，请联系管理员");
  }

  if (user.status === -1) {
    throw new Error("账号已被封禁");
  }

  const { password_hash, twoFactorAuth, ...userWithoutSensitive } = user;

  return {
    user: {
      ...userWithoutSensitive,
      id: user.id.toString(),
    },
  };
}
