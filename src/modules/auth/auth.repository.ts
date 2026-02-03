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
