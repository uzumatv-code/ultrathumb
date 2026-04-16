import { describe, expect, it } from 'vitest';
import {
  generateIdempotencyKey,
  generateRandomIdempotencyKey,
} from '../src/shared/utils/idempotency.js';

describe('generateIdempotencyKey', () => {
  it('returns the same hash for the same input payload', () => {
    const first = generateIdempotencyKey(
      'tenant-1',
      'user-1',
      'COMBO_VARIANTS',
      'variant-a,variant-b,variant-c',
    );
    const second = generateIdempotencyKey(
      'tenant-1',
      'user-1',
      'COMBO_VARIANTS',
      'variant-a,variant-b,variant-c',
    );

    expect(first).toBe(second);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
  });

  it('changes when one of the business identifiers changes', () => {
    const base = generateIdempotencyKey('tenant-1', 'user-1', 'SUBSCRIPTION', 'plan-pro');
    const changed = generateIdempotencyKey('tenant-1', 'user-1', 'SUBSCRIPTION', 'plan-starter');

    expect(base).not.toBe(changed);
  });
});

describe('generateRandomIdempotencyKey', () => {
  it('returns a UUID-like key for one-off operations', () => {
    const key = generateRandomIdempotencyKey();
    expect(key).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });
});
