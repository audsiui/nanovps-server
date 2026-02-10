import { eq } from "drizzle-orm";
import { db, users } from "../../db";
import type { User, UserRole, UserStatus } from "../../types/auth";

/**
 * 根据邮箱查找用户
 * @param email 用户邮箱
 * @returns 用户信息或 null
 */
export async function findByEmail(email: string): Promise<User | null> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!user) return null;

  return {
    ...user,
    role: (user.role ?? "user") as UserRole,
    status: (user.status ?? 1) as UserStatus,
  };
}

/**
 * 创建新用户
 * @param data 用户数据（邮箱和密码哈希）
 * @returns 创建的用户信息
 */
export async function createUser(data: {
  email: string;
  passwordHash: string;
}): Promise<User> {
  const [user] = await db
    .insert(users)
    .values({
      email: data.email,
      passwordHash: data.passwordHash,
    })
    .returning();

  return {
    ...user,
    role: (user.role ?? "user") as UserRole,
    status: (user.status ?? 1) as UserStatus,
  };
}

/**
 * 根据ID查找用户
 * @param id 用户ID
 * @returns 用户信息或 null
 */
export async function findById(id: number): Promise<User | null> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  if (!user) return null;

  return {
    ...user,
    role: (user.role ?? "user") as UserRole,
    status: (user.status ?? 1) as UserStatus,
  };
}

/**
 * 更新用户信息
 * @param id 用户ID
 * @param data 要更新的数据
 * @returns 更新后的用户信息
 */
export async function update(id: number, data: Partial<User>): Promise<User> {
  const [user] = await db
    .update(users)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(users.id, id))
    .returning();

  return {
    ...user,
    role: (user.role ?? "user") as UserRole,
    status: (user.status ?? 1) as UserStatus,
  };
}
