// =============================================================================
// ThumbForge AI — Fastify Server Entry Point
// =============================================================================

import './shared/utils/loadEnv.js';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import { PrismaClient } from '@prisma/client';
import { logger } from './shared/utils/logger.js';
import { connectDatabase, prisma } from './infrastructure/database/client.js';
import { getRedis } from './infrastructure/cache/redis.js';
import { storageService } from './infrastructure/storage/StorageService.js';
import { AppError, RateLimitError } from './shared/errors/AppError.js';

// Routes
import { authRoutes } from './modules/auth/auth.routes.js';
import { downloadsRoutes } from './modules/downloads/downloads.routes.js';
import { generationsRoutes } from './modules/generations/generations.routes.js';
import { paymentsRoutes, webhookRoutes } from './modules/payments/payments.routes.js';
import { plansRoutes } from './modules/plans/plans.routes.js';
import { subscriptionsRoutes } from './modules/subscriptions/subscriptions.routes.js';
import { templatesRoutes } from './modules/templates/templates.routes.js';
import { referenceAnalyzerRoutes } from './modules/reference-analyzer/reference-analyzer.routes.js';
import { promptBuilderRoutes } from './modules/prompt-builder/prompt-builder.routes.js';
import { semanticEditorRoutes } from './modules/semantic-editor/semantic-editor.routes.js';
import { thumbnailFinisherRoutes } from './modules/thumbnail-finisher/thumbnail-finisher.routes.js';

// Augment Fastify types
declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

const PORT = parseInt(process.env['PORT'] ?? '4000');
const HOST = process.env['HOST'] ?? '0.0.0.0';
const isDev = process.env['NODE_ENV'] !== 'production';

async function buildServer() {
  const fastify = Fastify({
    logger: false, // we use pino directly
    requestIdLogLabel: 'requestId',
    genReqId: () => crypto.randomUUID(),
    trustProxy: true,
  });

  // ─── Security Plugins ──────────────────────────────────────────────────────
  const helmetOptions = {
    crossOriginEmbedderPolicy: false,
    ...(isDev ? { contentSecurityPolicy: false } : {}),
  };

  await fastify.register(helmet, helmetOptions);

  await fastify.register(cors, {
    origin: [
      process.env['APP_URL'] ?? 'http://localhost:3000',
      process.env['ADMIN_URL'] ?? 'http://localhost:3001',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  const rateLimitOptions: Parameters<typeof rateLimit>[1] = {
    global: true,
    max: parseInt(process.env['RATE_LIMIT_MAX_REQUESTS'] ?? '100'),
    timeWindow: parseInt(process.env['RATE_LIMIT_WINDOW_MS'] ?? '60000'),
    keyGenerator: (request) => {
      const user = (request as { user?: { sub?: string } }).user;
      return user?.sub ?? request.ip;
    },
    errorResponseBuilder: (_request, context) => new RateLimitError(context.ttl),
  };

  const shouldUseRedisRateLimit =
    process.env['REDIS_DISABLED'] !== 'true' &&
    (process.env['RATE_LIMIT_USE_REDIS'] === 'true' ||
      (process.env['NODE_ENV'] === 'production' && process.env['RATE_LIMIT_USE_REDIS'] !== 'false'));

  if (shouldUseRedisRateLimit) {
    rateLimitOptions.redis = getRedis();
  } else {
    logger.warn('Rate limit running with in-memory store');
  }

  await fastify.register(rateLimit, rateLimitOptions);

  // ─── Utility Plugins ───────────────────────────────────────────────────────
  await fastify.register(cookie, {
    secret: process.env['COOKIE_SECRET'] ?? 'cookie-secret-change-me',
    parseOptions: {},
  });

  await fastify.register(jwt, {
    secret: process.env['JWT_ACCESS_SECRET'] ?? 'jwt-secret-change-me',
    sign: { algorithm: 'HS256' },
  });

  await fastify.register(multipart, {
    limits: {
      fileSize: parseInt(process.env['UPLOAD_MAX_SIZE_MB'] ?? '10') * 1024 * 1024,
      files: 10,
    },
  });

  // ─── Decorate with Prisma ──────────────────────────────────────────────────
  fastify.decorate('prisma', prisma);

  // ─── Request Logging ───────────────────────────────────────────────────────
  fastify.addHook('onRequest', async (request) => {
    logger.info(
      {
        requestId: request.id,
        method: request.method,
        url: request.url,
        ip: request.ip,
      },
      'Incoming request',
    );
  });

  fastify.addHook('onResponse', async (request, reply) => {
    logger.info(
      {
        requestId: request.id,
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        responseTime: reply.elapsedTime,
      },
      'Request completed',
    );
  });

  // ─── Error Handler ─────────────────────────────────────────────────────────
  fastify.setErrorHandler(async (error, request, reply) => {
    const requestId = request.id as string;
    const errorName =
      typeof error === 'object' && error && 'name' in error ? String(error.name) : '';
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';

    if (error instanceof AppError) {
      logger.warn(
        { requestId, code: error.code, statusCode: error.statusCode },
        error.message,
      );
      return reply.code(error.statusCode).send({
        success: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
          requestId,
        },
      });
    }

    // Zod validation errors
    if (errorName === 'ZodError') {
      return reply.code(422).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details:
            typeof error === 'object' && error && 'issues' in error
              ? (error as { issues?: unknown }).issues
              : undefined,
          requestId,
        },
      });
    }

    // JWT errors
    if (errorMessage.includes('jwt') || errorMessage.includes('token')) {
      return reply.code(401).send({
        success: false,
        error: { code: 'TOKEN_INVALID', message: 'Invalid token', requestId },
      });
    }

    // Unexpected errors
    logger.error({ requestId, err: error }, 'Unhandled error');
    return reply.code(500).send({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: isDev ? errorMessage : 'An unexpected error occurred',
        requestId,
      },
    });
  });

  // ─── Routes ────────────────────────────────────────────────────────────────
  await fastify.register(authRoutes, { prefix: '/api/auth' });
  await fastify.register(downloadsRoutes, { prefix: '/api/downloads' });
  await fastify.register(generationsRoutes, { prefix: '/api/generations' });
  await fastify.register(paymentsRoutes, { prefix: '/api/payments' });
  await fastify.register(plansRoutes, { prefix: '/api/plans' });
  await fastify.register(subscriptionsRoutes, { prefix: '/api/subscriptions' });
  await fastify.register(templatesRoutes, { prefix: '/api/templates' });
  await fastify.register(referenceAnalyzerRoutes, { prefix: '/api/reference-analyzer' });
  await fastify.register(promptBuilderRoutes, { prefix: '/api/prompt-builder' });
  await fastify.register(semanticEditorRoutes, { prefix: '/api/semantic-editor' });
  await fastify.register(thumbnailFinisherRoutes, { prefix: '/api/exports' });
  await fastify.register(webhookRoutes, { prefix: '/webhooks' });

  // Health check
  fastify.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env['npm_package_version'] ?? '1.0.0',
  }));

  fastify.get('/ready', async () => {
    // Check DB and Redis
    await prisma.$queryRaw`SELECT 1`;

    if (process.env['REDIS_DISABLED'] === 'true') {
      return {
        status: 'ready',
        services: {
          database: 'ok',
          redis: 'disabled',
        },
      };
    }

    await getRedis().ping();
    return {
      status: 'ready',
      services: {
        database: 'ok',
        redis: 'ok',
      },
    };
  });

  return fastify;
}

async function start() {
  try {
    logger.info('Starting ThumbForge AI backend...');

    await connectDatabase();
    await storageService.initialize();

    const server = await buildServer();
    await server.listen({ port: PORT, host: HOST });

    logger.info({ port: PORT }, `Server listening`);
  } catch (err) {
    logger.error({ err }, 'Failed to start server');
    process.exit(1);
  }
}

// Graceful shutdown
const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];
signals.forEach((signal) => {
  process.on(signal, async () => {
    logger.info({ signal }, 'Graceful shutdown initiated');
    process.exit(0);
  });
});

await start();
