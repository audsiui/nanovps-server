// 用户角色
export type UserRole = 'user' | 'admin' | 'support';

// 用户状态: 1=正常, 0=未验证, -1=封禁
export type UserStatus = 1 | 0 | -1;

// 用户模型
export interface User {
  id: bigint;
  email: string;
  password_hash: string;
  balance: string;  // DECIMAL 在 JS 中转为 string 避免精度丢失
  currency: string;
  role: UserRole;
  status: UserStatus;
  api_key: string | null;
  two_factor_auth: string | null;
  last_login_ip: string | null;
  created_at: Date;
  updated_at: Date;
}

// 创建用户请求
export interface CreateUserRequest {
  email: string;
  password: string;
}

// 用户响应（不包含敏感字段）
export interface UserResponse {
  id: bigint;
  email: string;
  balance: string;
  currency: string;
  role: UserRole;
  status: UserStatus;
  created_at: Date;
  updated_at: Date;
}
