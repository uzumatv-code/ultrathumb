// =============================================================================
// ThumbForge AI — Generation Orchestrator (AI Pipeline)
// =============================================================================

import sharp from 'sharp';
import { prisma } from '../database/client.js';
import { storageService } from '../storage/StorageService.js';
import { OpenAIProvider } from './providers/OpenAIProvider.js';
import type { AIImageProviderInterface, GenerationRequest } from './AIProviderInterface.js';
import { logger } from '../../shared/utils/logger.js';
import { AIProviderError } from '../../shared/errors/AppError.js';
import type { ReferenceAnalysis, StructuredPrompt, VariantType } from '@thumbforge/shared';
import { ReferenceAnalyzerService } from '../../modules/reference-analyzer/reference-analyzer.service.js';
import { PromptBuilderService } from '../../modules/prompt-builder/prompt-builder.service.js';

const PREVIEW_WIDTH = parseInt(process.env['PREVIEW_WIDTH'] ?? '480');
const PREVIEW_HEIGHT = parseInt(process.env['PREVIEW_HEIGHT'] ?? '270');
const WATERMARK_TEXT = process.env['PREVIEW_WATERMARK_TEXT'] ?? 'THUMBFORGE PREVIEW';
const WATERMARK_OPACITY = parseFloat(process.env['PREVIEW_WATERMARK_OPACITY'] ?? '0.4');
const HD_WIDTH = parseInt(process.env['HD_WIDTH'] ?? '1280');
const HD_HEIGHT = parseInt(process.env['HD_HEIGHT'] ?? '720');

export class GenerationOrchestrator {
  private provider: AIImageProviderInterface;
  private referenceAnalyzer: ReferenceAnalyzerService;
  private promptBuilder: PromptBuilderService;

  constructor(provider?: AIImageProviderInterface) {
    this.provider = provider ?? new OpenAIProvider();
    this.referenceAnalyzer = new ReferenceAnalyzerService();
    this.promptBuilder = new PromptBuilderService();
  }

  async execute(
    generationId: string,
    options: { variantTypes?: VariantType[] } = {},
  ): Promise<void> {
    const log = logger.child({ generationId });
    log.info('Starting generation pipeline');

    // ── Step 1: Load generation from DB ────────────────────────────────────
    const generation = await prisma.generationRequest.findUniqueOrThrow({
      where: { id: generationId },
      include: {
        assets: true,
        template: {
          select: { defaultStyleConfig: true, defaultPromptHints: true, name: true },
        },
      },
    });

    await prisma.generationRequest.update({
      where: { id: generationId },
      data: { status: 'PROCESSING', startedAt: new Date() },
    });

    try {
      // ── Step 2: Load asset buffers from storage ─────────────────────────
      log.info('Loading assets from storage');
      const assetBuffers = await this.loadAssets(generation.assets);

      // ── Step 3: Analyze reference image (persisted) ─────────────────────
      let referenceAnalysis: ReferenceAnalysis | undefined;
      const refAsset = generation.assets.find((a) => a.type === 'REFERENCE');

      if (assetBuffers.reference && refAsset) {
        log.info('Analyzing reference thumbnail via Vision API');
        try {
          const fullAnalysis = await this.referenceAnalyzer.analyzeStoragePath(
            refAsset.storagePath,
            refAsset.mimeType,
            generation.tenantId,
            generationId,
          );
          referenceAnalysis = fullAnalysis;
          log.info({ style: fullAnalysis.style, confidence: fullAnalysis.confidenceScore }, 'Reference analyzed');
        } catch (err) {
          log.warn({ err }, 'Reference analysis failed — continuing without it');
        }
      }

      // ── Step 4: Build structured prompts via PromptBuilderService ────────
      const styleConfig = generation.styleConfig as Record<string, unknown>;
      const templateConfig = generation.template?.defaultStyleConfig as Record<string, unknown> | null;
      const templateHints = generation.template?.defaultPromptHints;

      const structuredPrompt: StructuredPrompt = {
        styleConfig: {
          ...((templateConfig ?? {}) as object),
          ...(styleConfig as object),
        },
        targetAudience: 'gamers',
        platform: 'youtube',
        finalPrompt: '',
        ...(referenceAnalysis ? { referenceAnalysis } : {}),
        ...(generation.freeTextPrompt
          ? { freeTextInstructions: generation.freeTextPrompt }
          : {}),
        ...(templateHints ? { templateContext: templateHints } : {}),
      };

      // Build typed variant prompts if variantTypes provided
      const variantTypes = options.variantTypes ?? [];
      let builtPrompts: import('@thumbforge/shared').BuiltPrompt[] | undefined;

      if (variantTypes.length > 0 && referenceAnalysis) {
        builtPrompts = variantTypes.map((vt) =>
          this.promptBuilder.buildFromAnalysis(
            referenceAnalysis as import('@thumbforge/shared').ReferenceAnalysisFull,
            {
              style: (styleConfig['visualStyle'] as import('@thumbforge/shared').VisualStyle) ?? 'gamer',
              composition: {
                layout: (referenceAnalysis as import('@thumbforge/shared').ReferenceAnalysisFull).layout,
                textContent: (styleConfig['text'] as string) ?? undefined,
                hasCTA: false,
              },
            },
            vt,
          ),
        );
      }

      const variantsCount = variantTypes.length > 0 ? variantTypes.length : 3;

      // ── Step 5: Generate variants ────────────────────────────────────────
      log.info({ variantsCount, typed: variantTypes.length > 0 }, 'Calling AI provider for generation');
      const startTime = Date.now();

      const genRequest: GenerationRequest = {
        generationId,
        referenceImageBuffer: assetBuffers.reference,
        personImageBuffer: assetBuffers.person,
        assetBuffers: assetBuffers.objects,
        structuredPrompt,
        freeTextPrompt: generation.freeTextPrompt ?? undefined,
        variantsCount,
        variantTypes: variantTypes.length > 0 ? variantTypes : undefined,
        builtPrompts,
      };

      const result = await this.provider.generateVariants(genRequest);

      log.info(
        { durationMs: Date.now() - startTime, costCents: result.estimatedCostCents },
        'AI generation complete',
      );

      // ── Step 6: Post-process each variant ──────────────────────────────
      log.info('Post-processing variants');

      const variantRecords = await Promise.all(
        result.variants.map((variant) =>
          this.processVariant(
            generation.tenantId,
            generationId,
            variant.index,
            variant.imageBuffer,
            variant.variantType,
          ),
        ),
      );

      // ── Step 7: Persist results ─────────────────────────────────────────
      log.info('Persisting results to database');

      for (const record of variantRecords) {
        await prisma.generationVariant.create({ data: record });
      }

      // Save prompt audit trail
      await prisma.generationPrompt.create({
        data: {
          generationId,
          referenceAnalysisRaw: referenceAnalysis as object,
          structuredPromptJson: structuredPrompt as object,
          finalPrompt: result.variants[0]?.revisedPrompt ?? structuredPrompt.finalPrompt,
          promptVersion: '1.0',
        },
      });

      // ── Step 8: Mark as completed ───────────────────────────────────────
      await prisma.generationRequest.update({
        where: { id: generationId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          estimatedCostCents: result.estimatedCostCents,
          actualCostCents: result.estimatedCostCents,
          tokensUsed: result.promptTokens + result.completionTokens,
          modelUsed: result.modelUsed,
          durationMs: result.durationMs,
          referenceAnalysis: referenceAnalysis as object,
          structuredPromptJson: structuredPrompt as object,
        },
      });

      // Update AI cost counter
      await prisma.usageCounter.updateMany({
        where: {
          tenantId: generation.tenantId,
          periodYear: new Date().getFullYear(),
          periodMonth: new Date().getMonth() + 1,
        },
        data: {
          estimatedCostCents: { increment: result.estimatedCostCents },
        },
      });

      log.info('Generation pipeline completed successfully');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      const errorCode = err instanceof AIProviderError ? err.code : 'GENERATION_FAILED';

      log.error({ err }, 'Generation pipeline failed');

      await prisma.generationRequest.update({
        where: { id: generationId },
        data: {
          status: 'FAILED',
          errorMessage,
          errorCode,
          retryCount: { increment: 1 },
        },
      });

      throw err;
    }
  }

  // ─── Private Helpers ──────────────────────────────────────────────────────

  private async loadAssets(assets: Array<{ type: string; storagePath: string }>) {
    const buffers: {
      reference?: Buffer;
      person?: Buffer;
      objects: Buffer[];
    } = { objects: [] };

    await Promise.all(
      assets.map(async (asset) => {
        const buffer = await storageService.getPrivateObject(asset.storagePath);
        if (asset.type === 'REFERENCE') buffers.reference = buffer;
        else if (asset.type === 'PERSON') buffers.person = buffer;
        else if (asset.type === 'OBJECT') buffers.objects.push(buffer);
      }),
    );

    return buffers;
  }

  private async processVariant(
    tenantId: string,
    generationId: string,
    variantIndex: number,
    imageBuffer: Buffer,
    variantType?: VariantType,
  ) {
    // Process HD version
    const hdBuffer = await sharp(imageBuffer)
      .resize(HD_WIDTH, HD_HEIGHT, { fit: 'cover' })
      .webp({ quality: 90 })
      .toBuffer();

    // Process preview (low-res + watermark)
    const previewBuffer = await this.createPreview(imageBuffer);

    // Process thumbnail (tiny version)
    const thumbBuffer = await sharp(imageBuffer)
      .resize(200, 113, { fit: 'cover' })
      .webp({ quality: 75 })
      .toBuffer();

    // Calculate scores
    const scores = await this.calculateScores(imageBuffer);

    // Upload to storage
    const hdPath = storageService.buildOutputPath(tenantId, generationId, variantIndex);
    const previewPath = storageService.buildPreviewPath(tenantId, generationId, variantIndex);
    const thumbPath = storageService.buildThumbnailPath(tenantId, generationId, variantIndex);

    const [, previewUrl, thumbnailUrl] = await Promise.all([
      storageService.uploadPrivate(hdPath, hdBuffer, { contentType: 'image/webp' }),
      storageService.uploadPublic(previewPath, previewBuffer, { contentType: 'image/webp' }),
      storageService.uploadPublic(thumbPath, thumbBuffer, { contentType: 'image/webp' }),
    ]);

    return {
      generationId,
      variantIndex,
      status: 'PENDING_PAYMENT' as const,
      hdStoragePath: hdPath,
      previewStoragePath: previewPath,
      thumbnailStoragePath: thumbPath,
      previewUrl,
      thumbnailUrl,
      templateAdherenceScore: scores.adherence,
      textReadabilityScore: scores.readability,
      visualImpactScore: scores.impact,
      // Store variant type in metadata if provided
      ...(variantType ? { revisedPrompt: variantType } : {}),
    };
  }

  private async createPreview(imageBuffer: Buffer): Promise<Buffer> {
    // Resize to low-res
    const smallBuffer = await sharp(imageBuffer)
      .resize(PREVIEW_WIDTH, PREVIEW_HEIGHT, { fit: 'cover' })
      .webp({ quality: 70 })
      .toBuffer();

    // Create watermark SVG overlay (diagonal text repeated)
    const watermarkSvg = this.buildWatermarkSvg(PREVIEW_WIDTH, PREVIEW_HEIGHT);

    // Composite watermark onto image
    return sharp(smallBuffer)
      .composite([
        {
          input: Buffer.from(watermarkSvg),
          blend: 'over',
        },
      ])
      .webp({ quality: 70 })
      .toBuffer();
  }

  private buildWatermarkSvg(width: number, height: number): string {
    const opacity = Math.round(WATERMARK_OPACITY * 255).toString(16).padStart(2, '0');
    const rows = Math.ceil(height / 80);
    const cols = Math.ceil(width / 200);

    const texts: string[] = [];
    for (let row = -1; row <= rows; row++) {
      for (let col = -1; col <= cols; col++) {
        const x = col * 200;
        const y = row * 80 + 50;
        texts.push(
          `<text x="${x}" y="${y}" transform="rotate(-30, ${x}, ${y})"
            font-family="Arial" font-size="14" font-weight="bold"
            fill="white" fill-opacity="${WATERMARK_OPACITY}"
            stroke="black" stroke-width="0.5" stroke-opacity="${WATERMARK_OPACITY * 0.5}">
            ${WATERMARK_TEXT}
          </text>`,
        );
      }
    }

    return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      ${texts.join('\n')}
    </svg>`;
  }

  private async calculateScores(imageBuffer: Buffer): Promise<{
    adherence: number;
    readability: number;
    impact: number;
  }> {
    // Simple heuristic scores based on image stats
    // In production, use Vision API for accurate scoring
    try {
      const stats = await sharp(imageBuffer).stats();
      const channels = stats.channels;

      // Impact score: based on contrast and saturation
      const avgStdDev = channels.reduce((sum, c) => sum + c.stdev, 0) / channels.length;
      const impact = Math.min(100, Math.round((avgStdDev / 128) * 100));

      // Readability: placeholder (would need OCR)
      const readability = 75;

      // Template adherence: placeholder
      const adherence = 80;

      return { adherence, readability, impact };
    } catch {
      return { adherence: 75, readability: 75, impact: 75 };
    }
  }
}
