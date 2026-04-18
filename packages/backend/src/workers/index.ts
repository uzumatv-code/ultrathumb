// =============================================================================
// ThumbForge AI - Workers Entry Point
// =============================================================================

import '../shared/utils/loadEnv.js';
import { CronJob } from 'cron';
import { getRedis } from '../infrastructure/cache/redis.js';
import { connectDatabase } from '../infrastructure/database/client.js';
import { storageService } from '../infrastructure/storage/StorageService.js';
import { logger } from '../shared/utils/logger.js';

let idleTimer: NodeJS.Timeout | null = null;
let reconcileJob: CronJob | null = null;
let generationWorkerRef: { close: () => Promise<unknown> } | null = null;
let paymentWebhookWorkerRef: { close: () => Promise<unknown> } | null = null;
let auditWriteWorkerRef: { close: () => Promise<unknown> } | null = null;

function isQueueRuntimeEnabled() {
  return process.env['REDIS_DISABLED'] !== 'true';
}

async function startWorkers() {
  logger.info('Starting ThumbForge AI workers...');

  await connectDatabase();
  await storageService.initialize();

  if (!isQueueRuntimeEnabled()) {
    logger.warn('Redis queue runtime disabled. Workers will stay idle in this environment.');
    idleTimer = setInterval(() => undefined, 60000);
    return;
  }

  await getRedis().ping();
  logger.info('Redis connected');

  const [
    { generationAiWorker },
    { paymentWebhookWorker },
    { auditWriteWorker },
    { getPaymentReconcileQueue },
  ] = await Promise.all([
    import('../infrastructure/queue/workers/generation.worker.js'),
    import('../infrastructure/queue/workers/webhook.worker.js'),
    import('../infrastructure/queue/workers/audit.worker.js'),
    import('../infrastructure/queue/queues/index.js'),
  ]);

  generationWorkerRef = generationAiWorker;
  paymentWebhookWorkerRef = paymentWebhookWorker;
  auditWriteWorkerRef = auditWriteWorker;

  logger.info('Workers active:');
  logger.info('  - generation:ai worker');
  logger.info('  - payment:webhook worker');
  logger.info('  - audit:write worker');

  reconcileJob = new CronJob('0 * * * *', async () => {
    logger.info('Running payment reconciliation');
    await getPaymentReconcileQueue().add('reconcile', { olderThanMinutes: 30 });
  });
  reconcileJob.start();

  logger.info('  - payment reconciliation cron (every hour)');
  logger.info('All workers started successfully');
}

process.on('SIGTERM', async () => {
  logger.info('Shutting down workers...');

  if (idleTimer) {
    clearInterval(idleTimer);
    idleTimer = null;
  }

  reconcileJob?.stop();
  reconcileJob = null;

  await generationWorkerRef?.close();
  await paymentWebhookWorkerRef?.close();
  await auditWriteWorkerRef?.close();

  process.exit(0);
});

await startWorkers();
