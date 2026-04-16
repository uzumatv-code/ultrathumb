// =============================================================================
// ThumbForge AI — Semantic Editor Routes
// POST /api/semantic-editor/:generationId/draft    — preview edit (no persist)
// POST /api/semantic-editor/:generationId/commit   — persist EditOperation
// POST /api/semantic-editor/operations/:id/apply   — dispatch new generation
// GET  /api/semantic-editor/:generationId/history  — list edit operations
// GET  /api/semantic-editor/operations/:id         — get single operation
// =============================================================================

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { SemanticEditorService } from './semantic-editor.service.js';
import { authenticate } from '../../shared/middlewares/authenticate.js';

const preserveSchema = z.enum([
  'layout', 'subject', 'background', 'lighting', 'palette', 'objects', 'text', 'style',
]);

const editBodySchema = z.object({
  baseVariantId: z.string().uuid().optional(),
  prompt:        z.string().min(3).max(500),
  preserve:      z.array(preserveSchema).optional(),
});

export async function semanticEditorRoutes(fastify: FastifyInstance): Promise<void> {
  const service = new SemanticEditorService();

  fastify.addHook('preHandler', authenticate);

  // POST /api/semantic-editor/:generationId/draft
  fastify.post<{ Params: { generationId: string } }>(
    '/:generationId/draft',
    async (request, reply) => {
      const body = editBodySchema.parse(request.body);
      const draft = await service.draft(request.params.generationId, request.tenantId, body);
      return reply.send({ success: true, data: draft });
    },
  );

  // POST /api/semantic-editor/:generationId/commit
  fastify.post<{ Params: { generationId: string } }>(
    '/:generationId/commit',
    async (request, reply) => {
      const body = editBodySchema.parse(request.body);
      const op = await service.commit(
        request.params.generationId,
        request.tenantId,
        request.user.sub,
        body,
      );
      return reply.code(201).send({ success: true, data: op });
    },
  );

  // POST /api/semantic-editor/operations/:id/apply
  fastify.post<{ Params: { id: string } }>(
    '/operations/:id/apply',
    async (request, reply) => {
      const result = await service.apply(
        request.params.id,
        request.tenantId,
        request.user.sub,
      );
      return reply.code(202).send({ success: true, data: result });
    },
  );

  // GET /api/semantic-editor/:generationId/history
  fastify.get<{ Params: { generationId: string } }>(
    '/:generationId/history',
    async (request, reply) => {
      const history = await service.getHistory(
        request.params.generationId,
        request.tenantId,
      );
      return reply.send({ success: true, data: history });
    },
  );

  // GET /api/semantic-editor/operations/:id
  fastify.get<{ Params: { id: string } }>(
    '/operations/:id',
    async (request, reply) => {
      const op = await service.getOperation(request.params.id, request.tenantId);
      return reply.send({ success: true, data: op });
    },
  );
}
