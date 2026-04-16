import { beforeEach, describe, expect, it } from 'vitest';
import {
  decrypt,
  encrypt,
  generateReferralCode,
  hashToken,
  timingSafeEqual,
} from '../src/shared/utils/crypto.js';

describe('crypto utilities', () => {
  beforeEach(() => {
    process.env['JWT_ACCESS_SECRET'] = 'thumbforge-test-secret';
  });

  it('encrypts and decrypts payloads symmetrically', () => {
    const plaintext = 'sensitive-provider-key';
    const encrypted = encrypt(plaintext);

    expect(encrypted).not.toBe(plaintext);
    expect(decrypt(encrypted)).toBe(plaintext);
  });

  it('hashes tokens deterministically', () => {
    expect(hashToken('pix-token')).toBe(hashToken('pix-token'));
    expect(hashToken('pix-token')).not.toBe(hashToken('other-token'));
  });

  it('compares strings safely without leaking length mismatches', () => {
    expect(timingSafeEqual('approved', 'approved')).toBe(true);
    expect(timingSafeEqual('approved', 'pending')).toBe(false);
    expect(timingSafeEqual('short', 'much-longer')).toBe(false);
  });

  it('generates uppercase referral codes', () => {
    const code = generateReferralCode();
    expect(code).toMatch(/^[A-F0-9]{12}$/);
  });
});
