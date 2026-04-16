// =============================================================================
// ThumbForge AI — Prompt Builder Routes
// POST /api/prompt-builder/build           — build structured prompt
// POST /api/prompt-builder/build-all       — build 6 variant prompts
// POST /api/prompt-builder/from-analysis   — build from reference analysis
// =============================================================================

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { PromptBuilderService } from './prompt-builder.service.js';
import { authenticate } from '../../shared/middlewares/authenticate.js';
import { VariantType } from '@thumbforge/shared';

const variantTypeSchema = z.nativeEnum(VariantType);

const subjectSchema = z.object({
  description: z.string().min(1).max(300),
  scale:       z.enum(['small', 'medium', 'large']),
  position:    z.enum(['left', 'right', 'center']),
});

const expressionSchema = z.object({
  emotion:   z.enum(['neutral', 'shocked', 'excited', 'confident', 'aggressive', 'focused', 'happy']),
  intensity: z.enum(['subtle', 'moderate', 'extreme']),
});

const poseSchema = z.object({
  type:      z.enum(['frontal', 'three-quarter', 'profile', 'action', 'closeup']),
  direction: z.enum(['left', 'right', 'camera']).optional(),
});

const objectSchema = z.object({
  name:        z.string().min(1).max(100),
  prominence:  z.enum(['background', 'accent', 'foreground', 'dominant']),
  position:    z.string().optional(),
});

const backgroundSchema = z.object({
  type:        z.enum(['solid', 'gradient', 'scene', 'blurred', 'abstract']),
  description: z.string().min(1).max(300),
  complexity:  z.enum(['minimal', 'moderate', 'complex']),
});

const lightingSchema = z.object({
  style:         z.enum(['flat', 'studio', 'dramatic', 'ambient', 'neon']),
  rimLight:      z.boolean().default(false),
  glowColor:     z.string().optional(),
  glowIntensity: z.enum(['none', 'subtle', 'medium', 'intense']),
});

const paletteSchema = z.object({
  primary:   z.string(),
  secondary: z.string().optional(),
  accent:    z.string().optional(),
  mood:      z.enum(['dark', 'vibrant', 'neon', 'pastel', 'monochrome']),
});

const compositionSchema = z.object({
  layout:        z.enum(['centered', 'left-dominant', 'right-dominant', 'split']),
  textPosition:  z.enum([
    'top-left', 'top-center', 'top-right',
    'middle-left', 'middle-center', 'middle-right',
    'bottom-left', 'bottom-center', 'bottom-right',
  ]).optional(),
  textContent:   z.string().max(200).optional(),
  textHierarchy: z.enum(['title-only', 'title-subtitle', 'multiple']).optional(),
  hasCTA:        z.boolean().default(false),
});

const readabilitySchema = z.object({
  priority:   z.enum(['low', 'medium', 'high']),
  contrast:   z.enum(['low', 'normal', 'high']),
  fontWeight: z.enum(['regular', 'bold', 'black']),
});

const ctrSchema = z.object({
  strategy:  z.enum(['curiosity', 'shock', 'value', 'authority', 'urgency']),
  intensity: z.enum(['subtle', 'moderate', 'aggressive']),
});

const buildBodySchema = z.object({
  subject:          subjectSchema,
  expression:       expressionSchema,
  pose:             poseSchema,
  objects:          z.array(objectSchema).default([]),
  background:       backgroundSchema,
  lighting:         lightingSchema,
  palette:          paletteSchema,
  composition:      compositionSchema,
  style:            z.enum(['gamer', 'cinematic', 'clean', 'high-energy', 'dramatic', 'minimal']),
  readability:      readabilitySchema,
  ctrFocus:         ctrSchema,
  variantType:      variantTypeSchema.optional(),
  freeTextOverride: z.string().max(500).optional(),
});

const fromAnalysisBodySchema = z.object({
  referenceAnalysisId: z.string().uuid(),
  variantType:         variantTypeSchema.optional(),
  overrides:           buildBodySchema.partial().optional(),
});

export async function promptBuilderRoutes(fastify: FastifyInstance): Promise<void> {
  const service = new PromptBuilderService();

  fastify.addHook('preHandler', authenticate);

  // POST /api/prompt-builder/build
  fastify.post('/build', async (request, reply) => {
    const input = buildBodySchema.parse(request.body);
    const result = service.build(input);
    return reply.send({ success: true, data: result });
  });

  // POST /api/prompt-builder/build-all  (returns all 6 variant prompts)
  fastify.post('/build-all', async (request, reply) => {
    const input = buildBodySchema.parse(request.body);
    const results = service.buildAllVariants(input);
    return reply.send({ success: true, data: results });
  });

  // POST /api/prompt-builder/from-analysis
  fastify.post('/from-analysis', async (request, reply) => {
    const { referenceAnalysisId, variantType, overrides } =
      fromAnalysisBodySchema.parse(request.body);

    const { ReferenceAnalyzerService } = await import('../reference-analyzer/reference-analyzer.service.js');
    const analyzerSvc = new ReferenceAnalyzerService();
    const analysis = await analyzerSvc.getAnalysis(referenceAnalysisId, request.tenantId);

    const result = service.buildFromAnalysis(
      analysis,
      (overrides ?? {}) as Partial<import('@thumbforge/shared').PromptBuilderInput>,
      variantType,
    );

    return reply.send({ success: true, data: result });
  });
}
