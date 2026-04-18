// =============================================================================
// ThumbForge AI - Generations Routes
// =============================================================================

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  GenerationsService,
  type UploadedGenerationFile,
} from './generations.service.js';
import { GenerationCreativeService } from './generation-creative.service.js';
import { ThumbnailWorkflowService } from './thumbnail-workflow.service.js';
import { authenticate } from '../../shared/middlewares/authenticate.js';
import { VariantType } from '@thumbforge/shared';

const styleConfigSchema = z.object({
  fontFamily: z.string().optional(),
  fontSize: z.number().min(8).max(200).optional(),
  fontColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  fontOutlineColor: z.string().optional(),
  fontOutlineWidth: z.number().min(0).max(20).optional(),
  textPosition: z.enum([
    'top-left', 'top-center', 'top-right',
    'middle-left', 'middle-center', 'middle-right',
    'bottom-left', 'bottom-center', 'bottom-right',
  ]).optional(),
  text: z.string().max(200).optional(),
  glowIntensity: z.number().min(0).max(100).optional(),
  glowColor: z.string().optional(),
  dominantColors: z.array(z.string()).optional(),
  visualStyle: z.enum(['gamer', 'cinematic', 'clean', 'high-energy', 'dramatic', 'minimal']).optional(),
  workflowMode: z.enum(['reference', 'template', 'editor']).optional(),
  dominantColor: z.string().optional(),
  game: z.string().max(100).optional(),
  videoType: z.string().max(100).optional(),
  emotion: z.string().max(100).optional(),
  mainObject: z.string().max(100).optional(),
  facecamStyle: z.string().max(100).optional(),
  realismGoal: z.enum(['maintain', 'realistic', 'punchier']).optional(),
  templateLayoutId: z.string().max(100).optional(),
});

const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(10),
  status: z.enum(['QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED']).optional(),
  templateId: z.string().uuid().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

const semanticPreserveSchema = z.enum([
  'layout',
  'subject',
  'background',
  'lighting',
  'palette',
  'objects',
  'text',
  'style',
]);

const semanticDraftBodySchema = z.object({
  baseVariantId: z.string().uuid().optional(),
  prompt: z.string().min(3).max(500),
  preserve: z.array(semanticPreserveSchema).optional(),
});

const variantTypesSchema = z.array(z.nativeEnum(VariantType)).min(1).max(6);

const templateModeInputSchema = z.object({
  game: z.string().min(2).max(100),
  videoType: z.string().min(2).max(100),
  emotion: z.string().min(2).max(100),
  mainObject: z.string().min(2).max(100),
  text: z.string().max(120).optional(),
  dominantColor: z.string().min(2).max(30),
  facecamStyle: z.string().min(2).max(100),
});

export async function generationsRoutes(fastify: FastifyInstance): Promise<void> {
  const service = new GenerationsService();
  const creativeService = new GenerationCreativeService();
  const workflowService = new ThumbnailWorkflowService();

  fastify.addHook('preHandler', authenticate);

  fastify.post('/template-layouts', async (request, reply) => {
    const input = templateModeInputSchema.parse(request.body);
    const layouts = workflowService.generateTemplateLayouts(input);
    return reply.send({ success: true, data: layouts });
  });

  fastify.post('/', async (request, reply) => {
    const parts = request.parts();
    const fields: Record<string, string> = {};
    const files: Record<string, UploadedGenerationFile[]> = {};

    for await (const part of parts) {
      if (part.type === 'file') {
        const chunks: Buffer[] = [];
        for await (const chunk of part.file) {
          chunks.push(chunk);
        }
        const buffer = Buffer.concat(chunks);
        const file: UploadedGenerationFile = {
          fieldname: part.fieldname,
          originalname: part.filename ?? 'upload',
          mimetype: part.mimetype,
          buffer,
          size: buffer.length,
        };

        if (!files[part.fieldname]) files[part.fieldname] = [];
        files[part.fieldname]!.push(file);
      } else {
        const value = await (part as { value: string }).value;
        fields[part.fieldname] = value;
      }
    }

    const styleConfig = fields['styleConfig']
      ? styleConfigSchema.parse(JSON.parse(fields['styleConfig']))
      : {};
    const variantTypes = fields['variantTypes']
      ? variantTypesSchema.parse(JSON.parse(fields['variantTypes']))
      : undefined;
    const workflowMode = fields['workflowMode']
      ? z.enum(['reference', 'template', 'editor']).parse(fields['workflowMode'])
      : undefined;
    const templateModeInput = fields['templateModeInput']
      ? templateModeInputSchema.parse(JSON.parse(fields['templateModeInput']))
      : undefined;
    const selectedLayoutIds = fields['selectedLayoutIds']
      ? z.array(z.string().min(1).max(100)).min(1).max(4).parse(JSON.parse(fields['selectedLayoutIds']))
      : undefined;

    const generation = await service.createGeneration({
      tenantId: request.tenantId,
      userId: request.user.sub,
      templateId: fields['templateId'],
      savedModelId: fields['savedModelId'],
      freeTextPrompt: fields['freeTextPrompt'],
      styleConfig,
      variantTypes,
      workflowMode,
      templateModeInput,
      selectedLayoutIds,
      files: {
        reference: files['reference'],
        person: files['person'],
        assets: files['assets'],
      },
    });

    return reply.code(202).send({
      success: true,
      data: {
        id: generation.id,
        status: generation.status,
        message: 'Generation queued. You will be notified when complete.',
      },
    });
  });

  fastify.get('/', async (request, reply) => {
    const query = listQuerySchema.parse(request.query);

    const result = await service.listGenerations(request.tenantId, {
      page: query.page,
      limit: query.limit,
      status: query.status,
      templateId: query.templateId,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
    });

    return reply.send({
      success: true,
      data: result.items,
      meta: {
        page: query.page,
        limit: query.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / query.limit),
      },
    });
  });

  fastify.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const generation = await service.getGeneration(
      request.params.id,
      request.tenantId,
    );
    return reply.send({ success: true, data: generation });
  });

  fastify.get<{ Params: { id: string } }>('/:id/creative-summary', async (request, reply) => {
    const summary = await creativeService.getCreativeSummary(
      request.params.id,
      request.tenantId,
    );
    return reply.send({ success: true, data: summary });
  });

  fastify.post<{ Params: { id: string } }>('/:id/semantic-edit-draft', async (request, reply) => {
    const body = semanticDraftBodySchema.parse(request.body);
    const draft = await creativeService.createSemanticEditDraft(
      request.params.id,
      request.tenantId,
      body,
    );
    return reply.send({ success: true, data: draft });
  });

  fastify.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const result = await service.cancelGeneration(
      request.params.id,
      request.tenantId,
    );
    return reply.send({ success: true, data: result });
  });
}
