// =============================================================================
// ThumbForge AI — Auth Service
// =============================================================================

import bcrypt from 'bcrypt';
import { prisma } from '../../infrastructure/database/client.js';
import { cache } from '../../infrastructure/cache/redis.js';
import {
  generateToken,
  hashToken,
  generateReferralCode,
} from '../../shared/utils/crypto.js';
import {
  UnauthorizedError,
  NotFoundError,
  ConflictError,
  ForbiddenError,
} from '../../shared/errors/AppError.js';
import { logger } from '../../shared/utils/logger.js';
import type { JwtPayload, LoginRequest, RegisterRequest } from '@thumbforge/shared';
import { UserRole, UserStatus } from '@thumbforge/shared';
import type { FastifyInstance } from 'fastify';

const BCRYPT_ROUNDS = parseInt(process.env['BCRYPT_ROUNDS'] ?? '12');
const REFRESH_TOKEN_DAYS = 7;

interface AuthLoginResult {
  accessToken: string;
  refreshToken: string;
  sessionId: string;
  user: Awaited<ReturnType<typeof prisma.user.findFirstOrThrow>>;
}

export class AuthService {
  constructor(private readonly fastify: FastifyInstance) {}

  async register(data: RegisterRequest & { referralCode?: string | undefined }) {
    // Check if email already exists (cross-tenant, email must be globally unique per tenant)
    // For B2C: each user is their own tenant
    const existing = await prisma.user.findFirst({
      where: { email: data.email, deletedAt: null },
    });
    if (existing) {
      throw new ConflictError('Email already registered');
    }

    const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);
    const referralCode = generateReferralCode();

    // Find referrer if referral code provided
    let referredByUserId: string | undefined;
    if (data.referralCode) {
      const referrer = await prisma.user.findFirst({
        where: { referralCode: data.referralCode, deletedAt: null },
      });
      if (referrer) referredByUserId = referrer.id;
    }

    // Create tenant (B2C: 1 user = 1 tenant)
    const slug = this.generateTenantSlug(data.email);
    const tenant = await prisma.tenant.create({
      data: {
        name: data.name,
        slug,
        status: 'ACTIVE',
      },
    });

    const requireVerification =
      process.env['EMAIL_VERIFICATION_REQUIRED'] === 'true';

    const user = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        name: data.name,
        email: data.email,
        passwordHash,
        role: 'USER',
        status: requireVerification ? 'PENDING_VERIFICATION' : 'ACTIVE',
        referralCode,
        referredByUserId: referredByUserId ?? null,
        emailVerifiedAt: requireVerification ? null : new Date(),
      },
    });

    // Initialize usage counter for current month
    const now = new Date();
    await prisma.usageCounter.create({
      data: {
        tenantId: tenant.id,
        periodYear: now.getFullYear(),
        periodMonth: now.getMonth() + 1,
        generationsUsed: 0,
        generationsLimit: 30,
      },
    });

    logger.info({ userId: user.id, tenantId: tenant.id }, 'User registered');

    return { user, tenant };
  }

  async login(
    data: LoginRequest,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuthLoginResult> {
    const user = await prisma.user.findFirst({
      where: { email: data.email, deletedAt: null },
    });

    if (!user) {
      throw new UnauthorizedError('Invalid credentials');
    }

    if (user.status === UserStatus.SUSPENDED) {
      throw new ForbiddenError('Account suspended');
    }

    const isValidPassword = await bcrypt.compare(data.password, user.passwordHash);
    if (!isValidPassword) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const { accessToken, refreshToken, sessionId } = await this.generateTokens(user);

    // Store refresh token hash
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_DAYS);

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(refreshToken),
        sessionId,
        ipAddress: ipAddress ?? null,
        userAgent: userAgent ?? null,
        expiresAt,
      },
    });

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    logger.info({ userId: user.id, tenantId: user.tenantId }, 'User logged in');

    return { accessToken, refreshToken, sessionId, user };
  }

  async refreshAccessToken(
    refreshToken: string,
    ipAddress?: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const tokenHash = hashToken(refreshToken);

    const storedToken = await prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!storedToken || storedToken.usedAt || storedToken.revokedAt) {
      // Token reuse detected — revoke all tokens for this user (security measure)
      if (storedToken) {
        await prisma.refreshToken.updateMany({
          where: { userId: storedToken.userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        logger.warn({ userId: storedToken.userId }, 'Refresh token reuse detected — all tokens revoked');
      }
      throw new UnauthorizedError('Invalid refresh token');
    }

    if (storedToken.expiresAt < new Date()) {
      throw new UnauthorizedError('Refresh token expired');
    }

    if (storedToken.user.status === UserStatus.SUSPENDED) {
      throw new ForbiddenError('Account suspended');
    }

    // Mark old token as used (single-use rotation)
    await prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { usedAt: new Date() },
    });

    // Generate new token pair
    const { accessToken, refreshToken: newRefreshToken, sessionId } =
      await this.generateTokens(storedToken.user);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_DAYS);

    await prisma.refreshToken.create({
      data: {
        userId: storedToken.userId,
        tokenHash: hashToken(newRefreshToken),
        sessionId,
        ipAddress: ipAddress ?? null,
        expiresAt,
      },
    });

    return { accessToken, refreshToken: newRefreshToken };
  }

  async logout(accessToken: string, refreshToken?: string): Promise<void> {
    // Revoke access token via Redis blacklist
    const tokenHash = hashToken(accessToken);
    const ttl = 15 * 60; // 15 minutes (access token lifetime)
    await cache.revokeToken(tokenHash, ttl);

    // Revoke refresh token
    if (refreshToken) {
      await prisma.refreshToken.updateMany({
        where: { tokenHash: hashToken(refreshToken) },
        data: { revokedAt: new Date() },
      });
    }
  }

  async requestPasswordReset(email: string): Promise<void> {
    const user = await prisma.user.findFirst({
      where: { email, deletedAt: null },
    });

    // Don't reveal if email exists
    if (!user) return;

    const token = generateToken(32);
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 2); // 2 hour expiry

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: hashToken(token),
        passwordResetExpiresAt: expiresAt,
      },
    });

    logger.info({ userId: user.id }, 'Password reset requested');
    // TODO: Queue email notification
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const tokenHash = hashToken(token);
    const user = await prisma.user.findFirst({
      where: {
        passwordResetToken: tokenHash,
        passwordResetExpiresAt: { gt: new Date() },
        deletedAt: null,
      },
    });

    if (!user) {
      throw new UnauthorizedError('Invalid or expired password reset token');
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpiresAt: null,
      },
    });

    // Revoke all refresh tokens (security measure)
    await prisma.refreshToken.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    logger.info({ userId: user.id }, 'Password reset completed');
  }

  // ─── Private Helpers ────────────────────────────────────────────────────

  private async generateTokens(user: { id: string; tenantId: string; role: string }) {
    const sessionId = crypto.randomUUID();

    const payload: JwtPayload = {
      sub: user.id,
      tenantId: user.tenantId,
      role: user.role as UserRole,
      sessionId,
    };

    const accessToken = await this.fastify.jwt.sign(payload, { expiresIn: '15m' });
    const refreshToken = generateToken(64);

    return { accessToken, refreshToken, sessionId };
  }

  private generateTenantSlug(email: string): string {
    const base = email.split('@')[0] ?? 'user';
    const random = Math.random().toString(36).substring(2, 7);
    return `${base.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${random}`;
  }
}
