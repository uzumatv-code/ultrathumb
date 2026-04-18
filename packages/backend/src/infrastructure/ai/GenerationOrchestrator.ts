// =============================================================================
// ThumbForge AI — Generation Orchestrator (AI Pipeline)
// Supports both one-shot generation and layer-based composition workflows.
// =============================================================================

import sharp from 'sharp';
import {
  AssetRole,
  AssetType,
  GenerationRenderMode,
  LayerType,
} from '@prisma/client';
import { prisma } from '../database/client.js';
import { storageService } from '../storage/StorageService.js';
import { OpenAIProvider } from './providers/OpenAIProvider.js';
import { RemoveBgProvider } from './providers/RemoveBgProvider.js';
import type { AIImageProviderInterface, GenerationRequest, ImagePartGenerationResult } from './AIProviderInterface.js';
import { logger } from '../../shared/utils/logger.js';
import { AIProviderError } from '../../shared/errors/AppError.js';
import type {
  BuiltImagePartPrompt,
  BuiltPrompt,
  CompositionStyleConfig,
  CompositionTextLayer,
  GenerationWorkflowMode,
  ReferenceAnalysisFull,
  StructuredPrompt,
  StyleConfig,
  TemplateIntelligenceInput,
  VariantType,
  VisualStyle,
} from '@thumbforge/shared';
import { ReferenceAnalyzerService } from '../../modules/reference-analyzer/reference-analyzer.service.js';
import { PromptBuilderService } from '../../modules/prompt-builder/prompt-builder.service.js';
import { ThumbnailWorkflowService } from '../../modules/generations/thumbnail-workflow.service.js';
import {
  CompositorService,
  type CompositionLayerInput,
} from '../../modules/thumbnail-finisher/compositor.service.js';

const PREVIEW_WIDTH = parseInt(process.env['PREVIEW_WIDTH'] ?? '480');
const PREVIEW_HEIGHT = parseInt(process.env['PREVIEW_HEIGHT'] ?? '270');
const WATERMARK_TEXT = process.env['PREVIEW_WATERMARK_TEXT'] ?? 'THUMBFORGE PREVIEW';
const WATERMARK_OPACITY = parseFloat(process.env['PREVIEW_WATERMARK_OPACITY'] ?? '0.4');
const HD_WIDTH = parseInt(process.env['HD_WIDTH'] ?? '1280');
const HD_HEIGHT = parseInt(process.env['HD_HEIGHT'] ?? '720');

interface TemplateLayerSnapshot {
  id: string;
  name: string;
  type: LayerType;
  zIndex: number;
  x: number;
  y: number;
  width: number | null;
  height: number | null;
  opacity: number;
  blendMode: string;
  isVisible: boolean;
  config: unknown;
}

interface GenerationAssetSnapshot {
  id: string;
  type: AssetType;
  role: AssetRole;
  key: string | null;
  sourceAssetId: string | null;
  originalFilename: string;
  storagePath: string;
  mimeType: string;
  fileSizeBytes: number;
  width: number | null;
  height: number | null;
  isProcessed: boolean;
  metadata: unknown;
}

interface GenerationRecord {
  id: string;
  tenantId: string;
  userId: string;
  freeTextPrompt: string | null;
  styleConfig: unknown;
  metadata: unknown;
  renderMode: GenerationRenderMode;
  canvasWidth: number;
  canvasHeight: number;
  assets: GenerationAssetSnapshot[];
  template: {
    defaultStyleConfig: unknown;
    defaultPromptHints: string | null;
    name: string;
    layers: TemplateLayerSnapshot[];
  } | null;
}

interface LoadedGenerationAsset extends GenerationAssetSnapshot {
  buffer: Buffer;
}

interface LoadedGenerationAssets {
  reference?: LoadedGenerationAsset | undefined;
  person?: LoadedGenerationAsset | undefined;
  backgroundUi?: LoadedGenerationAsset | undefined;
  backgrounds: LoadedGenerationAsset[];
  objects: LoadedGenerationAsset[];
  effects: LoadedGenerationAsset[];
  logos: LoadedGenerationAsset[];
  badges: LoadedGenerationAsset[];
  icons: LoadedGenerationAsset[];
  other: LoadedGenerationAsset[];
  all: LoadedGenerationAsset[];
}

interface GenerationMetadata {
  workflowMode?: GenerationWorkflowMode | undefined;
  variantTypes?: VariantType[] | undefined;
  templateModeInput?: TemplateIntelligenceInput | undefined;
  selectedLayoutIds?: string[] | undefined;
}

interface PipelineContext {
  metadata: GenerationMetadata;
  referenceAnalysis?: ReferenceAnalysisFull | undefined;
  structuredPrompt: StructuredPrompt;
  styleConfig: StyleConfig;
  builtPrompts?: BuiltPrompt[] | undefined;
  variantTypes: VariantType[];
  variantsCount: number;
}

interface ProcessedVariantRecord {
  generationId: string;
  variantIndex: number;
  status: 'PENDING_PAYMENT';
  hdStoragePath: string;
  previewStoragePath: string;
  thumbnailStoragePath: string;
  previewUrl: string;
  thumbnailUrl: string;
  templateAdherenceScore: number;
  textReadabilityScore: number;
  visualImpactScore: number;
  revisedPrompt: string | null;
}

interface GenerationLayerRecordInput {
  generationId: string;
  variantIndex?: number | null | undefined;
  assetId?: string | null | undefined;
  name: string;
  type: LayerType;
  zIndex: number;
  x: number;
  y: number;
  width?: number | null | undefined;
  height?: number | null | undefined;
  opacity: number;
  blendMode: string;
  rotation: number;
  isVisible: boolean;
  config: Record<string, unknown>;
}

interface PipelineResult {
  variantRecords: ProcessedVariantRecord[];
  layerRecords: GenerationLayerRecordInput[];
  finalPrompt: string;
  estimatedCostCents: number;
  actualCostCents: number;
  promptTokens: number;
  completionTokens: number;
  modelUsed: string;
  durationMs: number;
}

interface PreparedCompositionAssets {
  subjectCutout?: LoadedGenerationAsset | undefined;
  objectCutouts: LoadedGenerationAsset[];
}

type PipelineLogger = Pick<typeof logger, 'info'>;

export class GenerationOrchestrator {
  private provider: AIImageProviderInterface;
  private removeBgProvider: RemoveBgProvider;
  private referenceAnalyzer: ReferenceAnalyzerService;
  private promptBuilder: PromptBuilderService;
  private workflowService: ThumbnailWorkflowService;
  private compositor: CompositorService;

  constructor(provider?: AIImageProviderInterface) {
    this.provider = provider ?? new OpenAIProvider();
    this.removeBgProvider = new RemoveBgProvider();
    this.referenceAnalyzer = new ReferenceAnalyzerService();
    this.promptBuilder = new PromptBuilderService();
    this.workflowService = new ThumbnailWorkflowService(this.promptBuilder);
    this.compositor = new CompositorService();
  }

  async execute(
    generationId: string,
    options: { variantTypes?: VariantType[] } = {},
  ): Promise<void> {
    const log = logger.child({ generationId });
    log.info('Starting generation pipeline');

    const generation = await prisma.generationRequest.findUniqueOrThrow({
      where: { id: generationId },
      include: {
        assets: true,
        template: {
          select: {
            defaultStyleConfig: true,
            defaultPromptHints: true,
            name: true,
            layers: true,
          },
        },
      },
    }) as GenerationRecord;

    await prisma.generationRequest.update({
      where: { id: generationId },
      data: { status: 'PROCESSING', startedAt: new Date() },
    });

    try {
      log.info('Loading generation assets');
      const loadedAssets = await this.loadAssets(generation.assets);
      const context = await this.prepareContext(generation, loadedAssets, options);
      const useComposition = this.shouldUseCompositionPipeline(generation, context.metadata, loadedAssets);

      log.info(
        {
          renderMode: generation.renderMode,
          workflowMode: context.metadata.workflowMode ?? 'reference',
          useComposition,
          variantsCount: context.variantsCount,
        },
        'Generation mode resolved',
      );

      const pipelineResult = useComposition
        ? await this.executeCompositePipeline(generation, loadedAssets, context, log)
        : await this.executeOneShotPipeline(generation, loadedAssets, context, log);

      if (pipelineResult.layerRecords.length > 0) {
        await prisma.generationLayer.deleteMany({ where: { generationId } });
        await prisma.generationLayer.createMany({
          data: pipelineResult.layerRecords.map((layer) => ({
            generationId: layer.generationId,
            variantIndex: layer.variantIndex ?? null,
            assetId: layer.assetId ?? null,
            name: layer.name,
            type: layer.type,
            zIndex: layer.zIndex,
            x: layer.x,
            y: layer.y,
            width: layer.width ?? null,
            height: layer.height ?? null,
            opacity: layer.opacity,
            blendMode: layer.blendMode,
            rotation: layer.rotation,
            isVisible: layer.isVisible,
            config: layer.config as object,
          })),
        });
      }

      for (const record of pipelineResult.variantRecords) {
        await prisma.generationVariant.create({ data: record });
      }

      await prisma.generationPrompt.create({
        data: {
          generationId,
          referenceAnalysisRaw: context.referenceAnalysis as object,
          structuredPromptJson: {
            ...context.structuredPrompt,
            finalPrompt: pipelineResult.finalPrompt,
          } as object,
          finalPrompt: pipelineResult.finalPrompt,
          promptVersion: '2.1',
        },
      });

      await prisma.generationRequest.update({
        where: { id: generationId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          estimatedCostCents: pipelineResult.estimatedCostCents,
          actualCostCents: pipelineResult.actualCostCents,
          tokensUsed: pipelineResult.promptTokens + pipelineResult.completionTokens,
          modelUsed: pipelineResult.modelUsed,
          durationMs: pipelineResult.durationMs,
          referenceAnalysis: context.referenceAnalysis as object,
          structuredPromptJson: {
            ...context.structuredPrompt,
            finalPrompt: pipelineResult.finalPrompt,
          } as object,
        },
      });

      await prisma.usageCounter.updateMany({
        where: {
          tenantId: generation.tenantId,
          periodYear: new Date().getFullYear(),
          periodMonth: new Date().getMonth() + 1,
        },
        data: {
          estimatedCostCents: { increment: pipelineResult.estimatedCostCents },
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

  private async prepareContext(
    generation: GenerationRecord,
    loadedAssets: LoadedGenerationAssets,
    options: { variantTypes?: VariantType[] },
  ): Promise<PipelineContext> {
    const metadata = (generation.metadata ?? {}) as GenerationMetadata;
    const styleConfig = this.mergeStyleConfig(
      generation.template?.defaultStyleConfig ?? null,
      generation.styleConfig,
    );

    const referenceAnalysis = await this.analyzeReference(generation, loadedAssets);
    const structuredPrompt: StructuredPrompt = {
      styleConfig,
      targetAudience: 'gamers',
      platform: 'youtube',
      finalPrompt: '',
      ...(referenceAnalysis ? { referenceAnalysis } : {}),
      ...(generation.freeTextPrompt
        ? { freeTextInstructions: generation.freeTextPrompt }
        : {}),
      ...(generation.template?.defaultPromptHints
        ? { templateContext: generation.template.defaultPromptHints }
        : {}),
    };

    const explicitVariantTypes = options.variantTypes ?? metadata.variantTypes ?? [];
    let builtPrompts: BuiltPrompt[] | undefined;

    if (metadata.workflowMode === 'template' && metadata.templateModeInput) {
      builtPrompts = this.workflowService.buildTemplateModePrompts({
        input: metadata.templateModeInput,
        selectedLayoutIds: metadata.selectedLayoutIds,
        styleConfig,
        ...(referenceAnalysis ? { referenceAnalysis } : {}),
      });
    } else if (explicitVariantTypes.length > 0 && referenceAnalysis) {
      builtPrompts = explicitVariantTypes.map((variantType) =>
        this.promptBuilder.buildFromAnalysis(
          referenceAnalysis,
          {
            style: (styleConfig.visualStyle ?? 'gamer') as VisualStyle,
            composition: {
              layout: referenceAnalysis.layout,
              textContent: styleConfig.text ?? undefined,
              hasCTA: referenceAnalysis.hasCTA,
            },
          },
          variantType,
        ),
      );
    }

    const variantTypes = builtPrompts?.map((prompt) => prompt.variantType)
      ?? (explicitVariantTypes.length > 0 ? explicitVariantTypes : this.defaultVariantTypes());

    return {
      metadata,
      referenceAnalysis,
      structuredPrompt,
      styleConfig,
      builtPrompts,
      variantTypes,
      variantsCount: builtPrompts?.length ?? variantTypes.length,
    };
  }

  private async executeOneShotPipeline(
    generation: GenerationRecord,
    loadedAssets: LoadedGenerationAssets,
    context: PipelineContext,
    log: PipelineLogger,
  ): Promise<PipelineResult> {
    log.info('Executing one-shot pipeline');
    const startTime = Date.now();

    const request: GenerationRequest = {
      generationId: generation.id,
      referenceImageBuffer: loadedAssets.reference?.buffer,
      personImageBuffer: loadedAssets.person?.buffer,
      assetBuffers: loadedAssets.objects.map((asset) => asset.buffer),
      structuredPrompt: context.structuredPrompt,
      freeTextPrompt: generation.freeTextPrompt ?? undefined,
      variantsCount: context.variantsCount,
      variantTypes: context.variantTypes,
      builtPrompts: context.builtPrompts,
    };

    const result = await this.provider.generateVariants(request);

    const variantRecords = await Promise.all(
      result.variants.map((variant) =>
        this.processVariant(
          generation.tenantId,
          generation.id,
          variant.index,
          variant.imageBuffer,
          variant.variantType,
          variant.revisedPrompt,
        ),
      ),
    );

    return {
      variantRecords,
      layerRecords: [],
      finalPrompt: result.variants[0]?.revisedPrompt
        ?? context.builtPrompts?.[0]?.finalPrompt
        ?? generation.freeTextPrompt
        ?? 'One-shot generation',
      estimatedCostCents: result.estimatedCostCents,
      actualCostCents: result.estimatedCostCents,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      modelUsed: result.modelUsed,
      durationMs: Date.now() - startTime,
    };
  }

  private async executeCompositePipeline(
    generation: GenerationRecord,
    loadedAssets: LoadedGenerationAssets,
    context: PipelineContext,
    log: PipelineLogger,
  ): Promise<PipelineResult> {
    log.info('Executing composition pipeline');
    const startTime = Date.now();
    const composition = this.resolveCompositionConfig(context.styleConfig);
    const preparedAssets = await this.prepareCompositionAssets(generation, loadedAssets, log);
    const layerRecords: GenerationLayerRecordInput[] = [];
    const variantRecords: ProcessedVariantRecord[] = [];

    let estimatedCostCents = 0;
    let actualCostCents = 0;
    let modelUsed = this.provider.name;
    let finalPrompt = 'Composite thumbnail composition';

    for (let variantIndex = 1; variantIndex <= context.variantsCount; variantIndex += 1) {
      const variantType = context.variantTypes[variantIndex - 1];
      const backgroundPrompt = this.promptBuilder.buildBackgroundPartPrompt({
        analysis: context.referenceAnalysis,
        styleConfig: context.styleConfig,
        description: this.describeGeneratedBackground(context.referenceAnalysis, composition),
        freeTextInstructions: generation.freeTextPrompt ?? undefined,
        variantType,
      });

      const [rightBackground, effectsOverlay] = await Promise.all([
        this.resolveBackgroundPlate(
          generation,
          loadedAssets,
          context,
          backgroundPrompt,
          variantIndex,
        ),
        this.resolveEffectsPlate(
          generation,
          loadedAssets,
          context,
          composition,
          variantType,
          variantIndex,
        ),
      ]);

      estimatedCostCents += rightBackground.generated?.estimatedCostCents ?? 0;
      actualCostCents += rightBackground.generated?.estimatedCostCents ?? 0;
      estimatedCostCents += effectsOverlay.generated?.estimatedCostCents ?? 0;
      actualCostCents += effectsOverlay.generated?.estimatedCostCents ?? 0;
      modelUsed = rightBackground.generated?.modelUsed
        ?? effectsOverlay.generated?.modelUsed
        ?? modelUsed;
      finalPrompt = backgroundPrompt.finalPrompt;

      const leftPlate = loadedAssets.backgroundUi ?? loadedAssets.reference ?? loadedAssets.backgrounds[0];

      const compositionPlan = this.buildCompositionPlan({
        generation,
        composition,
        styleConfig: context.styleConfig,
        variantIndex,
        leftPlate,
        rightPlate: rightBackground.asset,
        subjectCutout: preparedAssets.subjectCutout,
        objectCutouts: preparedAssets.objectCutouts,
        effectsOverlay: effectsOverlay.asset,
      });

      const composed = await this.compositor.compose({
        width: generation.canvasWidth || HD_WIDTH,
        height: generation.canvasHeight || HD_HEIGHT,
        background: '#06070b',
        dividerStyle: composition.dividerStyle ?? 'diagonal',
        layers: compositionPlan.layers,
        textLayers: compositionPlan.textLayers,
      });

      variantRecords.push(
        await this.processVariant(
          generation.tenantId,
          generation.id,
          variantIndex,
          composed.buffer,
          variantType,
          backgroundPrompt.finalPrompt,
        ),
      );

      layerRecords.push(
        ...compositionPlan.layerRecords.map((layer) => ({
          ...layer,
          generationId: generation.id,
          variantIndex,
        })),
      );
    }

    return {
      variantRecords,
      layerRecords,
      finalPrompt,
      estimatedCostCents,
      actualCostCents,
      promptTokens: 0,
      completionTokens: 0,
      modelUsed,
      durationMs: Date.now() - startTime,
    };
  }

  private buildCompositionPlan(input: {
    generation: GenerationRecord;
    composition: CompositionStyleConfig;
    styleConfig: StyleConfig;
    variantIndex: number;
    leftPlate?: LoadedGenerationAsset | undefined;
    rightPlate?: LoadedGenerationAsset | undefined;
    subjectCutout?: LoadedGenerationAsset | undefined;
    objectCutouts: LoadedGenerationAsset[];
    effectsOverlay?: LoadedGenerationAsset | undefined;
  }): {
    layers: CompositionLayerInput[];
    layerRecords: GenerationLayerRecordInput[];
    textLayers: CompositionTextLayer[];
  } {
    const width = input.generation.canvasWidth || HD_WIDTH;
    const height = input.generation.canvasHeight || HD_HEIGHT;
    const splitX = Math.round(width * 0.54);
    const rightStart = splitX - 42;
    const leftWidth = splitX + 30;
    const rightWidth = width - rightStart;
    const layers: CompositionLayerInput[] = [];
    const layerRecords: GenerationLayerRecordInput[] = [];

    if (input.leftPlate) {
      layers.push({
        name: 'background_ui_left',
        kind: 'image',
        zIndex: 0,
        x: 0,
        y: 0,
        width: leftWidth,
        height,
        fit: 'cover',
        buffer: input.leftPlate.buffer,
      });
      layerRecords.push({
        generationId: input.generation.id,
        assetId: input.leftPlate.id,
        name: 'background_ui_left',
        type: LayerType.BACKGROUND,
        zIndex: 0,
        x: 0,
        y: 0,
        width: leftWidth,
        height,
        opacity: 1,
        blendMode: 'over',
        rotation: 0,
        isVisible: true,
        config: { sourceType: input.leftPlate.type },
      });
    }

    if (input.rightPlate) {
      layers.push({
        name: 'background_generated_right',
        kind: 'image',
        zIndex: 10,
        x: rightStart,
        y: 0,
        width: rightWidth,
        height,
        fit: 'cover',
        blurPx: input.composition.backgroundBlurPx ?? 1.2,
        buffer: input.rightPlate.buffer,
      });
      layerRecords.push({
        generationId: input.generation.id,
        assetId: input.rightPlate.id,
        name: 'background_generated_right',
        type: LayerType.BACKGROUND,
        zIndex: 10,
        x: rightStart,
        y: 0,
        width: rightWidth,
        height,
        opacity: 1,
        blendMode: 'over',
        rotation: 0,
        isVisible: true,
        config: {
          sourceType: input.rightPlate.type,
          blurPx: input.composition.backgroundBlurPx ?? 1.2,
        },
      });
    }

    const divider = this.compositor.buildDividerLayer(
      width,
      height,
      input.composition.dividerStyle ?? 'diagonal',
    );
    layers.push(divider);
    layerRecords.push({
      generationId: input.generation.id,
      name: 'divider',
      type: LayerType.SHAPE,
      zIndex: divider.zIndex,
      x: 0,
      y: 0,
      width,
      height,
      opacity: 1,
      blendMode: 'over',
      rotation: 0,
      isVisible: true,
      config: {
        dividerStyle: input.composition.dividerStyle ?? 'diagonal',
      },
    });

    if (input.subjectCutout) {
      const subjectWidth = Math.round(width * 0.42);
      const subjectHeight = Math.round(height * 0.88);
      const subjectX = this.resolveSubjectXPosition(
        input.composition.subjectPosition,
        width,
        subjectWidth,
      );
      const subjectY = Math.round(height * 0.06);
      const rimColor = input.composition.rimLightColor
        ?? input.styleConfig.glowColor
        ?? input.styleConfig.dominantColor
        ?? '#ffb347';
      const rimOpacity = Math.min(
        1,
        Math.max(0.25, (input.composition.rimLightIntensity ?? input.styleConfig.glowIntensity ?? 70) / 100),
      );

      layers.push({
        name: 'subject_cutout',
        kind: 'image',
        zIndex: 30,
        x: subjectX,
        y: subjectY,
        width: subjectWidth,
        height: subjectHeight,
        fit: 'contain',
        brightness: 1.03,
        saturation: 1.06,
        buffer: input.subjectCutout.buffer,
        rimLight: {
          color: rimColor,
          opacity: rimOpacity,
          blur: 22,
          offsetX: -10,
          offsetY: 0,
        },
        dropShadow: {
          color: '#000000',
          opacity: 0.42,
          blur: 20,
          offsetX: 0,
          offsetY: 18,
        },
      });
      layerRecords.push({
        generationId: input.generation.id,
        assetId: input.subjectCutout.id,
        name: 'subject_cutout',
        type: LayerType.SUBJECT,
        zIndex: 30,
        x: subjectX,
        y: subjectY,
        width: subjectWidth,
        height: subjectHeight,
        opacity: 1,
        blendMode: 'over',
        rotation: 0,
        isVisible: true,
        config: {
          rimLightColor: rimColor,
          rimLightIntensity: rimOpacity,
        },
      });
    }

    const [primaryObject, ...secondaryObjects] = input.objectCutouts;
    if (primaryObject) {
      const objectWidth = Math.round(width * 0.3);
      const objectHeight = Math.round(height * 0.33);
      const objectX = this.resolveObjectXPosition(
        input.composition.objectPosition,
        width,
        objectWidth,
      );
      const objectY = height - objectHeight - 24;

      layers.push({
        name: 'foreground_object_primary',
        kind: 'image',
        zIndex: 40,
        x: objectX,
        y: objectY,
        width: objectWidth,
        height: objectHeight,
        fit: 'contain',
        buffer: primaryObject.buffer,
        dropShadow: {
          color: '#000000',
          opacity: 0.5,
          blur: 22,
          offsetX: 0,
          offsetY: 14,
        },
      });
      layerRecords.push({
        generationId: input.generation.id,
        assetId: primaryObject.id,
        name: 'foreground_object_primary',
        type: LayerType.OBJECT,
        zIndex: 40,
        x: objectX,
        y: objectY,
        width: objectWidth,
        height: objectHeight,
        opacity: 1,
        blendMode: 'over',
        rotation: 0,
        isVisible: true,
        config: { prominence: 'primary' },
      });
    }

    secondaryObjects.slice(0, 2).forEach((asset, index) => {
      const accentWidth = Math.round(width * 0.16);
      const accentHeight = Math.round(height * 0.18);
      const accentX = 32 + (index * Math.round(accentWidth * 0.9));
      const accentY = height - accentHeight - 36;

      layers.push({
        name: `foreground_object_accent_${index + 1}`,
        kind: 'image',
        zIndex: 41 + index,
        x: accentX,
        y: accentY,
        width: accentWidth,
        height: accentHeight,
        fit: 'contain',
        opacity: 0.95,
        buffer: asset.buffer,
      });
      layerRecords.push({
        generationId: input.generation.id,
        assetId: asset.id,
        name: `foreground_object_accent_${index + 1}`,
        type: LayerType.OBJECT,
        zIndex: 41 + index,
        x: accentX,
        y: accentY,
        width: accentWidth,
        height: accentHeight,
        opacity: 0.95,
        blendMode: 'over',
        rotation: 0,
        isVisible: true,
        config: { prominence: 'accent' },
      });
    });

    if (input.effectsOverlay) {
      layers.push({
        name: 'effects_overlay',
        kind: 'image',
        zIndex: 50,
        x: 0,
        y: 0,
        width,
        height,
        fit: 'cover',
        opacity: 0.52,
        blendMode: 'screen',
        buffer: input.effectsOverlay.buffer,
      });
      layerRecords.push({
        generationId: input.generation.id,
        assetId: input.effectsOverlay.id,
        name: 'effects_overlay',
        type: LayerType.OVERLAY,
        zIndex: 50,
        x: 0,
        y: 0,
        width,
        height,
        opacity: 0.52,
        blendMode: 'screen',
        rotation: 0,
        isVisible: true,
        config: { sourceType: input.effectsOverlay.type },
      });
    }

    const textLayers = this.resolveTextLayers(input.styleConfig, input.composition, width, height, splitX);

    return { layers, layerRecords, textLayers };
  }

  private async prepareCompositionAssets(
    generation: GenerationRecord,
    loadedAssets: LoadedGenerationAssets,
    log: PipelineLogger,
  ): Promise<PreparedCompositionAssets> {
    let subjectCutout: LoadedGenerationAsset | undefined;
    const objectCutouts: LoadedGenerationAsset[] = [];

    if (loadedAssets.person) {
      log.info('Removing background from subject asset');
      subjectCutout = await this.persistProcessedAsset(
        generation,
        loadedAssets.person,
        'subject_cutout',
        AssetType.PERSON,
      );
    }

    for (const [index, objectAsset] of loadedAssets.objects.entries()) {
      log.info({ assetId: objectAsset.id }, 'Removing background from object asset');
      objectCutouts.push(
        await this.persistProcessedAsset(
          generation,
          objectAsset,
          `object_cutout_${index + 1}`,
          AssetType.OBJECT,
        ),
      );
    }

    return { subjectCutout, objectCutouts };
  }

  private async resolveBackgroundPlate(
    generation: GenerationRecord,
    loadedAssets: LoadedGenerationAssets,
    context: PipelineContext,
    prompt: BuiltImagePartPrompt,
    variantIndex: number,
  ): Promise<{
    asset?: LoadedGenerationAsset | undefined;
    generated?: ImagePartGenerationResult | undefined;
  }> {
    const provided = loadedAssets.backgrounds[variantIndex - 1] ?? loadedAssets.backgrounds[0];
    if (provided) {
      return { asset: provided };
    }

    const generated = await this.provider.generateImagePart({
      generationId: generation.id,
      partType: 'background',
      prompt: prompt.finalPrompt,
      width: generation.canvasWidth || HD_WIDTH,
      height: generation.canvasHeight || HD_HEIGHT,
      variantIndex,
      variantType: context.variantTypes[variantIndex - 1],
      referenceImageBuffer: loadedAssets.reference?.buffer,
      builtPrompt: prompt,
    });

    const asset = await this.persistGeneratedAsset(
      generation,
      generated.imageBuffer,
      AssetType.BACKGROUND,
      `background_right_variant_${variantIndex}`,
      `background_right_variant_${variantIndex}.png`,
      {
        promptVersion: prompt.promptVersion,
        variantType: context.variantTypes[variantIndex - 1] ?? null,
      },
    );

    return { asset, generated };
  }

  private async resolveEffectsPlate(
    generation: GenerationRecord,
    loadedAssets: LoadedGenerationAssets,
    context: PipelineContext,
    composition: CompositionStyleConfig,
    variantType: VariantType | undefined,
    variantIndex: number,
  ): Promise<{
    asset?: LoadedGenerationAsset | undefined;
    generated?: ImagePartGenerationResult | undefined;
  }> {
    const provided = loadedAssets.effects[variantIndex - 1] ?? loadedAssets.effects[0];
    if (provided) {
      return { asset: provided };
    }

    if (!composition.generatedEffectsPrompt && (context.styleConfig.glowIntensity ?? 0) < 35) {
      return {};
    }

    const prompt = this.promptBuilder.buildEffectsPartPrompt({
      analysis: context.referenceAnalysis,
      styleConfig: context.styleConfig,
      freeTextInstructions: generation.freeTextPrompt ?? undefined,
      variantType,
    });

    const generated = await this.provider.generateImagePart({
      generationId: generation.id,
      partType: 'effects',
      prompt: prompt.finalPrompt,
      width: generation.canvasWidth || HD_WIDTH,
      height: generation.canvasHeight || HD_HEIGHT,
      variantIndex,
      variantType,
      builtPrompt: prompt,
    });

    const asset = await this.persistGeneratedAsset(
      generation,
      generated.imageBuffer,
      AssetType.EFFECT,
      `effects_overlay_variant_${variantIndex}`,
      `effects_overlay_variant_${variantIndex}.png`,
      {
        promptVersion: prompt.promptVersion,
        variantType: variantType ?? null,
      },
    );

    return { asset, generated };
  }

  private async persistProcessedAsset(
    generation: GenerationRecord,
    sourceAsset: LoadedGenerationAsset,
    key: string,
    assetType: AssetType,
  ): Promise<LoadedGenerationAsset> {
    const removed = await this.removeBgProvider.removeBackground(sourceAsset.buffer);

    return this.persistGeneratedAsset(
      generation,
      removed.imageBuffer,
      assetType,
      key,
      `${key}.png`,
      { provider: removed.provider },
      sourceAsset.id,
      AssetRole.PROCESSED,
    );
  }

  private async persistGeneratedAsset(
    generation: GenerationRecord,
    buffer: Buffer,
    assetType: AssetType,
    key: string,
    filename: string,
    metadata: Record<string, unknown>,
    sourceAssetId?: string | undefined,
    role: AssetRole = AssetRole.GENERATED,
  ): Promise<LoadedGenerationAsset> {
    const normalized = await sharp(buffer).rotate().ensureAlpha().png().toBuffer();
    const imageMeta = await sharp(normalized).metadata();
    const storagePath = storageService.buildProcessedAssetPath(
      generation.tenantId,
      generation.id,
      key,
      'png',
    );

    await storageService.uploadPrivate(storagePath, normalized, {
      contentType: 'image/png',
      metadata: {
        generationId: generation.id,
        key,
        type: assetType,
        role,
      },
    });

    const created = await prisma.generationAsset.create({
      data: {
        generationId: generation.id,
        type: assetType,
        role,
        key,
        sourceAssetId: sourceAssetId ?? null,
        originalFilename: filename,
        storagePath,
        mimeType: 'image/png',
        fileSizeBytes: normalized.length,
        width: imageMeta.width ?? null,
        height: imageMeta.height ?? null,
        isProcessed: role !== AssetRole.INPUT,
        metadata: metadata as object,
      },
    });

    return {
      ...created,
      metadata: created.metadata,
      buffer: normalized,
    } as LoadedGenerationAsset;
  }

  private shouldUseCompositionPipeline(
    generation: GenerationRecord,
    metadata: GenerationMetadata,
    loadedAssets: LoadedGenerationAssets,
  ): boolean {
    return (
      generation.renderMode === GenerationRenderMode.COMPOSITE ||
      metadata.workflowMode === 'composition' ||
      (generation.template?.layers.length ?? 0) > 0 ||
      Boolean(loadedAssets.backgroundUi) ||
      Boolean((this.mergeStyleConfig(generation.template?.defaultStyleConfig ?? null, generation.styleConfig).composition?.enabled))
    );
  }

  private async analyzeReference(
    generation: GenerationRecord,
    loadedAssets: LoadedGenerationAssets,
  ): Promise<ReferenceAnalysisFull | undefined> {
    const referenceAsset = loadedAssets.reference;
    if (!referenceAsset) {
      return undefined;
    }

    try {
      return await this.referenceAnalyzer.analyzeStoragePath(
        referenceAsset.storagePath,
        referenceAsset.mimeType,
        generation.tenantId,
        generation.id,
      );
    } catch (error) {
      logger.warn({ err: error, generationId: generation.id }, 'Reference analysis failed');
      return undefined;
    }
  }

  private mergeStyleConfig(
    templateConfig: unknown,
    generationStyleConfig: unknown,
  ): StyleConfig {
    return {
      ...((templateConfig ?? {}) as object),
      ...((generationStyleConfig ?? {}) as object),
    } as StyleConfig;
  }

  private resolveCompositionConfig(styleConfig: StyleConfig): CompositionStyleConfig {
    return {
      preset: 'split-ui-hero',
      dividerStyle: 'diagonal',
      nativeText: true,
      subjectPosition: 'right',
      objectPosition: 'center-bottom',
      rimLightIntensity: styleConfig.glowIntensity ?? 70,
      rimLightColor: styleConfig.glowColor ?? styleConfig.dominantColor ?? '#ffb347',
      ...(styleConfig.composition ?? {}),
    };
  }

  private resolveTextLayers(
    styleConfig: StyleConfig,
    composition: CompositionStyleConfig,
    width: number,
    height: number,
    splitX: number,
  ): CompositionTextLayer[] {
    if (composition.textLayers?.length) {
      return composition.textLayers;
    }

    const shouldRenderText = composition.nativeText !== false && Boolean(styleConfig.text);
    if (!shouldRenderText || !styleConfig.text) {
      return [];
    }

    return [{
      text: styleConfig.text,
      x: 36,
      y: Math.round(height * 0.07),
      width: Math.max(220, splitX - 72),
      fontSize: styleConfig.fontSize ?? 94,
      fontFamily: styleConfig.fontFamily ?? 'Arial Black',
      fontWeight: 'black',
      fill: styleConfig.fontColor ?? '#ffffff',
      stroke: styleConfig.fontOutlineColor ?? '#111111',
      strokeWidth: styleConfig.fontOutlineWidth ?? 10,
      shadowColor: styleConfig.glowColor ?? '#000000',
      shadowBlur: 16,
      align: 'left',
      letterSpacing: 1.2,
      uppercase: true,
    }];
  }

  private describeGeneratedBackground(
    analysis: ReferenceAnalysisFull | undefined,
    composition: CompositionStyleConfig,
  ): string {
    if (composition.generatedBackgroundPrompt) {
      return composition.generatedBackgroundPrompt;
    }

    if (!analysis) {
      return 'warm, high-contrast gaming environment with depth, sunlight, blur and empty space for a facecam cutout';
    }

    const theme = analysis.semanticTheme || 'gaming';
    const backgroundType = analysis.backgroundType || 'scene';
    const palette = analysis.dominantColors.join(', ');
    return `${theme} ${backgroundType} scene, cinematic depth, warm sunlight, subtle atmospheric blur, palette ${palette}`;
  }

  private resolveSubjectXPosition(
    position: CompositionStyleConfig['subjectPosition'],
    canvasWidth: number,
    subjectWidth: number,
  ): number {
    if (position === 'left') return 48;
    if (position === 'center') return Math.round((canvasWidth - subjectWidth) / 2);
    return canvasWidth - subjectWidth - 28;
  }

  private resolveObjectXPosition(
    position: CompositionStyleConfig['objectPosition'],
    canvasWidth: number,
    objectWidth: number,
  ): number {
    if (position === 'left-bottom') return 44;
    if (position === 'right-bottom') return canvasWidth - objectWidth - 44;
    return Math.round((canvasWidth - objectWidth) / 2);
  }

  private defaultVariantTypes(): VariantType[] {
    return ['VIRAL', 'CLEAN', 'DRAMATICA'] as VariantType[];
  }

  private async loadAssets(assets: GenerationAssetSnapshot[]): Promise<LoadedGenerationAssets> {
    const loaded: LoadedGenerationAssets = {
      backgrounds: [],
      objects: [],
      effects: [],
      logos: [],
      badges: [],
      icons: [],
      other: [],
      all: [],
    };

    const loadedAssets = await Promise.all(
      assets.map(async (asset) => ({
        ...asset,
        metadata: asset.metadata,
        buffer: await storageService.getPrivateObject(asset.storagePath),
      })) as Array<Promise<LoadedGenerationAsset>>,
    );

    for (const asset of loadedAssets) {
      loaded.all.push(asset);
      if (asset.type === AssetType.REFERENCE && !loaded.reference) {
        loaded.reference = asset;
      } else if (asset.type === AssetType.PERSON && asset.role === AssetRole.INPUT && !loaded.person) {
        loaded.person = asset;
      } else if (asset.type === AssetType.BACKGROUND_UI && !loaded.backgroundUi) {
        loaded.backgroundUi = asset;
      } else if (asset.type === AssetType.BACKGROUND && asset.role === AssetRole.INPUT) {
        loaded.backgrounds.push(asset);
      } else if (asset.type === AssetType.OBJECT && asset.role === AssetRole.INPUT) {
        loaded.objects.push(asset);
      } else if (asset.type === AssetType.EFFECT && asset.role === AssetRole.INPUT) {
        loaded.effects.push(asset);
      } else if (asset.type === AssetType.LOGO) {
        loaded.logos.push(asset);
      } else if (asset.type === AssetType.BADGE) {
        loaded.badges.push(asset);
      } else if (asset.type === AssetType.ICON) {
        loaded.icons.push(asset);
      } else if (asset.type === AssetType.OTHER) {
        loaded.other.push(asset);
      }
    }

    return loaded;
  }

  private async processVariant(
    tenantId: string,
    generationId: string,
    variantIndex: number,
    imageBuffer: Buffer,
    variantType?: VariantType,
    revisedPrompt?: string,
  ): Promise<ProcessedVariantRecord> {
    const hdBuffer = await sharp(imageBuffer)
      .resize(HD_WIDTH, HD_HEIGHT, { fit: 'cover' })
      .webp({ quality: 90 })
      .toBuffer();

    const previewBuffer = await this.createPreview(imageBuffer);
    const thumbBuffer = await sharp(imageBuffer)
      .resize(200, 113, { fit: 'cover' })
      .webp({ quality: 75 })
      .toBuffer();

    const scores = await this.calculateScores(imageBuffer);
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
      status: 'PENDING_PAYMENT',
      hdStoragePath: hdPath,
      previewStoragePath: previewPath,
      thumbnailStoragePath: thumbPath,
      previewUrl,
      thumbnailUrl,
      templateAdherenceScore: scores.adherence,
      textReadabilityScore: scores.readability,
      visualImpactScore: scores.impact,
      revisedPrompt: revisedPrompt ?? variantType ?? null,
    };
  }

  private async createPreview(imageBuffer: Buffer): Promise<Buffer> {
    const smallBuffer = await sharp(imageBuffer)
      .resize(PREVIEW_WIDTH, PREVIEW_HEIGHT, { fit: 'cover' })
      .webp({ quality: 70 })
      .toBuffer();

    const watermarkSvg = this.buildWatermarkSvg(PREVIEW_WIDTH, PREVIEW_HEIGHT);

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
    const rows = Math.ceil(height / 80);
    const cols = Math.ceil(width / 200);

    const texts: string[] = [];
    for (let row = -1; row <= rows; row += 1) {
      for (let col = -1; col <= cols; col += 1) {
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
    try {
      const stats = await sharp(imageBuffer).stats();
      const channels = stats.channels;
      const avgStdDev = channels.reduce((sum, channel) => sum + channel.stdev, 0) / channels.length;
      const impact = Math.min(100, Math.round((avgStdDev / 128) * 100));
      const readability = 82;
      const adherence = 84;

      return { adherence, readability, impact };
    } catch {
      return { adherence: 75, readability: 75, impact: 75 };
    }
  }
}
