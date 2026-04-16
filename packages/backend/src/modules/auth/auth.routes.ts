// =============================================================================
// ThumbForge AI — Auth Routes
// =============================================================================

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AuthService } from './auth.service.js';
import { authenticate } from '../../shared/middlewares/authenticate.js';
import { logger } from '../../shared/utils/logger.js';

const registerSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email().toLowerCase(),
  password: z.string().min(8).max(100).regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
    'Password must contain uppercase, lowercase and number',
  ),
  referralCode: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(1),
});

const forgotPasswordSchema = z.object({
  email: z.string().email().toLowerCase(),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(100),
});

export async function authRoutes(fastify: FastifyInstance): Promise<void> {
  const authService = new AuthService(fastify);

  // POST /auth/register
  fastify.post('/register', async (request, reply) => {
    const body = registerSchema.parse(request.body);
    const { user, tenant } = await authService.register(body);

    return reply.code(201).send({
      success: true,
      data: {
        message: 'Registration successful',
        userId: user.id,
        tenantId: tenant.id,
      },
    });
  });

  // POST /auth/login
  fastify.post('/login', async (request, reply) => {
    const body = loginSchema.parse(request.body);
    const ip = request.ip;
    const ua = request.headers['user-agent'];

    const result = await authService.login(body, ip, ua);

    // Set refresh token as httpOnly cookie
    reply.setCookie('refreshToken', result.refreshToken as string, {
      httpOnly: true,
      secure: process.env['NODE_ENV'] === 'production',
      sameSite: 'strict',
      path: '/api/auth/refresh',
      maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
    });

    return reply.send({
      success: true,
      data: {
        accessToken: result.accessToken,
        expiresIn: 900, // 15 minutes
      },
    });
  });

  // POST /auth/refresh
  fastify.post('/refresh', async (request, reply) => {
    const refreshToken = request.cookies?.['refreshToken'];
    if (!refreshToken) {
      return reply.code(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Refresh token not found' },
      });
    }

    const result = await authService.refreshAccessToken(refreshToken, request.ip);

    reply.setCookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env['NODE_ENV'] === 'production',
      sameSite: 'strict',
      path: '/api/auth/refresh',
      maxAge: 7 * 24 * 60 * 60,
    });

    return reply.send({
      success: true,
      data: {
        accessToken: result.accessToken,
        expiresIn: 900,
      },
    });
  });

  // POST /auth/logout
  fastify.post('/logout', { preHandler: [authenticate] }, async (request, reply) => {
    const accessToken = request.headers.authorization?.replace('Bearer ', '') ?? '';
    const refreshToken = request.cookies?.['refreshToken'];

    await authService.logout(accessToken, refreshToken);

    reply.clearCookie('refreshToken', { path: '/api/auth/refresh' });

    return reply.send({
      success: true,
      data: { message: 'Logged out successfully' },
    });
  });

  // POST /auth/forgot-password
  fastify.post('/forgot-password', async (request, reply) => {
    const { email } = forgotPasswordSchema.parse(request.body);
    await authService.requestPasswordReset(email);
    // Always return success (don't reveal if email exists)
    return reply.send({
      success: true,
      data: { message: 'If this email is registered, you will receive a reset link' },
    });
  });

  // POST /auth/reset-password
  fastify.post('/reset-password', async (request, reply) => {
    const body = resetPasswordSchema.parse(request.body);
    await authService.resetPassword(body.token, body.password);
    return reply.send({
      success: true,
      data: { message: 'Password reset successfully' },
    });
  });

  // GET /auth/me
  fastify.get('/me', { preHandler: [authenticate] }, async (request, reply) => {
    const user = await fastify.prisma.user.findUniqueOrThrow({
      where: { id: request.user.sub },
      select: {
        id: true,
        tenantId: true,
        name: true,
        email: true,
        role: true,
        status: true,
        avatarUrl: true,
        emailVerifiedAt: true,
        createdAt: true,
      },
    });

    return reply.send({ success: true, data: user });
  });
}
