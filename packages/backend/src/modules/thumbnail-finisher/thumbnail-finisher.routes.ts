// =============================================================================
// ThumbForge AI — Thumbnail Finisher Routes
// POST /api/exports                    — create export job
// GET  /api/exports/:jobId             — get export job status
// GET  /api/exports/variant/:variantId — list export jobs for variant
// =============================================================================

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ThumbnailFinisherService } from './thumbnail-finisher.service.js';
import { authenticate } from '../../shared/middlewares/authenticate.js';

const exportOptionsSchema = z.object({
  upscale:         z.boolean().optional().default(true),
  targetWidth:     z.number().int().min(320).max(3840).optional().default(1280),
  targetHeight:    z.number().int().min(180).max(2160).optional().default(720),
  sharpen:         z.boolean().optional().default(true),
  sharpenSigma:    z.number().min(0.3).max(3.0).optional().default(0.8),
  contrastBoost:   z.boolean().optional().default(true),
  faceEnhance:     z.boolean().optional().default(true),
  removeWatermark: z.boolean().optional().default(false),
  format:          z.enum(['webp', 'png', 'jpeg']).optional().default('webp'),
  quality:         z.number().int().min(1).max(100).optional().default(92),
});

const createJobBodySchema = z.object({
  variantId: z.string().uuid(),
  options:   exportOptionsSchema.optional(),
});

export async function thumbnailFinisherRoutes(fastify: FastifyInstance): Promise<void> {
  const service = new ThumbnailFinisherService();

  fastify.addHook('preHandler', authenticate);

  // POST /api/exports
  fastify.post('/', async (request, reply) => {
    const { variantId, options } = createJobBodySchema.parse(request.body);
    const job = await service.createExportJob(
      variantId,
      request.tenantId,
      request.user.sub,
      options ?? {},
    );
    return reply.code(202).send({ success: true, data: job });
  });

  // GET /api/exports/variant/:variantId
  fastify.get<{ Params: { variantId: string } }>(
    '/variant/:variantId',
    async (request, reply) => {
      const jobs = await service.listExportJobs(
        request.params.variantId,
        request.tenantId,
      );
      return reply.send({ success: true, data: jobs });
    },
  );

  // GET /api/exports/:jobId
  fastify.get<{ Params: { jobId: string } }>('/:jobId', async (request, reply) => {
    const job = await service.getExportJob(request.params.jobId, request.tenantId);
    return reply.send({ success: true, data: job });
  });
}
