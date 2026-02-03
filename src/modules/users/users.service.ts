import { usersRepository } from "./users.repository";
import type { User, UserResponse, CreateUserRequest } from "../../types/user";

// 排除敏感字段的用户响应
function toUserResponse(user: User): UserResponse {
  return {
    id: user.id,
    email: user.email,
    balance: user.balance,
    currency: user.currency,
    role: user.role,
    status: user.status,
    created_at: user.created_at,
    updated_at: user.updated_at,
  };
}

export class UsersService {
  // 获取所有用户
  async getAllUsers(): Promise<UserResponse[]> {
    const users = await usersRepository.findAll();
    return users.map(toUserResponse);
  }

  // 获取单个用户
  async getUserById(id: bigint): Promise<UserResponse | null> {
    const user = await usersRepository.findById(id);
    return user ? toUserResponse(user) : null;
  }

  // 创建用户
  async createUser(data: CreateUserRequest): Promise<UserResponse> {
    // 检查邮箱是否已存在
    const existingUser = await usersRepository.findByEmail(data.email);
    if (existingUser) {
      throw new Error("Email already exists");
    }

    // TODO: 使用 Argon2 或 BCrypt 对密码进行哈希
    const passwordHash = data.password;

    const user = await usersRepository.create({
      email: data.email,
      password_hash: passwordHash,
    });

    return toUserResponse(user);
  }

  // 更新用户
  async updateUser(
    id: bigint,
    data: Partial<CreateUserRequest> & { role?: string; status?: number; balance?: string }
  ): Promise<UserResponse | null> {
    const user = await usersRepository.findById(id);
    if (!user) {
      return null;
    }

    // 如果更新邮箱，检查是否已被其他用户使用
    if (data.email && data.email !== user.email) {
      const existingUser = await usersRepository.findByEmail(data.email);
      if (existingUser) {
        throw new Error("Email already exists");
      }
    }

    const updateData: Partial<User> = {
      email: data.email,
      role: data.role as User["role"],
      status: data.status as User["status"],
      balance: data.balance,
    };

    if (data.password) {
      // TODO: 使用 Argon2 或 BCrypt 对密码进行哈希
      updateData.password_hash = data.password;
    }

    const updatedUser = await usersRepository.update(id, updateData);
    return updatedUser ? toUserResponse(updatedUser) : null;
  }

  // 删除用户
  async deleteUser(id: bigint): Promise<boolean> {
    return await usersRepository.delete(id);
  }
}

export const usersService = new UsersService();
