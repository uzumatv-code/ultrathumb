// =============================================================================
// ThumbForge AI - BullMQ Queues
// =============================================================================

import { Queue } from 'bullmq';
import { getBullRedisOptions } from '../../cache/redis.js';
import {
  QUEUE_NAMES,
  type AuditWriteJobData,
  type GenerationAiJobData,
  type GenerationPostJobData,
  type NotificationEmailJobData,
  type PaymentReconcileJobData,
  type PaymentWebhookJobData,
} from './contracts.js';

export { QUEUE_NAMES } from './contracts.js';
export type {
  AuditWriteJobData,
  GenerationAiJobData,
  GenerationPostJobData,
  NotificationEmailJobData,
  PaymentReconcileJobData,
  PaymentWebhookJobData,
} from './contracts.js';

const connection = () => ({
  connection: getBullRedisOptions(),
});

let generationAiQueueInstance: Queue<GenerationAiJobData> | null = null;
let generationPostQueueInstance: Queue<GenerationPostJobData> | null = null;
let paymentWebhookQueueInstance: Queue<PaymentWebhookJobData> | null = null;
let paymentReconcileQueueInstance: Queue<PaymentReconcileJobData> | null = null;
let notificationEmailQueueInstance: Queue<NotificationEmailJobData> | null = null;
let storageCleanupQueueInstance: Queue | null = null;
let auditWriteQueueInstance: Queue<AuditWriteJobData> | null = null;

export function getGenerationAiQueue(): Queue<GenerationAiJobData> {
  if (!generationAiQueueInstance) {
    generationAiQueueInstance = new Queue<GenerationAiJobData>(QUEUE_NAMES.GENERATION_AI, {
      ...connection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 500 },
      },
    });
  }

  return generationAiQueueInstance;
}

export function getGenerationPostQueue(): Queue<GenerationPostJobData> {
  if (!generationPostQueueInstance) {
    generationPostQueueInstance = new Queue<GenerationPostJobData>(QUEUE_NAMES.GENERATION_POST, {
      ...connection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 200 },
      },
    });
  }

  return generationPostQueueInstance;
}

export function getPaymentWebhookQueue(): Queue<PaymentWebhookJobData> {
  if (!paymentWebhookQueueInstance) {
    paymentWebhookQueueInstance = new Queue<PaymentWebhookJobData>(QUEUE_NAMES.PAYMENT_WEBHOOK, {
      ...connection(),
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { count: 200 },
        removeOnFail: { count: 1000 },
      },
    });
  }

  return paymentWebhookQueueInstance;
}

export function getPaymentReconcileQueue(): Queue<PaymentReconcileJobData> {
  if (!paymentReconcileQueueInstance) {
    paymentReconcileQueueInstance = new Queue<PaymentReconcileJobData>(QUEUE_NAMES.PAYMENT_RECONCILE, {
      ...connection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'fixed', delay: 30000 },
        removeOnComplete: { count: 50 },
        removeOnFail: { count: 50 },
      },
    });
  }

  return paymentReconcileQueueInstance;
}

export function getNotificationEmailQueue(): Queue<NotificationEmailJobData> {
  if (!notificationEmailQueueInstance) {
    notificationEmailQueueInstance = new Queue<NotificationEmailJobData>(QUEUE_NAMES.NOTIFICATION_EMAIL, {
      ...connection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 3000 },
        removeOnComplete: { count: 50 },
        removeOnFail: { count: 100 },
      },
    });
  }

  return notificationEmailQueueInstance;
}

export function getStorageCleanupQueue(): Queue {
  if (!storageCleanupQueueInstance) {
    storageCleanupQueueInstance = new Queue(QUEUE_NAMES.STORAGE_CLEANUP, {
      ...connection(),
      defaultJobOptions: {
        attempts: 2,
        removeOnComplete: { count: 20 },
        removeOnFail: { count: 20 },
      },
    });
  }

  return storageCleanupQueueInstance;
}

export function getAuditWriteQueue(): Queue<AuditWriteJobData> {
  if (!auditWriteQueueInstance) {
    auditWriteQueueInstance = new Queue<AuditWriteJobData>(QUEUE_NAMES.AUDIT_WRITE, {
      ...connection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 200 },
      },
    });
  }

  return auditWriteQueueInstance;
}
