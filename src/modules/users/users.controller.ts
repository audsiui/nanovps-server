import { t } from "elysia";
import { createApp } from "../../base/app";
import { authPlugin } from "../../plugins/auth";
import { usersService } from "./users.service";
import { success, errors } from "../../utils/response";

export const usersController = createApp({
  prefix: "/users",
  detail: { tags: ["用户管理"] },
})
  .use(authPlugin)

  // 获取所有用户
  .get("/", async () => {
    const users = await usersService.getAllUsers();
    return success(users);
  }, {
    auth: { roles: ["admin"] },
    detail: {
      summary: "获取所有用户",
      description: "获取系统中所有用户列表，按创建时间倒序排列",
    },
  })

  // 获取单个用户
  .get("/:id", async ({ params, set }) => {
    const user = await usersService.getUserById(BigInt(params.id));
    if (!user) {
      set.status = 404;
      return errors.notFound("用户不存在");
    }
    return success(user);
  }, {
    auth: { roles: ["admin"] },
    params: t.Object({
      id: t.String(),
    }),
    detail: {
      summary: "获取单个用户",
      description: "根据用户ID获取用户详细信息",
    },
  })

  // 创建用户
  .post("/", async ({ body }) => {
    const user = await usersService.createUser(body);
    return success(user, "创建用户成功");
  }, {
    auth: { roles: ["admin"] },
    body: t.Object({
      email: t.String({ format: "email" }),
      password: t.String({ minLength: 6 }),
    }),
    detail: {
      summary: "创建用户",
      description: "管理员创建新用户，邮箱不可重复",
    },
  })

  // 更新用户
  .put("/:id", async ({ params, body, set }) => {
    const user = await usersService.updateUser(BigInt(params.id), body);
    if (!user) {
      set.status = 404;
      return errors.notFound("用户不存在");
    }
    return success(user, "更新用户成功");
  }, {
    auth: { roles: ["admin"] },
    params: t.Object({
      id: t.String(),
    }),
    body: t.Partial(
      t.Object({
        email: t.String({ format: "email" }),
        password: t.String({ minLength: 6 }),
        role: t.Union([t.Literal("user"), t.Literal("admin"), t.Literal("support")]),
        status: t.Union([t.Literal(1), t.Literal(0), t.Literal(-1)]),
        balance: t.String(),
      })
    ),
    detail: {
      summary: "更新用户",
      description: "更新用户信息，包括邮箱、密码、角色、状态、余额等",
    },
  })

  // 删除用户
  .delete("/:id", async ({ params, set }) => {
    const deleted = await usersService.deleteUser(BigInt(params.id));
    if (!deleted) {
      set.status = 404;
      return errors.notFound("用户不存在");
    }
    return success(null, "删除用户成功");
  }, {
    auth: { roles: ["admin"] },
    params: t.Object({
      id: t.String(),
    }),
    detail: {
      summary: "删除用户",
      description: "根据用户ID删除用户，此操作不可恢复",
    },
  });
