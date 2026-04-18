// =============================================================================
// ThumbForge AI — Payment Webhook Worker
// =============================================================================

import { Worker } from 'bullmq';
import { getBullRedisOptions } from '../../cache/redis.js';
import { PaymentsService } from '../../../modules/payments/payments.service.js';
import { logger } from '../../../shared/utils/logger.js';
import { QUEUE_NAMES, type PaymentWebhookJobData } from '../queues/contracts.js';

const paymentsService = new PaymentsService();

export const paymentWebhookWorker = new Worker<PaymentWebhookJobData>(
  QUEUE_NAMES.PAYMENT_WEBHOOK,
  async (job) => {
    const { webhookEventId, eventType } = job.data;
    const log = logger.child({ jobId: job.id, webhookEventId, eventType });

    log.info('Processing payment webhook');

    await paymentsService.handleWebhookEvent(webhookEventId);

    log.info('Payment webhook processed');
  },
  {
    connection: getBullRedisOptions(),
    concurrency: 10,
  },
);

paymentWebhookWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err }, 'Webhook worker job failed');
});
