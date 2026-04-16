// =============================================================================
// ThumbForge AI — Idempotency Key Generator
// =============================================================================

import crypto from 'node:crypto';

/**
 * Generates a deterministic idempotency key for payment operations.
 * Same inputs always produce the same key.
 */
export function generateIdempotencyKey(
  tenantId: string,
  userId: string,
  operation: string,
  resourceId?: string,
): string {
  const parts = [tenantId, userId, operation, resourceId ?? ''].join(':');
  return crypto.createHash('sha256').update(parts).digest('hex');
}

/**
 * Generates a random idempotency key (for one-off operations).
 */
export function generateRandomIdempotencyKey(): string {
  return crypto.randomUUID();
}
