// =============================================================================
// ThumbForge AI — BullMQ Queues
// =============================================================================

import { Queue } from 'bullmq';
import { getBullRedisOptions } from '../../cache/redis.js';

const connection = () => ({
  connection: getBullRedisOptions(),
});

// ─── Queue Names ──────────────────────────────────────────────────────────

export const QUEUE_NAMES = {
  GENERATION_AI: 'generation-ai',
  GENERATION_POST: 'generation-post',
  PAYMENT_WEBHOOK: 'payment-webhook',
  PAYMENT_RECONCILE: 'payment-reconcile',
  NOTIFICATION_EMAIL: 'notification-email',
  STORAGE_CLEANUP: 'storage-cleanup',
  AUDIT_WRITE: 'audit-write',
} as const;

// ─── Queue Instances ──────────────────────────────────────────────────────

export const generationAiQueue = new Queue(QUEUE_NAMES.GENERATION_AI, {
  ...connection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 500 },
  },
});

export const generationPostQueue = new Queue(QUEUE_NAMES.GENERATION_POST, {
  ...connection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 200 },
  },
});

export const paymentWebhookQueue = new Queue(QUEUE_NAMES.PAYMENT_WEBHOOK, {
  ...connection(),
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: { count: 200 },
    removeOnFail: { count: 1000 },
  },
});

export const paymentReconcileQueue = new Queue(QUEUE_NAMES.PAYMENT_RECONCILE, {
  ...connection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'fixed', delay: 30000 },
    removeOnComplete: { count: 50 },
    removeOnFail: { count: 50 },
  },
});

export const notificationEmailQueue = new Queue(QUEUE_NAMES.NOTIFICATION_EMAIL, {
  ...connection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 3000 },
    removeOnComplete: { count: 50 },
    removeOnFail: { count: 100 },
  },
});

export const storageCleanupQueue = new Queue(QUEUE_NAMES.STORAGE_CLEANUP, {
  ...connection(),
  defaultJobOptions: {
    attempts: 2,
    removeOnComplete: { count: 20 },
    removeOnFail: { count: 20 },
  },
});

export const auditWriteQueue = new Queue(QUEUE_NAMES.AUDIT_WRITE, {
  ...connection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 200 },
  },
});

// ─── Job Type Definitions ─────────────────────────────────────────────────

export interface GenerationAiJobData {
  generationId: string;
  tenantId: string;
  userId: string;
}

export interface GenerationPostJobData {
  generationId: string;
  tenantId: string;
  variantPaths: Array<{
    index: number;
    hdPath: string;
    imageBuffer: string; // base64
  }>;
}

export interface PaymentWebhookJobData {
  webhookEventId: string;
  provider: string;
  eventType: string;
  payload: Record<string, unknown>;
}

export interface PaymentReconcileJobData {
  olderThanMinutes: number;
}

export interface NotificationEmailJobData {
  to: string;
  subject: string;
  template: string;
  data: Record<string, unknown>;
}

export interface AuditWriteJobData {
  tenantId?: string;
  userId?: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
}
