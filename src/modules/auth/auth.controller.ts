import { t } from "elysia";
import { createApp } from "../../base/app";
import { createToken } from "../../plugins/auth";
import { usersRepository } from "../users/users.repository";
import { success, created, errors } from "../../utils/response";

export const authController = createApp({
  prefix: "/auth",
  detail: { tags: ["认证"] },
})

  // 用户注册
  .post(
    "/register",
    async ({ body, set }) => {
      // 检查邮箱是否已存在
      const existingUser = await usersRepository.findByEmail(body.email);
      if (existingUser) {
        set.status = 409;
        return errors.conflict("邮箱已被注册");
      }

      // 使用 Bun.password 进行密码哈希
      const passwordHash = await Bun.password.hash(body.password, {
        algorithm: "bcrypt",
        cost: 10,
      });

      // 创建用户
      const user = await usersRepository.create({
        email: body.email,
        password_hash: passwordHash,
      });

      set.status = 201;
      return created({
        id: user.id.toString(),
        email: user.email,
        role: user.role,
        created_at: user.created_at,
      }, "注册成功");
    },
    {
      body: t.Object({
        email: t.String({ format: "email" }),
        password: t.String({ minLength: 6, maxLength: 32 }),
      }),
      detail: {
        summary: "用户注册",
        description: "用户注册账号，邮箱不可重复，密码最少6位",
      },
    }
  )

  // 用户登录
  .post(
    "/login",
    async ({ body, jwt, set }) => {
      // 查找用户
      const user = await usersRepository.findByEmail(body.email);
      if (!user) {
        set.status = 401;
        return errors.unauthorized("邮箱或密码错误");
      }

      // 验证密码
      const isPasswordValid = await Bun.password.verify(
        body.password,
        user.password_hash
      );

      if (!isPasswordValid) {
        set.status = 401;
        return errors.unauthorized("邮箱或密码错误");
      }

      // 检查用户状态
      if (user.status === 0) {
        set.status = 403;
        return errors.forbidden("账号未激活，请联系管理员");
      }

      if (user.status === -1) {
        set.status = 403;
        return errors.forbidden("账号已被封禁");
      }

      // 生成 JWT token
      const token = await createToken(jwt, {
        userId: user.id.toString(),
        email: user.email,
        role: user.role,
      });

      return success({
        token,
        user: {
          id: user.id.toString(),
          email: user.email,
          role: user.role,
          balance: user.balance,
          currency: user.currency,
        },
      }, "登录成功");
    },
    {
      body: t.Object({
        email: t.String({ format: "email" }),
        password: t.String({ minLength: 6 }),
      }),
      detail: {
        summary: "用户登录",
        description: "用户登录获取 JWT Token，账号需要处于正常状态",
      },
    }
  );
