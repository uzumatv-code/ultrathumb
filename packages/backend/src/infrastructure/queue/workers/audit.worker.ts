// =============================================================================
// ThumbForge AI — Audit Write Worker
// =============================================================================

import { Worker } from 'bullmq';
import { getBullRedisOptions } from '../../cache/redis.js';
import { prisma } from '../../database/client.js';
import { logger } from '../../../shared/utils/logger.js';
import { QUEUE_NAMES } from '../queues/index.js';
import type { AuditWriteJobData } from '../queues/index.js';

export const auditWriteWorker = new Worker<AuditWriteJobData>(
  QUEUE_NAMES.AUDIT_WRITE,
  async (job) => {
    const data = job.data;
    await prisma.auditLog.create({
      data: {
        action: data.action,
        metadata: (data.metadata ?? {}) as object,
        ...(data.tenantId ? { tenantId: data.tenantId } : {}),
        ...(data.userId ? { userId: data.userId } : {}),
        ...(data.resourceType ? { resourceType: data.resourceType } : {}),
        ...(data.resourceId ? { resourceId: data.resourceId } : {}),
        ...(data.ipAddress ? { ipAddress: data.ipAddress } : {}),
        ...(data.userAgent ? { userAgent: data.userAgent } : {}),
        ...(data.requestId ? { requestId: data.requestId } : {}),
      },
    });
  },
  {
    connection: getBullRedisOptions(),
    concurrency: 10,
  },
);

auditWriteWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err }, 'Audit write failed');
});
