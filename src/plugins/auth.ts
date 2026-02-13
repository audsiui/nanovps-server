import Elysia from 'elysia';
import type { UserRole } from '../types/auth';
import { errors } from '../utils/response';
import jwt from '@elysiajs/jwt';

export interface JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

export const authPlugin = new Elysia({ name: 'auth/plugin' })
  .use(
    jwt({
      name: 'jwt',
      secret: process.env.JWT_SECRET || 'CHANGE_ME_TO_STRONG_RANDOM',
      exp: '30m',
    }),
  )
  .macro({
    auth: (options: UserRole[] | boolean = true) => {
      // 如果 auth 为 false，跳过鉴权
      if (options === false) {
        return undefined;
      }

      const roles = Array.isArray(options) ? options : undefined;

      return {
        async resolve({ headers, jwt, status }) {
          const auth = headers['authorization'];

          if (!auth?.startsWith('Bearer ')) {
            return status(401, errors.unauthorized('请先登录'));
          }

          const token = auth.split(' ')[1];
          const payload = await jwt.verify(token).catch(() => null);

          if (!payload) {
            return status(401, errors.unauthorized('登录已过期，请重新登录'));
          }

          const user = payload as unknown as JWTPayload;

          if (roles && !roles.includes(user.role)) {
            return status(403, errors.forbidden('权限不足，无法访问此资源'));
          }

          return {
            user: {
              ...user,
              userId: Number(user.userId),
            },
          };
        },
      };
    },
  })

export const createToken = async (
  jwt: {
    sign: (payload: Omit<JWTPayload, 'iat' | 'exp'>) => Promise<string>;
  },
  payload: Omit<JWTPayload, 'iat' | 'exp'>,
): Promise<string> => {
  return jwt.sign(payload);
};
