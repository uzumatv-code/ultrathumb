// =============================================================================
// ThumbForge AI — Downloads Service
// =============================================================================

import { prisma } from '../../infrastructure/database/client.js';
import { storageService } from '../../infrastructure/storage/StorageService.js';
import { logger } from '../../shared/utils/logger.js';
import {
  NotFoundError,
  PaymentNotApprovedError,
  DownloadExpiredError,
  ForbiddenError,
} from '../../shared/errors/AppError.js';
import type { AuditWriteJobData } from '../../infrastructure/queue/queues/contracts.js';

const DOWNLOAD_URL_EXPIRES_MINUTES = parseInt(
  process.env['DOWNLOAD_URL_EXPIRES_MINUTES'] ?? '15',
);

function isQueueRuntimeEnabled(): boolean {
  return process.env['REDIS_DISABLED'] !== 'true';
}

export class DownloadsService {
  async requestDownload(
    variantId: string,
    tenantId: string,
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ downloadUrl: string; expiresAt: string }> {
    // 1. Find the download record
    const download = await prisma.download.findFirst({
      where: {
        variantId,
        userId,
        variant: {
          generation: { tenantId },
          isPaid: true,
        },
      },
      include: {
        variant: {
          select: {
            id: true,
            variantIndex: true,
            hdStoragePath: true,
            status: true,
            isPaid: true,
            generation: {
              select: { tenantId: true, id: true },
            },
          },
        },
      },
    });

    if (!download) {
      // Check if variant exists but isn't paid
      const variant = await prisma.generationVariant.findFirst({
        where: { id: variantId, generation: { tenantId } },
      });

      if (!variant) throw new NotFoundError('Variant', variantId);
      if (!variant.isPaid) throw new PaymentNotApprovedError(variantId);

      throw new ForbiddenError('Download not authorized');
    }

    // 2. Check if download is expired
    if (download.expiresAt < new Date()) {
      throw new DownloadExpiredError();
    }

    // 3. Verify the HD file exists in storage
    const hdPath = download.variant.hdStoragePath;
    if (!hdPath) {
      throw new NotFoundError('HD file not found — generation may still be processing');
    }

    // 4. Generate presigned URL (15 minutes)
    const expiresSeconds = DOWNLOAD_URL_EXPIRES_MINUTES * 60;
    const filename = `thumbforge_variant_${download.variant.variantIndex}.webp`;

    const downloadUrl = await storageService.getPresignedDownloadUrl(
      hdPath,
      expiresSeconds,
      filename,
    );

    // 5. Mark download as downloaded
    await prisma.download.update({
      where: { id: download.id },
      data: {
        downloadedAt: new Date(),
        signedUrlUsed: downloadUrl.substring(0, 200), // store prefix for audit
        ipAddress: ipAddress ?? null,
        userAgent: userAgent ?? null,
      },
    });

    const auditJob: AuditWriteJobData = {
      tenantId,
      userId,
      action: 'download.complete',
      resourceType: 'variant',
      resourceId: variantId,
      metadata: { downloadId: download.id, variantIndex: download.variant.variantIndex },
      ...(ipAddress ? { ipAddress } : {}),
      ...(userAgent ? { userAgent } : {}),
    };

    // 6. Audit log (async, non-blocking)
    if (isQueueRuntimeEnabled()) {
      const { getAuditWriteQueue } = await import('../../infrastructure/queue/queues/index.js');
      await getAuditWriteQueue().add('audit', auditJob);
    } else {
      logger.warn({ tenantId, userId, variantId }, 'Redis queue disabled, writing audit inline');
      void prisma.auditLog
        .create({
          data: {
            action: auditJob.action,
            metadata: auditJob.metadata as object,
            ...(auditJob.tenantId ? { tenantId: auditJob.tenantId } : {}),
            ...(auditJob.userId ? { userId: auditJob.userId } : {}),
            ...(auditJob.resourceType ? { resourceType: auditJob.resourceType } : {}),
            ...(auditJob.resourceId ? { resourceId: auditJob.resourceId } : {}),
            ...(auditJob.ipAddress ? { ipAddress: auditJob.ipAddress } : {}),
            ...(auditJob.userAgent ? { userAgent: auditJob.userAgent } : {}),
          },
        })
        .catch((err: unknown) => {
          logger.error({ err, tenantId, userId, variantId }, 'Inline audit write failed');
        });
    }

    logger.info(
      { downloadId: download.id, variantId, userId, tenantId },
      'Download URL generated',
    );

    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + expiresSeconds);

    return {
      downloadUrl,
      expiresAt: expiresAt.toISOString(),
    };
  }

  async listDownloads(userId: string, tenantId: string) {
    return prisma.download.findMany({
      where: {
        userId,
        variant: { generation: { tenantId } },
      },
      include: {
        variant: {
          select: {
            id: true,
            variantIndex: true,
            thumbnailUrl: true,
            generation: {
              select: { id: true, createdAt: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}
