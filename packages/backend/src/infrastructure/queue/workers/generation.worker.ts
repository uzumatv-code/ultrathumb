// =============================================================================
// ThumbForge AI — Generation Worker
// =============================================================================

import { Worker } from 'bullmq';
import { getBullRedisOptions } from '../../cache/redis.js';
import { GenerationOrchestrator } from '../../ai/GenerationOrchestrator.js';
import { logger } from '../../../shared/utils/logger.js';
import { QUEUE_NAMES, type GenerationAiJobData } from '../queues/contracts.js';
import { prisma } from '../../database/client.js';

const CONCURRENCY = parseInt(process.env['GENERATION_CONCURRENCY'] ?? '3');

const orchestrator = new GenerationOrchestrator();

export const generationAiWorker = new Worker<GenerationAiJobData>(
  QUEUE_NAMES.GENERATION_AI,
  async (job) => {
    const { generationId, tenantId, userId } = job.data;
    const log = logger.child({ jobId: job.id, generationId, tenantId, userId });

    log.info('Generation job started');
    const startTime = Date.now();

    try {
      const variantTypes = (job.data as { variantTypes?: import('@thumbforge/shared').VariantType[] }).variantTypes;
      await orchestrator.execute(generationId, variantTypes ? { variantTypes } : {});
      log.info({ durationMs: Date.now() - startTime }, 'Generation job completed');
    } catch (err) {
      log.error({ err, durationMs: Date.now() - startTime }, 'Generation job failed');
      throw err; // BullMQ handles retry
    }
  },
  {
    connection: getBullRedisOptions(),
    concurrency: CONCURRENCY,
    limiter: {
      max: 5,          // max 5 jobs per period
      duration: 60000, // per minute (rate limit AI calls)
    },
  },
);

generationAiWorker.on('completed', (job) => {
  logger.info({ jobId: job.id }, 'Generation AI job completed');
});

generationAiWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err }, 'Generation AI job failed');

  // If max retries exceeded, update DB status to FAILED
  if (job?.attemptsMade === (job?.opts.attempts ?? 3)) {
    prisma.generationRequest
      .update({
        where: { id: job?.data.generationId },
        data: { status: 'FAILED', errorMessage: err.message },
      })
      .catch((dbErr: unknown) =>
        logger.error({ dbErr }, 'Failed to update generation status'),
      );
  }
});
