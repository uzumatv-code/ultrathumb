// =============================================================================
// ThumbForge AI — Reference Analyzer Routes
// POST /api/reference-analyzer/analyze  — upload image, get DNA JSON back
// GET  /api/reference-analyzer/:id      — get persisted analysis
// GET  /api/reference-analyzer/generation/:generationId — list for a generation
// =============================================================================

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ReferenceAnalyzerService } from './reference-analyzer.service.js';
import { authenticate } from '../../shared/middlewares/authenticate.js';
import { ValidationError } from '../../shared/errors/AppError.js';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = parseInt(process.env['UPLOAD_MAX_SIZE_MB'] ?? '10') * 1024 * 1024;

const analyzeQuerySchema = z.object({
  generationId: z.string().uuid().optional(),
});

export async function referenceAnalyzerRoutes(fastify: FastifyInstance): Promise<void> {
  const service = new ReferenceAnalyzerService();

  fastify.addHook('preHandler', authenticate);

  // POST /api/reference-analyzer/analyze
  fastify.post('/analyze', async (request, reply) => {
    const parts = request.parts();
    let imageBuffer: Buffer | undefined;
    let mimeType = 'image/jpeg';
    let generationId: string | undefined;

    for await (const part of parts) {
      if (part.type === 'file' && part.fieldname === 'image') {
        if (!ALLOWED_TYPES.includes(part.mimetype)) {
          throw new ValidationError(`Invalid file type: ${part.mimetype}`, { allowed: ALLOWED_TYPES });
        }
        const chunks: Buffer[] = [];
        for await (const chunk of part.file) chunks.push(chunk);
        imageBuffer = Buffer.concat(chunks);
        mimeType = part.mimetype;
        if (imageBuffer.length > MAX_SIZE) {
          throw new ValidationError('File too large', { maxMB: MAX_SIZE / 1024 / 1024 });
        }
      } else if (part.type === 'field' && part.fieldname === 'generationId') {
        generationId = (part as { value: string }).value;
      }
    }

    if (!imageBuffer) throw new ValidationError('Image file is required');

    const analysis = await service.analyzeBuffer(
      imageBuffer,
      mimeType,
      request.tenantId,
      generationId,
    );

    return reply.send({ success: true, data: analysis });
  });

  // GET /api/reference-analyzer/generation/:generationId
  fastify.get<{ Params: { generationId: string } }>(
    '/generation/:generationId',
    async (request, reply) => {
      const list = await service.listForGeneration(
        request.params.generationId,
        request.tenantId,
      );
      return reply.send({ success: true, data: list });
    },
  );

  // GET /api/reference-analyzer/:id
  fastify.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const analysis = await service.getAnalysis(request.params.id, request.tenantId);
    return reply.send({ success: true, data: analysis });
  });
}
