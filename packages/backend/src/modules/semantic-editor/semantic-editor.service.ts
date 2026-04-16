// =============================================================================
// ThumbForge AI — Semantic Editor Service
// Parses natural-language edit commands, persists EditOperation,
// and optionally dispatches a new generation with the delta applied.
// =============================================================================

import { prisma } from '../../infrastructure/database/client.js';
import { GenerationOrchestrator } from '../../infrastructure/ai/GenerationOrchestrator.js';
import { logger } from '../../shared/utils/logger.js';
import {
  NotFoundError,
  ValidationError,
  ForbiddenError,
} from '../../shared/errors/AppError.js';
import type {
  SemanticEditPreserve,
  SemanticEditChangeSet,
  SemanticEditDraft,
  EditOperationDTO,
} from '@thumbforge/shared';

// ─── Command parser (mirrors generation-creative.service but with persistence) ─

function uniquePreserve(arr: SemanticEditPreserve[]): SemanticEditPreserve[] {
  return [...new Set(arr)];
}

export function parseSemanticCommand(
  generationId: string,
  baseVariantId: string | null | undefined,
  promptText: string,
  preserveHints: SemanticEditPreserve[] = [],
): SemanticEditDraft {
  const lower = promptText.toLowerCase().trim();
  const preserve = uniquePreserve(preserveHints.length ? preserveHints : ['layout', 'lighting']);

  const change: SemanticEditChangeSet = {
    subject:          'keep',
    visualDensity:    'keep',
    background:       'keep',
    subjectScale:     'keep',
    glowIntensity:    'keep',
    objectFocus:      'keep',
    textTreatment:    'keep',
    styleDirective:   'keep',
    compositionLock:  'preserve',
  };

  const delta: string[] = [];

  // Subject
  if (/(troca|substitui|replace).*(pessoa|rosto|subject)/.test(lower)) {
    change.subject = 'replace';
    delta.push('replace subject while preserving composition');
  }
  if (/(melhora|enhance).*(pessoa|rosto|subject)/.test(lower)) {
    change.subject = 'enhance';
    delta.push('enhance subject quality');
  }

  // Scale
  if (/(rosto maior|bigger face|rosto grande|close.?up)/.test(lower)) {
    change.subjectScale = 'larger';
    delta.push('increase subject scale');
  }
  if (/(rosto menor|smaller face|afasta)/.test(lower)) {
    change.subjectScale = 'smaller';
    delta.push('decrease subject scale');
  }

  // Visual density
  if (/(clean|limpa|limpo|menos polui|menos elementos|menos bagun)/.test(lower)) {
    change.visualDensity = 'reduce';
    if (change.styleDirective === 'keep') change.styleDirective = 'more_clean';
    delta.push('reduce visual density');
  }
  if (/(mais elementos|mais objetos|preenche mais|mais denso)/.test(lower)) {
    change.visualDensity = 'increase';
    delta.push('increase visual density');
  }

  // Style directive
  if (/(viral|ctr|mais click|click bait|youtube)/.test(lower)) {
    change.styleDirective = 'more_viral';
    delta.push('increase viral thumbnail energy');
  }
  if (/(premium|luxo|high.?end|profissional)/.test(lower)) {
    change.styleDirective = 'more_premium';
    delta.push('push premium finish and polish');
  }
  if (/(fps|gaming|gamer|jogo)/.test(lower) && change.styleDirective === 'keep') {
    change.styleDirective = 'more_gaming';
    delta.push('lean into gaming thumbnail language');
  }
  if (/(dram[aá]t|agressiv|tenso|épico)/.test(lower) && change.styleDirective === 'keep') {
    change.styleDirective = 'more_dramatic';
    delta.push('intensify dramatic lighting and tension');
  }

  // Palette
  if (/(roxo|purple|viol[eê]ta)/.test(lower)) {
    change.paletteShift = 'shift_to_purple';
    delta.push('shift dominant palette toward purple');
  }
  if (/(verde|green)/.test(lower) && /(roxo|purple)/.test(lower)) {
    change.paletteShift = 'green_to_purple';
    delta.push('convert green accents to purple');
  }
  if (/(azul|blue|ciano)/.test(lower)) {
    change.paletteShift = 'shift_to_blue';
    delta.push('shift palette toward blue/cyan');
  }
  if (/(vermelho|red|laranja|orange)/.test(lower)) {
    change.paletteShift = 'shift_to_red';
    delta.push('shift palette toward red/orange');
  }

  // Glow
  if (/(menos glow|reduce glow|sem glow|tira o glow)/.test(lower)) {
    change.glowIntensity = 'lower';
    delta.push('reduce glow accents');
  } else if (/(mais glow|glow|brilho|neon)/.test(lower)) {
    change.glowIntensity = 'higher';
    delta.push('increase glow accents');
  }

  // Background
  if (/(blur|desfoca|fundo desfocado)/.test(lower)) {
    change.background = 'blur';
    delta.push('blur the background');
  } else if (/(simplif|limpa o fundo|fundo simples)/.test(lower)) {
    change.background = 'simplify';
    delta.push('simplify the background');
  } else if (/(troca o fundo|muda o fundo|outro fundo|replace.*back)/.test(lower)) {
    change.background = 'replace';
    delta.push('replace the background');
  }

  // Text
  if (/(sem texto|remove.*texto|tira.*texto)/.test(lower)) {
    change.textTreatment = 'remove';
    delta.push('remove text treatment');
  } else if (/(adiciona texto|coloca texto|add.*text|headline|título)/.test(lower)) {
    change.textTreatment = 'add';
    delta.push('add headline treatment');
  } else if (/(melhora.*texto|refine.*text|arruma o texto)/.test(lower)) {
    change.textTreatment = 'refine';
    delta.push('refine text treatment');
  }

  // Facial expression
  if (/(chocad|assustad|surpres|shock|wow)/.test(lower)) {
    change.facialExpression = 'more_shocked';
    delta.push('increase shocked facial expression');
  } else if (/(confiante|confident|seguro|firme)/.test(lower)) {
    change.facialExpression = 'more_confident';
    delta.push('shift expression toward confidence');
  } else if (/(agressiv|raiva|bravo|angry)/.test(lower)) {
    change.facialExpression = 'more_aggressive';
    delta.push('shift expression toward aggression');
  } else if (/(animado|empolg|excit|hype)/.test(lower)) {
    change.facialExpression = 'more_excited';
    delta.push('shift expression toward excitement');
  } else if (/(focado|focus|concentrad|serio)/.test(lower)) {
    change.facialExpression = 'more_focused';
    delta.push('shift expression toward focus');
  }

  // Object focus
  if (/(destaca|highlight|item principal|faca|weapon|objeto principal|arma)/.test(lower)) {
    change.objectFocus = 'increase';
    delta.push('increase focus on the main object');
  }

  // Composition rebalance
  if (/(rebalance|recompõe|reposiciona|recompose)/.test(lower)) {
    change.compositionLock = 'rebalance';
    delta.push('rebalance composition');
  }

  if (!delta.length) {
    delta.push('preserve base layout and apply targeted refinement');
  }

  return {
    generationId,
    baseVariantId: baseVariantId ?? null,
    sourcePrompt: promptText.trim(),
    normalizedRequest: {
      baseVariantId: baseVariantId ?? undefined,
      prompt: promptText.trim(),
      preserve,
      change,
    },
    promptDelta: delta,
    previewSummary: delta.join(', '),
  };
}

// ─── Service ───────────────────────────────────────────────────────────────────

export class SemanticEditorService {
  // ── Draft: parse command, return preview without persisting ───────────────
  async draft(
    generationId: string,
    tenantId: string,
    input: {
      baseVariantId?: string | undefined;
      prompt: string;
      preserve?: SemanticEditPreserve[] | undefined;
    },
  ): Promise<SemanticEditDraft> {
    const generation = await prisma.generationRequest.findFirst({
      where: { id: generationId, tenantId },
      include: { variants: { select: { id: true }, take: 1 } },
    });
    if (!generation) throw new NotFoundError('Generation', generationId);

    const baseVariantId = input.baseVariantId ?? generation.variants[0]?.id ?? null;
    return parseSemanticCommand(generationId, baseVariantId, input.prompt, input.preserve);
  }

  // ── Commit: persist EditOperation with DRAFT status ───────────────────────
  async commit(
    generationId: string,
    tenantId: string,
    userId: string,
    input: {
      baseVariantId?: string | undefined;
      prompt: string;
      preserve?: SemanticEditPreserve[] | undefined;
    },
  ): Promise<EditOperationDTO> {
    const generation = await prisma.generationRequest.findFirst({
      where: { id: generationId, tenantId },
      include: { variants: { select: { id: true }, take: 1 } },
    });
    if (!generation) throw new NotFoundError('Generation', generationId);
    if (generation.status !== 'COMPLETED') {
      throw new ValidationError('Can only edit completed generations');
    }

    const baseVariantId = input.baseVariantId ?? generation.variants[0]?.id ?? null;
    const draft = parseSemanticCommand(generationId, baseVariantId, input.prompt, input.preserve);

    const op = await prisma.editOperation.create({
      data: {
        tenantId,
        userId,
        sourceGenerationId: generationId,
        baseVariantId,
        status: 'COMMITTED',
        promptText: input.prompt.trim(),
        preserveList: draft.normalizedRequest.preserve,
        changeSet: draft.normalizedRequest.change as object,
        promptDelta: draft.promptDelta,
        previewSummary: draft.previewSummary,
      },
    });

    return this.mapToDTO(op);
  }

  // ── Apply: commit + dispatch new generation ────────────────────────────────
  async apply(
    editOperationId: string,
    tenantId: string,
    userId: string,
  ): Promise<{ editOperation: EditOperationDTO; newGenerationId: string }> {
    const op = await prisma.editOperation.findFirst({
      where: { id: editOperationId, tenantId },
    });
    if (!op) throw new NotFoundError('EditOperation', editOperationId);
    if (op.userId !== userId) throw new ForbiddenError();
    if (op.status !== 'COMMITTED') {
      throw new ValidationError(`Cannot apply edit in status ${op.status}`);
    }

    // Load source generation to copy its config
    const sourceGen = await prisma.generationRequest.findUniqueOrThrow({
      where: { id: op.sourceGenerationId },
      include: { assets: true },
    });

    // Build the delta-applied styleConfig
    const changeSet = op.changeSet as SemanticEditChangeSet;
    const baseStyleConfig = sourceGen.styleConfig as Record<string, unknown>;
    const patchedStyleConfig = this.applyChangeSetToStyle(baseStyleConfig, changeSet);

    // Build augmented freeTextPrompt incorporating the delta
    const deltaText = (op.promptDelta as string[]).join('. ');
    const augmentedPrompt = `${op.promptText}. Apply: ${deltaText}`;

    // Create new generation record
    const newGen = await prisma.generationRequest.create({
      data: {
        tenantId,
        userId,
        templateId: sourceGen.templateId,
        status: 'QUEUED',
        freeTextPrompt: augmentedPrompt,
        styleConfig: patchedStyleConfig as object,
        quotaCounted: false, // edits don't count against quota
      },
    });

    // Copy assets to new generation (re-use same storage paths)
    if (sourceGen.assets.length > 0) {
      await prisma.generationAsset.createMany({
        data: sourceGen.assets.map((a) => ({
          generationId: newGen.id,
          type: a.type,
          originalFilename: a.originalFilename,
          storagePath: a.storagePath,
          mimeType: a.mimeType,
          fileSizeBytes: a.fileSizeBytes,
        })),
      });
    }

    // Update edit operation to PROCESSING
    const updatedOp = await prisma.editOperation.update({
      where: { id: editOperationId },
      data: {
        status: 'PROCESSING',
        resultGenerationId: newGen.id,
        appliedAt: new Date(),
      },
    });

    // Dispatch to queue (or inline)
    const orchestrator = new GenerationOrchestrator();
    if (process.env['REDIS_DISABLED'] === 'true' || process.env['GENERATION_INLINE'] === 'true') {
      setTimeout(() => {
        void orchestrator.execute(newGen.id).then(async () => {
          await prisma.editOperation.update({
            where: { id: editOperationId },
            data: { status: 'COMPLETED' },
          });
        }).catch(async (err: unknown) => {
          logger.error({ err, editOperationId }, 'Semantic edit generation failed');
          await prisma.editOperation.update({
            where: { id: editOperationId },
            data: { status: 'FAILED' },
          });
        });
      }, 0);
    } else {
      const { generationAiQueue } = await import('../../infrastructure/queue/queues/index.js');
      await generationAiQueue.add(
        'generate',
        { generationId: newGen.id, tenantId, userId },
        { priority: 2 },
      );
    }

    logger.info({ editOperationId, newGenerationId: newGen.id }, 'Semantic edit dispatched');

    return {
      editOperation: this.mapToDTO(updatedOp),
      newGenerationId: newGen.id,
    };
  }

  // ── History ───────────────────────────────────────────────────────────────
  async getHistory(generationId: string, tenantId: string): Promise<EditOperationDTO[]> {
    const ops = await prisma.editOperation.findMany({
      where: { sourceGenerationId: generationId, tenantId },
      orderBy: { createdAt: 'desc' },
    });
    return ops.map((op) => this.mapToDTO(op));
  }

  async getOperation(id: string, tenantId: string): Promise<EditOperationDTO> {
    const op = await prisma.editOperation.findFirst({ where: { id, tenantId } });
    if (!op) throw new NotFoundError('EditOperation', id);
    return this.mapToDTO(op);
  }

  // ── Private helpers ───────────────────────────────────────────────────────
  private applyChangeSetToStyle(
    base: Record<string, unknown>,
    change: SemanticEditChangeSet,
  ): Record<string, unknown> {
    const patched = { ...base };

    if (change.visualDensity === 'reduce') {
      patched['glowIntensity'] = Math.max(0, Number(patched['glowIntensity'] ?? 40) - 25);
    }
    if (change.visualDensity === 'increase') {
      patched['glowIntensity'] = Math.min(100, Number(patched['glowIntensity'] ?? 40) + 25);
    }
    if (change.glowIntensity === 'higher') {
      patched['glowIntensity'] = Math.min(100, Number(patched['glowIntensity'] ?? 60) + 20);
    }
    if (change.glowIntensity === 'lower') {
      patched['glowIntensity'] = Math.max(0, Number(patched['glowIntensity'] ?? 60) - 20);
    }
    if (change.styleDirective && change.styleDirective !== 'keep') {
      const styleMap: Record<string, string> = {
        more_clean:    'clean',
        more_viral:    'high-energy',
        more_premium:  'minimal',
        more_gaming:   'gamer',
        more_dramatic: 'dramatic',
      };
      patched['visualStyle'] = styleMap[change.styleDirective] ?? patched['visualStyle'];
    }

    return patched;
  }

  private mapToDTO(op: {
    id: string;
    sourceGenerationId: string;
    baseVariantId: string | null;
    resultGenerationId: string | null;
    status: string;
    promptText: string;
    preserveList: unknown;
    changeSet: unknown;
    promptDelta: unknown;
    previewSummary: string;
    createdAt: Date;
  }): EditOperationDTO {
    return {
      id:                  op.id,
      sourceGenerationId:  op.sourceGenerationId,
      baseVariantId:       op.baseVariantId,
      resultGenerationId:  op.resultGenerationId,
      status:              op.status as EditOperationDTO['status'],
      promptText:          op.promptText,
      preserveList:        (op.preserveList as string[]) ?? [],
      changeSet:           (op.changeSet as Record<string, unknown>) ?? {},
      promptDelta:         (op.promptDelta as string[]) ?? [],
      previewSummary:      op.previewSummary,
      createdAt:           op.createdAt.toISOString(),
    };
  }
}
