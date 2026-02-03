import Elysia, { t } from 'elysia';
import { authPlugin, createToken } from '../../plugins/auth';
import { register, login } from './auth.service';
import { success, created, errors } from '../../utils/response';
import {
  generateRefreshToken,
  storeRefreshToken,
  verifyRefreshToken,
  revokeRefreshToken,
  extendRefreshToken,
  revokeAllUserTokens,
  type RefreshTokenData,
} from './token.service';
import jwt from '@elysiajs/jwt';

const ACCESS_TOKEN_EXPIRES_IN = 30 * 60;

export const authController = new Elysia({
  prefix: '/auth',
  detail: { tags: ['认证'] },
})
  .use(
    jwt({
      name: 'jwt',
      secret: process.env.JWT_SECRET || 'CHANGE_ME_TO_STRONG_RANDOM',
      exp: '30m',
    }),
  )
  .use(authPlugin)  
  .post(
    '/register',
    async ({ body, set }) => {
      try {
        const user = await register(body);
        set.status = 201;
        return created(user, '注册成功');
      } catch (error: any) {
        set.status = 409;
        return errors.conflict(error.message);
      }
    },
    {
      body: t.Object({
        email: t.String({ format: 'email' }),
        password: t.String({ minLength: 6, maxLength: 32 }),
      }),
      detail: {
        summary: '用户注册',
        description: '用户注册账号，邮箱不可重复，密码最少6位',
      },
    },
  )
  .post(
    '/login',
    async ({ body, jwt, request, set }) => {
      try {
        const { user } = await login(body);

        const accessToken = await createToken(jwt, {
          userId: user.id.toString(),
          email: user.email,
          role: user.role,
        });

        const refreshToken = generateRefreshToken();

        const ip =
          request.headers.get('x-forwarded-for') ||
          request.headers.get('x-real-ip') ||
          'unknown';
        const userAgent = request.headers.get('user-agent') || 'unknown';

        await storeRefreshToken(refreshToken, {
          userId: user.id.toString(),
          email: user.email,
          role: user.role,
          ip: ip.toString(),
          device: userAgent,
          createdAt: new Date().toISOString(),
        });

        return success(
          {
            accessToken,
            refreshToken,
            expiresIn: ACCESS_TOKEN_EXPIRES_IN,
            user: {
              id: user.id.toString(),
              email: user.email,
              role: user.role,
              balance: user.balance,
              currency: user.currency,
            },
          },
          '登录成功',
        );
      } catch (error: any) {
        const message = error.message;
        if (message.includes('未激活') || message.includes('封禁')) {
          set.status = 403;
          return errors.forbidden(message);
        }
        set.status = 401;
        return errors.unauthorized(message);
      }
    },
    {
      body: t.Object({
        email: t.String({ format: 'email' }),
        password: t.String({ minLength: 6 }),
      }),
      detail: {
        summary: '用户登录',
        description: '用户登录获取 Access Token 和 Refresh Token',
      },
    },
  )
  .post(
    '/refresh',
    async ({ body, jwt, request, set }) => {
      try {
        const { refreshToken } = body;

        const tokenData = await verifyRefreshToken(refreshToken);
        if (!tokenData) {
          set.status = 401;
          return errors.unauthorized('Refresh Token 已过期或无效，请重新登录');
        }

        const accessToken = await createToken(jwt, {
          userId: tokenData.userId,
          email: tokenData.email,
          role: tokenData.role as 'user' | 'admin',
        });

        const ip =
          request.headers.get('x-forwarded-for') ||
          request.headers.get('x-real-ip') ||
          tokenData.ip ||
          'unknown';
        const userAgent =
          request.headers.get('user-agent') || tokenData.device || 'unknown';

        await extendRefreshToken(refreshToken, {
          userId: tokenData.userId,
          email: tokenData.email,
          role: tokenData.role,
          ip: ip.toString(),
          device: userAgent,
          createdAt: tokenData.createdAt,
        });

        return success(
          {
            accessToken,
            refreshToken,
            expiresIn: ACCESS_TOKEN_EXPIRES_IN,
          },
          '刷新成功',
        );
      } catch (error: any) {
        set.status = 500;
        return errors.internal(error.message);
      }
    },
    {
      body: t.Object({
        refreshToken: t.String(),
      }),
      detail: {
        summary: '刷新 Token',
        description:
          '使用 Refresh Token 换取新的 Access Token（Refresh Token 续期）',
      },
    },
  )
  .post(
    '/logout',
    async ({ body, set }) => {
      try {
        const { refreshToken } = body;

        await revokeRefreshToken(refreshToken);

        return success(null, '登出成功');
      } catch (error: any) {
        set.status = 500;
        return errors.internal(error.message);
      }
    },
    {
      body: t.Object({
        refreshToken: t.String(),
      }),
      auth:true,
      detail: {
        summary: '用户登出',
        description: '使 Refresh Token 失效，用户需要重新登录',
      },
    },
  )
  .post(
    '/logout-all',
    async ({ set,user }) => {
      try {
        await revokeAllUserTokens(user.userId);

        return success(null, '所有设备已登出');
      } catch (error: any) {
        set.status = 500;
        return errors.internal(error.message);
      }
    },
    { auth:true,
      detail: {
        summary: '登出所有设备',
        description:
          '使该用户的所有 Refresh Token 失效（封号、踢人、强制下线）',
      },
    },
  );
