// 用户角色
export type UserRole = 'user' | 'admin';

// 用户状态: 1=正常, 0=未验证, 2=封禁
export type UserStatus = 1 | 0 | 2;

// 用户模型（数据库字段映射为小驼峰）
export interface User {
  id: bigint;
  email: string;
  password_hash: string;
  balance: string;  // DECIMAL 在 JS 中转为 string 避免精度丢失
  currency: string;
  role: UserRole;
  status: UserStatus;
  apiKey: string | null;
  twoFactorAuth: string | null;
  lastLoginIp: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// 创建用户请求
export interface CreateUserRequest {
  email: string;
  password: string;
}

// 用户响应（不包含敏感字段，如 password_hash、twoFactorAuth）
export interface UserResponse {
  id: string;  // bigint 转为 string
  email: string;
  balance: string;
  currency: string;
  role: UserRole;
  status: UserStatus;
  apiKey: string | null;
  lastLoginIp: string | null;
  createdAt: Date;
  updatedAt: Date;
}
