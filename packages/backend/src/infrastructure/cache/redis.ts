// =============================================================================
// ThumbForge AI — Redis Client
// =============================================================================

import { Redis, type RedisOptions } from 'ioredis';
import { logger } from '../../shared/utils/logger.js';

let redisClient: Redis | null = null;
const memoryStore = new Map<string, { value: string; expiresAt: number | null }>();
const redisFailureCooldownMs = parseInt(process.env['REDIS_FAILURE_COOLDOWN_MS'] ?? '30000');
let redisTemporarilyDisabledUntil = 0;
const DEFAULT_REDIS_URL = 'redis://localhost:6379';

function parseRedisUrl(urlValue: string): RedisOptions {
  const normalizedUrl = /^[a-z]+:\/\//i.test(urlValue) ? urlValue : `redis://${urlValue}`;
  const parsed = new URL(normalizedUrl);
  const options: RedisOptions = {};

  if (parsed.hostname) {
    options.host = parsed.hostname;
  }

  if (parsed.port) {
    options.port = parseInt(parsed.port, 10);
  }

  if (parsed.username) {
    options.username = decodeURIComponent(parsed.username);
  }

  if (parsed.password) {
    options.password = decodeURIComponent(parsed.password);
  }

  if (parsed.pathname && parsed.pathname !== '/') {
    const db = parseInt(parsed.pathname.slice(1), 10);
    if (!Number.isNaN(db)) {
      options.db = db;
    }
  }

  const family = parsed.searchParams.get('family');
  if (family) {
    const parsedFamily = parseInt(family, 10);
    if (!Number.isNaN(parsedFamily)) {
      options.family = parsedFamily;
    }
  }

  if (parsed.protocol === 'rediss:') {
    options.tls = {};
  }

  return options;
}

function buildRedisOptions(overrides: Partial<RedisOptions> = {}): RedisOptions {
  const options = parseRedisUrl(process.env['REDIS_URL'] ?? DEFAULT_REDIS_URL);

  if (process.env['REDIS_PASSWORD']) {
    options.password = process.env['REDIS_PASSWORD'];
  }

  return {
    ...options,
    retryStrategy: (times) => {
      if (times > 10) {
        logger.error('Redis: max retries exceeded');
        return null;
      }
      return Math.min(times * 200, 2000);
    },
    enableReadyCheck: true,
    ...overrides,
  };
}

function getMemoryEntry(key: string) {
  const entry = memoryStore.get(key);
  if (!entry) return null;
  if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
    memoryStore.delete(key);
    return null;
  }
  return entry;
}

function setMemoryValue(key: string, value: string, ttlSeconds?: number) {
  const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : null;
  memoryStore.set(key, { value, expiresAt });
}

function deleteMemoryValue(key: string) {
  memoryStore.delete(key);
}

function shouldUseRedis(): boolean {
  if (process.env['REDIS_DISABLED'] === 'true') {
    return false;
  }

  if (!process.env['REDIS_URL']) {
    return false;
  }

  if (Date.now() < redisTemporarilyDisabledUntil) {
    return false;
  }

  return true;
}

function markRedisUnavailable() {
  redisTemporarilyDisabledUntil = Date.now() + redisFailureCooldownMs;
}

function ensureRedisAvailable() {
  const redis = getRedis();
  if (redis.status === 'end') {
    throw new Error('Redis connection is closed');
  }
  return redis;
}

async function runWithRedisFallback<T>(
  operationName: string,
  redisOperation: () => Promise<T>,
  fallbackOperation: () => T | Promise<T>,
): Promise<T> {
  if (!shouldUseRedis()) {
    return await fallbackOperation();
  }

  try {
    return await redisOperation();
  } catch (error) {
    markRedisUnavailable();
    logger.warn({ err: error, operationName }, 'Redis unavailable, using in-memory fallback');
    return await fallbackOperation();
  }
}

export function getRedis(): Redis {
  if (!redisClient) {
    redisClient = new Redis(buildRedisOptions({
      maxRetriesPerRequest: 3,
    }));

    redisClient.on('connect', () => {
      redisTemporarilyDisabledUntil = 0;
      logger.info('Redis connected');
    });
    redisClient.on('error', (err) => {
      markRedisUnavailable();
      logger.error({ err }, 'Redis error');
    });
    redisClient.on('close', () => {
      markRedisUnavailable();
      logger.warn('Redis connection closed');
    });
  }

  return redisClient;
}

export function getBullRedisOptions(): RedisOptions {
  return buildRedisOptions({
    maxRetriesPerRequest: null,
  });
}

// ─── Cache Helpers ─────────────────────────────────────────────────────────

export const cache = {
  async get<T>(key: string): Promise<T | null> {
    return runWithRedisFallback(
      'cache.get',
      async () => {
        const value = await ensureRedisAvailable().get(key);
        if (!value) return null;
        try {
          return JSON.parse(value) as T;
        } catch {
          return value as unknown as T;
        }
      },
      () => {
        const value = getMemoryEntry(key)?.value;
        if (!value) return null;
        try {
          return JSON.parse(value) as T;
        } catch {
          return value as unknown as T;
        }
      },
    );
  },

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    const serialized = JSON.stringify(value);
    await runWithRedisFallback(
      'cache.set',
      async () => {
        const redis = ensureRedisAvailable();
        if (ttlSeconds) {
          await redis.setex(key, ttlSeconds, serialized);
          return;
        }
        await redis.set(key, serialized);
      },
      () => {
        setMemoryValue(key, serialized, ttlSeconds);
      },
    );
  },

  async del(key: string): Promise<void> {
    await runWithRedisFallback(
      'cache.del',
      async () => {
        await ensureRedisAvailable().del(key);
      },
      () => {
        deleteMemoryValue(key);
      },
    );
  },

  async exists(key: string): Promise<boolean> {
    return runWithRedisFallback(
      'cache.exists',
      async () => {
        const result = await ensureRedisAvailable().exists(key);
        return result === 1;
      },
      () => getMemoryEntry(key) !== null,
    );
  },

  async sadd(key: string, ...members: string[]): Promise<void> {
    await runWithRedisFallback(
      'cache.sadd',
      async () => {
        await ensureRedisAvailable().sadd(key, ...members);
      },
      () => {
        const existing = getMemoryEntry(key);
        const current = existing ? new Set(JSON.parse(existing.value) as string[]) : new Set<string>();
        members.forEach((member) => current.add(member));
        setMemoryValue(key, JSON.stringify([...current]));
      },
    );
  },

  async sismember(key: string, member: string): Promise<boolean> {
    return runWithRedisFallback(
      'cache.sismember',
      async () => {
        const result = await ensureRedisAvailable().sismember(key, member);
        return result === 1;
      },
      () => {
        const existing = getMemoryEntry(key);
        if (!existing) return false;
        const current = new Set(JSON.parse(existing.value) as string[]);
        return current.has(member);
      },
    );
  },

  async expire(key: string, ttlSeconds: number): Promise<void> {
    await runWithRedisFallback(
      'cache.expire',
      async () => {
        await ensureRedisAvailable().expire(key, ttlSeconds);
      },
      () => {
        const existing = getMemoryEntry(key);
        if (!existing) return;
        setMemoryValue(key, existing.value, ttlSeconds);
      },
    );
  },

  // Revoked tokens
  async revokeToken(tokenHash: string, ttlSeconds: number): Promise<void> {
    await runWithRedisFallback(
      'cache.revokeToken',
      async () => {
        await ensureRedisAvailable().setex(`revoked:${tokenHash}`, ttlSeconds, '1');
      },
      () => {
        setMemoryValue(`revoked:${tokenHash}`, '1', ttlSeconds);
      },
    );
  },

  async isTokenRevoked(tokenHash: string): Promise<boolean> {
    return runWithRedisFallback(
      'cache.isTokenRevoked',
      async () => {
        const result = await ensureRedisAvailable().exists(`revoked:${tokenHash}`);
        return result === 1;
      },
      () => getMemoryEntry(`revoked:${tokenHash}`) !== null,
    );
  },
};

export async function disconnectRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    logger.info('Redis disconnected');
  }
}
