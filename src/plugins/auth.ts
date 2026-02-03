import { Elysia, t } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import type { UserRole } from '../types/user';

export interface JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}


interface AuthOptions {
  required?: boolean;
  roles?: UserRole[];
}

export const authPlugin = new Elysia({ name: 'auth/plugin' })
  .use(
    jwt({
      name: 'jwt',
      secret: process.env.JWT_SECRET || 'CHANGE_ME_TO_STRONG_RANDOM',
      exp: '7d',
    }),
  )
  .macro({
    auth: (options: AuthOptions | boolean = true) => {
      const opts: AuthOptions = typeof options === 'boolean' ? { required: options } : options;
      const { required = true, roles } = opts;

      return {
        async resolve(ctx) {
          const auth = ctx.headers['authorization'];

          // 可选鉴权：没有 token 则返回 undefined
          if (!required) {
            if (!auth?.startsWith('Bearer ')) {
              return { user: undefined };
            }
            const token = auth.split(' ')[1];
            const payload = await ctx.jwt.verify(token).catch(() => null);
            return { user: payload };
          }

          // 必须鉴权：检查 header 是否存在且格式正确
          if (!auth || !auth.startsWith('Bearer ')) {
            return ctx.status(401, {
              success: false,
              message: '请先登录',
            });
          }

          const token = auth.split(' ')[1];
          const payload = await ctx.jwt.verify(token).catch(() => null);

          if (!payload) {
            return ctx.status(401, {
              success: false,
              message: '登录已过期，请重新登录',
            });
          }

          const user = payload as unknown as JWTPayload;

          if (roles && !roles.includes(user.role)) {
            return ctx.status(403, {
              success: false,
              message: '权限不足，无法访问此资源',
            });
          }

          return { user };
        },
      };
    },
  });

export const createToken = async (
  jwt: {
    sign: (payload: Omit<JWTPayload, 'iat' | 'exp'>) => Promise<string>;
  },
  payload: Omit<JWTPayload, 'iat' | 'exp'>,
): Promise<string> => {
  return jwt.sign(payload);
};
