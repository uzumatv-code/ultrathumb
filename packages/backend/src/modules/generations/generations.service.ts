// =============================================================================
// ThumbForge AI — Generations Service
// =============================================================================

import { prisma } from '../../infrastructure/database/client.js';
import { storageService } from '../../infrastructure/storage/StorageService.js';
import { GenerationOrchestrator } from '../../infrastructure/ai/GenerationOrchestrator.js';
import { logger } from '../../shared/utils/logger.js';
import { AssetType } from '@prisma/client';
import {
  QuotaExceededError,
  NotFoundError,
  ForbiddenError,
  ValidationError,
} from '../../shared/errors/AppError.js';
import type { StyleConfig } from '@thumbforge/shared';

const MAX_FILE_SIZE = parseInt(process.env['UPLOAD_MAX_SIZE_MB'] ?? '10') * 1024 * 1024;
const ALLOWED_TYPES = (process.env['UPLOAD_ALLOWED_TYPES'] ?? 'image/jpeg,image/png,image/webp').split(',');
const inlineGenerationOrchestrator = new GenerationOrchestrator();

function shouldRunGenerationInline(): boolean {
  return process.env['REDIS_DISABLED'] === 'true' || process.env['GENERATION_INLINE'] === 'true';
}

export interface UploadedGenerationFile {
  fieldname: string;
  originalname: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}

export interface CreateGenerationInput {
  tenantId: string;
  userId: string;
  templateId?: string | undefined;
  savedModelId?: string | undefined;
  freeTextPrompt?: string | undefined;
  styleConfig: StyleConfig;
  files: {
    reference?: UploadedGenerationFile[] | undefined;
    person?: UploadedGenerationFile[] | undefined;
    assets?: UploadedGenerationFile[] | undefined;
  };
}

export class GenerationsService {
  private resolveVariantMediaUrls<
    T extends {
      previewUrl?: string | null;
      thumbnailUrl?: string | null;
      previewStoragePath?: string | null;
      thumbnailStoragePath?: string | null;
    },
  >(variant: T): T {
    return {
      ...variant,
      previewUrl: variant.previewStoragePath
        ? storageService.getPublicObjectUrl(variant.previewStoragePath)
        : (variant.previewUrl ?? null),
      thumbnailUrl: variant.thumbnailStoragePath
        ? storageService.getPublicObjectUrl(variant.thumbnailStoragePath)
        : (variant.thumbnailUrl ?? null),
    };
  }

  async createGeneration(input: CreateGenerationInput) {
    // 1. Validate quota
    await this.validateQuota(input.tenantId);

    // 2. Validate files
    this.validateFiles(input.files);

    // 3. Create generation record
    const generation = await prisma.generationRequest.create({
      data: {
        tenantId: input.tenantId,
        userId: input.userId,
        templateId: input.templateId ?? null,
        savedModelId: input.savedModelId ?? null,
        status: 'QUEUED',
        freeTextPrompt: input.freeTextPrompt ?? null,
        styleConfig: input.styleConfig as object,
        quotaCounted: true,
      },
    });

    // 4. Upload assets to storage
    const assetRecords = await this.uploadAssets(generation.id, input.tenantId, input.files);

    // Create asset records in DB
    if (assetRecords.length > 0) {
      await prisma.generationAsset.createMany({ data: assetRecords });
    }

    // 5. Increment usage counter (counted even without download, as per business rules)
    await this.incrementUsageCounter(input.tenantId);

    // 6. Dispatch generation processing
    if (shouldRunGenerationInline()) {
      logger.warn(
        { generationId: generation.id, tenantId: input.tenantId },
        'Redis queue disabled, running generation inline',
      );

      setTimeout(() => {
        void inlineGenerationOrchestrator.execute(generation.id).catch((error: unknown) => {
          logger.error(
            { err: error, generationId: generation.id, tenantId: input.tenantId },
            'Inline generation failed',
          );
        });
      }, 0);
    } else {
      const { generationAiQueue } = await import('../../infrastructure/queue/queues/index.js');
      const job = await generationAiQueue.add(
        'generate',
        {
          generationId: generation.id,
          tenantId: input.tenantId,
          userId: input.userId,
        },
        { priority: 1 },
      );

      await prisma.generationRequest.update({
        where: { id: generation.id },
        data: {
          queueJobId: job.id?.toString() ?? null,
        },
      });

      logger.info(
        { generationId: generation.id, jobId: job.id, tenantId: input.tenantId },
        'Generation queued',
      );
    }

    return generation;
  }

  async getGeneration(id: string, tenantId: string) {
    const generation = await prisma.generationRequest.findFirst({
      where: { id, tenantId, },
      include: {
        variants: {
          orderBy: { variantIndex: 'asc' },
        },
        assets: {
          orderBy: { type: 'asc' },
        },
        template: {
          select: { id: true, name: true, category: true },
        },
      },
    });

    if (!generation) {
      throw new NotFoundError('Generation', id);
    }

    return {
      ...generation,
      variants: generation.variants.map((variant) => this.resolveVariantMediaUrls(variant)),
    };
  }

  async listGenerations(
    tenantId: string,
    opts: {
      page: number;
      limit: number;
      status?: string | undefined;
      templateId?: string | undefined;
      from?: Date | undefined;
      to?: Date | undefined;
    },
  ) {
    const where = {
      tenantId,
      ...(opts.status && { status: opts.status as never }),
      ...(opts.templateId && { templateId: opts.templateId }),
      ...(opts.from || opts.to
        ? {
            createdAt: {
              ...(opts.from && { gte: opts.from }),
              ...(opts.to && { lte: opts.to }),
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.generationRequest.findMany({
        where,
        include: {
          variants: {
            select: {
              id: true,
              variantIndex: true,
              status: true,
              previewStoragePath: true,
              thumbnailStoragePath: true,
              previewUrl: true,
              thumbnailUrl: true,
              isPaid: true,
            },
          },
          template: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (opts.page - 1) * opts.limit,
        take: opts.limit,
      }),
      prisma.generationRequest.count({ where }),
    ]);

    return {
      items: items.map((item) => ({
        ...item,
        variants: item.variants.map((variant) => this.resolveVariantMediaUrls(variant)),
      })),
      total,
    };
  }

  async cancelGeneration(id: string, tenantId: string) {
    const generation = await prisma.generationRequest.findFirst({
      where: { id, tenantId },
    });

    if (!generation) {
      throw new NotFoundError('Generation', id);
    }

    if (generation.status !== 'QUEUED') {
      throw new ValidationError('Can only cancel queued generations');
    }

    // Remove from queue if possible
    if (generation.queueJobId && !shouldRunGenerationInline()) {
      const { generationAiQueue } = await import('../../infrastructure/queue/queues/index.js');
      const job = await generationAiQueue.getJob(generation.queueJobId);
      if (job) await job.remove();
    }

    // Decrement usage counter (cancelled before processing)
    await this.decrementUsageCounter(tenantId);

    await prisma.generationRequest.update({
      where: { id },
      data: { status: 'CANCELLED', quotaCounted: false },
    });

    return { message: 'Generation cancelled' };
  }

  // ─── Preview Token ────────────────────────────────────────────────────────

  async getPreviewToken(variantId: string, tenantId: string): Promise<string> {
    const variant = await prisma.generationVariant.findFirst({
      where: { id: variantId, generation: { tenantId } },
    });

    if (!variant) throw new NotFoundError('Variant', variantId);

    // Return preview URL (already a presigned public URL or public bucket URL)
    // The actual protection is: low-res + watermark applied at generation time
    if (variant.previewStoragePath) {
      return storageService.getPublicObjectUrl(variant.previewStoragePath);
    }

    return variant.previewUrl ?? '';
  }

  // ─── Private Helpers ──────────────────────────────────────────────────────

  private async validateQuota(tenantId: string): Promise<void> {
    const now = new Date();
    const counter = await prisma.usageCounter.findUnique({
      where: {
        tenantId_periodYear_periodMonth: {
          tenantId,
          periodYear: now.getFullYear(),
          periodMonth: now.getMonth() + 1,
        },
      },
    });

    if (!counter) return; // No counter = no subscription yet handled elsewhere

    if (counter.generationsUsed >= counter.generationsLimit) {
      throw new QuotaExceededError(counter.generationsUsed, counter.generationsLimit);
    }
  }

  private validateFiles(files: CreateGenerationInput['files']): void {
    const allFiles = [
      ...(files.reference ?? []),
      ...(files.person ?? []),
      ...(files.assets ?? []),
    ];

    for (const file of allFiles) {
      if (file.size > MAX_FILE_SIZE) {
        throw new ValidationError(`File too large: ${file.originalname}`, {
          maxSizeMB: MAX_FILE_SIZE / (1024 * 1024),
        });
      }
      if (!ALLOWED_TYPES.includes(file.mimetype)) {
        throw new ValidationError(`Invalid file type: ${file.mimetype}`, {
          allowed: ALLOWED_TYPES,
        });
      }
    }
  }

  private async uploadAssets(
    generationId: string,
    tenantId: string,
    files: CreateGenerationInput['files'],
  ) {
    const records: Array<{
      generationId: string;
      type: AssetType;
      originalFilename: string;
      storagePath: string;
      mimeType: string;
      fileSizeBytes: number;
    }> = [];

    const uploadFile = async (
      file: UploadedGenerationFile,
      type: AssetType,
      filename: string,
    ) => {
      const path = storageService.buildInputPath(tenantId, generationId, filename);
      await storageService.uploadPrivate(path, file.buffer, {
        contentType: file.mimetype,
        metadata: { generationId, type, originalName: file.originalname },
      });
      records.push({
        generationId,
        type,
        originalFilename: file.originalname,
        storagePath: path,
        mimeType: file.mimetype,
        fileSizeBytes: file.size,
      });
    };

    const uploadPromises: Promise<void>[] = [];

    if (files.reference?.[0]) {
      uploadPromises.push(
        uploadFile(files.reference[0], AssetType.REFERENCE, 'reference.webp'),
      );
    }

    if (files.person?.[0]) {
      uploadPromises.push(uploadFile(files.person[0], AssetType.PERSON, 'person.webp'));
    }

    if (files.assets) {
      files.assets.forEach((file, idx) => {
        uploadPromises.push(
          uploadFile(file, AssetType.OBJECT, `asset_${idx + 1}.webp`),
        );
      });
    }

    await Promise.all(uploadPromises);
    return records;
  }

  private async incrementUsageCounter(tenantId: string): Promise<void> {
    const now = new Date();
    await prisma.usageCounter.upsert({
      where: {
        tenantId_periodYear_periodMonth: {
          tenantId,
          periodYear: now.getFullYear(),
          periodMonth: now.getMonth() + 1,
        },
      },
      update: { generationsUsed: { increment: 1 } },
      create: {
        tenantId,
        periodYear: now.getFullYear(),
        periodMonth: now.getMonth() + 1,
        generationsUsed: 1,
        generationsLimit: 30,
      },
    });
  }

  private async decrementUsageCounter(tenantId: string): Promise<void> {
    const now = new Date();
    await prisma.usageCounter.updateMany({
      where: {
        tenantId,
        periodYear: now.getFullYear(),
        periodMonth: now.getMonth() + 1,
        generationsUsed: { gt: 0 },
      },
      data: { generationsUsed: { decrement: 1 } },
    });
  }
}
