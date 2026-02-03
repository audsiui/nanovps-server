import { Elysia, t } from "elysia";
import { usersService } from "./users.service";
import { authPlugin } from "../../plugins/auth";

export const usersController = new Elysia({ prefix: "/users" })
  .use(authPlugin)

  // 获取所有用户
  .get("/", async () => {
    const users = await usersService.getAllUsers();
    return { success: true, data: users };
  }, {
    auth: { roles: ["admin"] }
  })

  // 获取单个用户
  .get("/:id", async ({ params, set }) => {
    const user = await usersService.getUserById(BigInt(params.id));
    if (!user) {
      set.status = 404;
      return { success: false, error: "User not found" };
    }
    return { success: true, data: user };
  }, {
    auth: { roles: ["admin"] },
    params: t.Object({
      id: t.String(),
    }),
  })

  // 创建用户
  .post("/", async ({ body }) => {
    const user = await usersService.createUser(body);
    return { success: true, data: user };
  }, {
    auth: { roles: ["admin"] },
    body: t.Object({
      email: t.String({ format: "email" }),
      password: t.String({ minLength: 6 }),
    }),
  })

  // 更新用户
  .put("/:id", async ({ params, body, set }) => {
    const user = await usersService.updateUser(BigInt(params.id), body);
    if (!user) {
      set.status = 404;
      return { success: false, error: "User not found" };
    }
    return { success: true, data: user };
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
  })

  // 删除用户
  .delete("/:id", async ({ params, set }) => {
    const deleted = await usersService.deleteUser(BigInt(params.id));
    if (!deleted) {
      set.status = 404;
      return { success: false, error: "User not found" };
    }
    return { success: true, message: "User deleted" };
  }, {
    auth: { roles: ["admin"] },
    params: t.Object({
      id: t.String(),
    }),
  });
