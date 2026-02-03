import { sql } from "../../db";
import type { User } from "../../types/user";

export class UsersRepository {
  // 获取所有用户
  async findAll(): Promise<User[]> {
    return await sql<User[]>`SELECT * FROM users ORDER BY created_at DESC`;
  }

  // 根据 ID 获取用户
  async findById(id: bigint): Promise<User | null> {
    const [user] = await sql<User[]>`SELECT * FROM users WHERE id = ${id}`;
    return user || null;
  }

  // 根据邮箱获取用户
  async findByEmail(email: string): Promise<User | null> {
    const [user] = await sql<User[]>`SELECT * FROM users WHERE email = ${email}`;
    return user || null;
  }

  // 创建用户
  async create(data: { email: string; password_hash: string }): Promise<User> {
    const [user] = await sql<User[]>`
      INSERT INTO users (email, password_hash)
      VALUES (${data.email}, ${data.password_hash})
      RETURNING *
    `;
    return user;
  }

  // 更新用户
  async update(id: bigint, data: Partial<User>): Promise<User | null> {
    if (data.email !== undefined) {
      await sql`UPDATE users SET email = ${data.email} WHERE id = ${id}`;
    }

    if (data.password_hash !== undefined) {
      await sql`UPDATE users SET password_hash = ${data.password_hash} WHERE id = ${id}`;
    }

    if (data.role !== undefined) {
      await sql`UPDATE users SET role = ${data.role} WHERE id = ${id}`;
    }

    if (data.status !== undefined) {
      await sql`UPDATE users SET status = ${data.status} WHERE id = ${id}`;
    }

    if (data.balance !== undefined) {
      await sql`UPDATE users SET balance = ${data.balance} WHERE id = ${id}`;
    }

    // 更新 updated_at
    await sql`UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = ${id}`;

    return this.findById(id);
  }

  // 删除用户
  async delete(id: bigint): Promise<boolean> {
    const result = await sql`DELETE FROM users WHERE id = ${id}`;
    return result.count > 0;
  }
}

export const usersRepository = new UsersRepository();
