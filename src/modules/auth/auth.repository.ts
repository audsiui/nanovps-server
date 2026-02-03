import { sql } from "../../db";
import type { User } from "../../types/user";

// 根据邮箱查找用户
export async function findByEmail(email: string): Promise<User | null> {
  const [user] = await sql<User[]>`
    SELECT
      id,
      email,
      password_hash,
      balance,
      currency,
      role,
      status,
      api_key AS "apiKey",
      two_factor_auth AS "twoFactorAuth",
      last_login_ip AS "lastLoginIp",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM users
    WHERE email = ${email}
  `;
  return user || null;
}

// 创建用户
export async function createUser(data: {
  email: string;
  password_hash: string;
}): Promise<User> {
  const [user] = await sql<User[]>`
    INSERT INTO users (email, password_hash)
    VALUES (${data.email}, ${data.password_hash})
    RETURNING
      id,
      email,
      password_hash,
      balance,
      currency,
      role,
      status,
      api_key AS "apiKey",
      two_factor_auth AS "twoFactorAuth",
      last_login_ip AS "lastLoginIp",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
  `;
  return user;
}
