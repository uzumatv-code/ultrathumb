// =============================================================================
// ThumbForge AI — Authentication Middleware
// =============================================================================

import type { FastifyRequest, FastifyReply } from 'fastify';
import { UnauthorizedError } from '../errors/AppError.js';
import { cache } from '../../infrastructure/cache/redis.js';
import { hashToken } from '../utils/crypto.js';
import type { JwtPayload } from '@thumbforge/shared';
import { UserRole } from '@thumbforge/shared';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JwtPayload;
    user: JwtPayload;
  }
}

declare module 'fastify' {
  interface FastifyRequest {
    tenantId: string;
    requestId: string;
  }
}

export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    await request.jwtVerify();
    const payload = request.user as JwtPayload;

    // Check if token has been revoked
    const tokenHash = hashToken(
      request.headers.authorization?.replace('Bearer ', '') ?? '',
    );
    const isRevoked = await cache.isTokenRevoked(tokenHash);
    if (isRevoked) {
      throw new UnauthorizedError('Token has been revoked');
    }

    request.tenantId = payload.tenantId;
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      await reply.code(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: err.message },
      });
      return;
    }
    await reply.code(401).send({
      success: false,
      error: { code: 'TOKEN_INVALID', message: 'Invalid or expired token' },
    });
  }
}

// ─── RBAC Guards ──────────────────────────────────────────────────────────

export function requireRole(...roles: UserRole[]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const user = request.user as JwtPayload;
    if (!user || !roles.includes(user.role as UserRole)) {
      await reply.code(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Insufficient permissions' },
      });
    }
  };
}

export function requireSuperAdmin(request: FastifyRequest, reply: FastifyReply) {
  return requireRole(UserRole.SUPERADMIN)(request, reply);
}
