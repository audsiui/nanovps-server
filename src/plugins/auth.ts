import type { UserRole } from '../types/auth';
import { errors } from '../utils/response';
import { createApp } from '../base/app';

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

// 使用 baseApp 创建，包含 JWT
export const authPlugin = createApp({ name: 'auth/plugin' })
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
            return ctx.status(401, errors.unauthorized('请先登录'));
          }

          const token = auth.split(' ')[1];
          const payload = await ctx.jwt.verify(token).catch(() => null);

          if (!payload) {
            return ctx.status(401, errors.unauthorized('登录已过期，请重新登录'));
          }

          const user = payload as unknown as JWTPayload;

          if (roles && !roles.includes(user.role)) {
            return ctx.status(403, errors.forbidden('权限不足，无法访问此资源'));
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
