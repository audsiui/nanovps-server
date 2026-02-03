import { t } from "elysia";
import { createApp } from "../../base/app";
import { createToken } from "../../plugins/auth";
import { register, login } from "./auth.service";
import { success, created, errors } from "../../utils/response";

export const authController = createApp({
  prefix: "/auth",
  detail: { tags: ["认证"] },
})
  .post(
    "/register",
    async ({ body, set }) => {
      try {
        const user = await register(body);
        set.status = 201;
        return created(user, "注册成功");
      } catch (error: any) {
        set.status = 409;
        return errors.conflict(error.message);
      }
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
  .post(
    "/login",
    async ({ body, jwt, set }) => {
      try {
        const { user } = await login(body);

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
      } catch (error: any) {
        const message = error.message;
        if (message.includes("未激活") || message.includes("封禁")) {
          set.status = 403;
          return errors.forbidden(message);
        }
        set.status = 401;
        return errors.unauthorized(message);
      }
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
