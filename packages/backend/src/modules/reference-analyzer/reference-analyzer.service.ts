// =============================================================================
// ThumbForge AI — Reference Analyzer Service
// Calls Vision API, extracts full DNA JSON, persists to reference_analyses.
// =============================================================================

import OpenAI from 'openai';
import { prisma } from '../../infrastructure/database/client.js';
import { storageService } from '../../infrastructure/storage/StorageService.js';
import { logger } from '../../shared/utils/logger.js';
import { AIProviderError, NotFoundError } from '../../shared/errors/AppError.js';
import type {
  FacecamPosition,
  FacecamStyleOption,
  ReferenceAnalysisFull,
  ReferenceGuidedFlow,
  ReferenceReadabilityLevel,
} from '@thumbforge/shared';

const VISION_MODEL = process.env['OPENAI_VISION_MODEL'] ?? 'gpt-4o';

const ANALYSIS_SYSTEM_PROMPT = `You are an expert YouTube thumbnail analyst for content creators.
Analyze the thumbnail image and return a structured JSON describing every visual element.
Be precise, specific, and actionable. Return ONLY valid JSON — no markdown, no extra text.`;

const ANALYSIS_USER_PROMPT = `Analyze this YouTube thumbnail and return ONLY a JSON object with this exact structure:
{
  "compositionType": "central" | "diagonal" | "first-person" | "split" | "facecam-overlay",
  "layout": "centered" | "left-dominant" | "right-dominant" | "split",
  "personPosition": "left" | "right" | "center" | "none",
  "objectsPosition": ["string describing position of each object"],
  "backgroundType": "solid" | "gradient" | "scene" | "blurred",
  "dominantColors": ["#hex1", "#hex2", "#hex3"],
  "primaryColor": "#hex1",
  "glowIntensity": "none" | "subtle" | "medium" | "intense",
  "saturationLevel": "low" | "medium" | "high",
  "style": "gamer" | "cinematic" | "clean" | "high-energy" | "dramatic" | "minimal",
  "dominantObject": "main subject or object that grabs attention first",
  "dominantObjectPosition": "short description of where the dominant object is",
  "outlineStyle": "none" | "clean" | "thick" | "neon" | "comic",
  "hasText": boolean,
  "textHierarchy": "title-only" | "title-subtitle" | "multiple" | null,
  "hasCTA": boolean,
  "thumbnailStyle": "gamer" | "clickbait" | "cinematic" | "educational" | "reaction",
  "confidenceScore": 0.0,
  "visualHierarchy": "subject-first" | "object-first" | "text-first" | "balanced",
  "facialEmotion": "neutral" | "confident" | "excited" | "shocked" | "aggressive" | "focused",
  "secondaryColor": "#hex or null",
  "lightingStyle": "flat" | "studio" | "dramatic" | "ambient" | "neon",
  "depth": "flat" | "layered" | "deep",
  "visualDensity": "clean" | "balanced" | "dense",
  "legibilityScore": 0,
  "visualEnergy": "low" | "medium" | "high",
  "facialEmotionIntensity": "low" | "medium" | "high",
  "semanticTheme": "short description of the content theme",
  "textSafeZone": "left" | "right" | "top" | "bottom" | "center" | "none",
  "detectedObjects": ["list of visible objects, weapons, logos, badges"],
  "subjectScale": "small" | "medium" | "large",
  "styleKeywords": ["3-5 keywords describing the visual style"],
  "facecamDetected": boolean,
  "facecamPosition": "top-left" | "top-right" | "bottom-left" | "bottom-right" | "none",
  "facecamStyle": "clean" | "neon" | "cutout" | "rounded" | "none",
  "enemyDetected": boolean,
  "enemyPosition": "left" | "right" | "center" | "none",
  "realismLevel": "stylized" | "hybrid" | "realistic",
  "oneSecondReadability": "weak" | "good" | "excellent",
  "genericPosterArtRisk": "low" | "medium" | "high",
  "foregroundFocus": "main thing visible in foreground",
  "midgroundFocus": "main thing visible in midground",
  "backgroundFocus": "main thing visible in background"
}`;

function getOpenAIClient(): OpenAI {
  return new OpenAI({
    apiKey: process.env['OPENAI_API_KEY'],
    timeout: parseInt(process.env['AI_GENERATION_TIMEOUT_MS'] ?? '60000'),
    maxRetries: 2,
  });
}

function inferCompositionType(
  rawValue: unknown,
  layout: ReferenceAnalysisFull['layout'],
): NonNullable<ReferenceAnalysisFull['compositionType']> {
  if (
    rawValue === 'central' ||
    rawValue === 'diagonal' ||
    rawValue === 'first-person' ||
    rawValue === 'split' ||
    rawValue === 'facecam-overlay'
  ) {
    return rawValue;
  }

  if (layout === 'split') return 'split';
  if (layout === 'centered') return 'central';
  return 'diagonal';
}

function inferFacecamPosition(
  rawValue: unknown,
  facecamDetected: boolean,
): FacecamPosition {
  if (
    rawValue === 'top-left' ||
    rawValue === 'top-right' ||
    rawValue === 'bottom-left' ||
    rawValue === 'bottom-right' ||
    rawValue === 'none'
  ) {
    return rawValue;
  }

  return facecamDetected ? 'top-right' : 'none';
}

function inferFacecamStyle(rawValue: unknown, facecamDetected: boolean): FacecamStyleOption {
  if (
    rawValue === 'clean' ||
    rawValue === 'neon' ||
    rawValue === 'cutout' ||
    rawValue === 'rounded' ||
    rawValue === 'none'
  ) {
    return rawValue;
  }

  return facecamDetected ? 'neon' : 'none';
}

function inferOneSecondReadability(
  rawValue: unknown,
  legibilityScore: number,
): ReferenceReadabilityLevel {
  if (rawValue === 'weak' || rawValue === 'good' || rawValue === 'excellent') {
    return rawValue;
  }

  if (legibilityScore >= 85) return 'excellent';
  if (legibilityScore >= 70) return 'good';
  return 'weak';
}

function coerceAnalysis(raw: Record<string, unknown>): ReferenceAnalysisFull {
  const safeStr = (v: unknown, fallback: string): string =>
    typeof v === 'string' ? v : fallback;
  const safeBool = (v: unknown): boolean => v === true || v === 'true';
  const safeNum = (v: unknown, fallback: number): number =>
    typeof v === 'number' && isFinite(v) ? v : fallback;
  const safeArr = (v: unknown): string[] =>
    Array.isArray(v) ? v.map(String) : [];
  const dominantColors = safeArr(raw['dominantColors']).length
    ? safeArr(raw['dominantColors'])
    : ['#0f172a', '#6366f1', '#f59e0b'];
  const layout = safeStr(raw['layout'], 'split') as ReferenceAnalysisFull['layout'];
  const legibilityScore = safeNum(raw['legibilityScore'], 75);
  const facecamDetected = safeBool(raw['facecamDetected']);

  return {
    layout,
    personPosition: safeStr(raw['personPosition'], 'center') as ReferenceAnalysisFull['personPosition'],
    objectsPosition: safeArr(raw['objectsPosition']),
    backgroundType: safeStr(raw['backgroundType'], 'scene') as ReferenceAnalysisFull['backgroundType'],
    dominantColors,
    glowIntensity: safeStr(raw['glowIntensity'], 'none') as ReferenceAnalysisFull['glowIntensity'],
    style: safeStr(raw['style'], 'gamer') as ReferenceAnalysisFull['style'],
    hasText: safeBool(raw['hasText']),
    ...(raw['textHierarchy']
      ? { textHierarchy: safeStr(raw['textHierarchy'], 'title-only') as 'title-only' | 'title-subtitle' | 'multiple' }
      : {}),
    hasCTA: safeBool(raw['hasCTA']),
    thumbnailStyle: safeStr(raw['thumbnailStyle'], 'gamer') as ReferenceAnalysisFull['thumbnailStyle'],
    confidenceScore: safeNum(raw['confidenceScore'], 0.75),
    visualHierarchy: safeStr(raw['visualHierarchy'], 'subject-first') as ReferenceAnalysisFull['visualHierarchy'],
    facialEmotion: safeStr(raw['facialEmotion'], 'confident') as ReferenceAnalysisFull['facialEmotion'],
    secondaryColor: typeof raw['secondaryColor'] === 'string' ? raw['secondaryColor'] : null,
    lightingStyle: safeStr(raw['lightingStyle'], 'studio') as ReferenceAnalysisFull['lightingStyle'],
    depth: safeStr(raw['depth'], 'layered') as ReferenceAnalysisFull['depth'],
    visualDensity: safeStr(raw['visualDensity'], 'balanced') as ReferenceAnalysisFull['visualDensity'],
    legibilityScore,
    visualEnergy: safeStr(raw['visualEnergy'], 'medium') as ReferenceAnalysisFull['visualEnergy'],
    semanticTheme: safeStr(raw['semanticTheme'], 'gaming'),
    textSafeZone: safeStr(raw['textSafeZone'], 'none') as ReferenceAnalysisFull['textSafeZone'],
    detectedObjects: safeArr(raw['detectedObjects']),
    subjectScale: safeStr(raw['subjectScale'], 'medium') as ReferenceAnalysisFull['subjectScale'],
    styleKeywords: safeArr(raw['styleKeywords']),
    compositionType: inferCompositionType(raw['compositionType'], layout),
    dominantObject: safeStr(raw['dominantObject'], safeArr(raw['detectedObjects'])[0] ?? 'subject'),
    dominantObjectPosition: safeStr(raw['dominantObjectPosition'], safeArr(raw['objectsPosition'])[0] ?? 'center'),
    primaryColor: safeStr(raw['primaryColor'], dominantColors[0] ?? '#0f172a'),
    saturationLevel: safeStr(raw['saturationLevel'], 'medium') as NonNullable<ReferenceAnalysisFull['saturationLevel']>,
    outlineStyle: safeStr(raw['outlineStyle'], 'clean') as NonNullable<ReferenceAnalysisFull['outlineStyle']>,
    facialEmotionIntensity: safeStr(raw['facialEmotionIntensity'], 'medium') as NonNullable<ReferenceAnalysisFull['facialEmotionIntensity']>,
    facecamDetected,
    facecamPosition: inferFacecamPosition(raw['facecamPosition'], facecamDetected),
    facecamStyle: inferFacecamStyle(raw['facecamStyle'], facecamDetected),
    enemyDetected: safeBool(raw['enemyDetected']),
    enemyPosition: safeStr(raw['enemyPosition'], 'none') as NonNullable<ReferenceAnalysisFull['enemyPosition']>,
    realismLevel: safeStr(raw['realismLevel'], 'hybrid') as NonNullable<ReferenceAnalysisFull['realismLevel']>,
    oneSecondReadability: inferOneSecondReadability(raw['oneSecondReadability'], legibilityScore),
    genericPosterArtRisk: safeStr(raw['genericPosterArtRisk'], 'medium') as NonNullable<ReferenceAnalysisFull['genericPosterArtRisk']>,
    foregroundFocus: safeStr(raw['foregroundFocus'], safeStr(raw['dominantObject'], 'subject')),
    midgroundFocus: safeStr(raw['midgroundFocus'], safeStr(raw['semanticTheme'], 'action layer')),
    backgroundFocus: safeStr(raw['backgroundFocus'], 'environment'),
  };
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function glowWeight(glow: ReferenceAnalysisFull['glowIntensity']): number {
  switch (glow) {
    case 'intense':
      return 24;
    case 'medium':
      return 16;
    case 'subtle':
      return 8;
    default:
      return 0;
  }
}

function saturationWeight(level: ReferenceAnalysisFull['saturationLevel']): number {
  switch (level) {
    case 'high':
      return 18;
    case 'medium':
      return 10;
    default:
      return 4;
  }
}

export class ReferenceAnalyzerService {
  // ─── Analyze from raw buffer ───────────────────────────────────────────────
  async analyzeBuffer(
    imageBuffer: Buffer,
    mimeType: string,
    tenantId: string,
    generationId?: string,
  ): Promise<ReferenceAnalysisFull> {
    logger.info({ tenantId, generationId }, 'Starting reference analysis (Vision API)');

    const client = getOpenAIClient();
    const base64 = imageBuffer.toString('base64');
    const dataUrl = `data:${mimeType};base64,${base64}`;

    let rawJson: Record<string, unknown>;

    try {
      const response = await client.chat.completions.create({
        model: VISION_MODEL,
        messages: [
          { role: 'system', content: ANALYSIS_SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              { type: 'text', text: ANALYSIS_USER_PROMPT },
              { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } },
            ],
          },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 800,
      });

      const content = response.choices[0]?.message.content;
      if (!content) throw new AIProviderError('Empty response from vision model');

      rawJson = JSON.parse(content) as Record<string, unknown>;
    } catch (err) {
      logger.warn({ err, tenantId }, 'Vision API failed — using heuristic fallback');
      rawJson = this.heuristicFallback();
    }

    const analysis = coerceAnalysis(rawJson);

    // Persist to DB
    await prisma.referenceAnalysis.create({
      data: {
        tenantId,
        generationId: generationId ?? null,
        layout: analysis.layout,
        personPosition: analysis.personPosition ?? null,
        backgroundType: analysis.backgroundType,
        dominantColors: analysis.dominantColors,
        glowIntensity: analysis.glowIntensity,
        style: analysis.style,
        hasText: analysis.hasText,
        textHierarchy: analysis.textHierarchy ?? null,
        hasCTA: analysis.hasCTA,
        thumbnailStyle: analysis.thumbnailStyle,
        confidenceScore: analysis.confidenceScore,
        visualHierarchy: analysis.visualHierarchy,
        facialEmotion: analysis.facialEmotion,
        secondaryColor: analysis.secondaryColor,
        lightingStyle: analysis.lightingStyle,
        depth: analysis.depth,
        visualDensity: analysis.visualDensity,
        legibilityScore: analysis.legibilityScore,
        visualEnergy: analysis.visualEnergy,
        semanticTheme: analysis.semanticTheme,
        textSafeZone: analysis.textSafeZone,
        detectedObjects: analysis.detectedObjects,
        subjectScale: analysis.subjectScale,
        styleKeywords: analysis.styleKeywords,
        objectsPosition: analysis.objectsPosition,
        rawJson: rawJson as object,
        modelUsed: VISION_MODEL,
      },
    });

    logger.info({ tenantId, style: analysis.style, confidence: analysis.confidenceScore }, 'Reference analysis saved');

    return analysis;
  }

  // ─── Analyze from storage path ────────────────────────────────────────────
  async analyzeStoragePath(
    storagePath: string,
    mimeType: string,
    tenantId: string,
    generationId?: string,
  ): Promise<ReferenceAnalysisFull> {
    const buffer = await storageService.getPrivateObject(storagePath);
    return this.analyzeBuffer(buffer, mimeType, tenantId, generationId);
  }

  // ─── Get analysis by ID ────────────────────────────────────────────────────
  buildGuidedFlow(analysis: ReferenceAnalysisFull): ReferenceGuidedFlow {
    const impact = clampScore(
      42 +
      glowWeight(analysis.glowIntensity) +
      saturationWeight(analysis.saturationLevel) +
      (analysis.visualEnergy === 'high' ? 16 : analysis.visualEnergy === 'medium' ? 8 : 0) +
      (analysis.facialEmotionIntensity === 'high' ? 10 : analysis.facialEmotionIntensity === 'medium' ? 5 : 0),
    );

    const clarity = clampScore(
      (analysis.legibilityScore * 0.55) +
      (analysis.oneSecondReadability === 'excellent' ? 28 : analysis.oneSecondReadability === 'good' ? 18 : 6) -
      (analysis.visualDensity === 'dense' ? 14 : analysis.visualDensity === 'balanced' ? 4 : 0),
    );

    const style = clampScore(
      (analysis.confidenceScore * 60) +
      (analysis.genericPosterArtRisk === 'low' ? 28 : analysis.genericPosterArtRisk === 'medium' ? 16 : 4) +
      (analysis.styleKeywords.length >= 3 ? 10 : 4),
    );

    const oneSecondPasses =
      analysis.oneSecondReadability !== 'weak' &&
      clarity >= 70 &&
      Boolean(analysis.dominantObject) &&
      analysis.genericPosterArtRisk !== 'high';

    return {
      detections: [
        `detectei que o foco principal e ${analysis.dominantObject ?? 'o sujeito principal'}`,
        analysis.facecamDetected
          ? `detectei facecam em ${analysis.facecamPosition ?? 'top-right'}`
          : 'detectei que a thumbnail nao usa facecam destacada',
        `detectei paleta ${analysis.saturationLevel === 'high' ? 'forte' : analysis.saturationLevel === 'medium' ? 'equilibrada' : 'suave'} com base em ${analysis.primaryColor ?? analysis.dominantColors[0] ?? '#0f172a'}`,
        analysis.enemyDetected
          ? `detectei personagem inimigo em ${analysis.enemyPosition ?? 'center'}`
          : `detectei profundidade ${analysis.depth} entre foreground, midground e background`,
        `detectei estilo ${analysis.style} com glow ${analysis.glowIntensity} e densidade ${analysis.visualDensity}`,
      ],
      questions: [
        'deseja manter essa composicao?',
        'quer trocar apenas o rosto?',
        'quer trocar a arma?',
        'quer trocar o mapa?',
        'quer deixar mais realista ou mais chamativa?',
      ],
      preserveOptions: [
        'layout',
        'facecam',
        'objeto principal',
        'mapa',
        'paleta',
      ],
      autoExtraction: {
        compositionType: analysis.compositionType ?? 'central',
        dominantObject: analysis.dominantObject ?? 'subject',
        dominantObjectPosition: analysis.dominantObjectPosition ?? 'center',
        primaryColor: analysis.primaryColor ?? analysis.dominantColors[0] ?? '#0f172a',
        saturationLevel: analysis.saturationLevel ?? 'medium',
        glowLevel: analysis.glowIntensity,
        outlineStyle: analysis.outlineStyle ?? 'clean',
        facialEmotionIntensity: analysis.facialEmotionIntensity ?? 'medium',
        visualDensity: analysis.visualDensity,
        textHierarchy: analysis.hasText ? (analysis.textHierarchy ?? 'title-only') : 'none',
        facecamPosition: analysis.facecamPosition ?? 'none',
        facecamStyle: analysis.facecamStyle ?? 'none',
        depth: analysis.depth,
        foregroundFocus: analysis.foregroundFocus ?? analysis.dominantObject ?? 'subject',
        midgroundFocus: analysis.midgroundFocus ?? analysis.semanticTheme,
        backgroundFocus: analysis.backgroundFocus ?? 'environment',
      },
      visualScoring: {
        impact,
        clarity,
        style,
        legibility: clampScore(analysis.legibilityScore),
        referenceSimilarity: 100,
      },
      oneSecondTest: {
        passes: oneSecondPasses,
        explanation: oneSecondPasses
          ? 'o tema principal continua claro mesmo em tamanho pequeno'
          : 'a leitura ainda perde forca quando a thumbnail fica pequena',
      },
    };
  }

  async getAnalysis(id: string, tenantId: string): Promise<ReferenceAnalysisFull> {
    const record = await prisma.referenceAnalysis.findFirst({
      where: { id, tenantId },
    });

    if (!record) throw new NotFoundError('ReferenceAnalysis', id);

    return coerceAnalysis(record.rawJson as Record<string, unknown>);
  }

  // ─── List analyses for a generation ──────────────────────────────────────
  async listForGeneration(generationId: string, tenantId: string) {
    return prisma.referenceAnalysis.findMany({
      where: { generationId, tenantId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        layout: true,
        style: true,
        visualDensity: true,
        facialEmotion: true,
        confidenceScore: true,
        createdAt: true,
        rawJson: true,
      },
    });
  }

  // ─── Heuristic fallback (no Vision API key) ────────────────────────────────
  private heuristicFallback(): Record<string, unknown> {
    return {
      compositionType: 'split',
      layout: 'split',
      personPosition: 'right',
      objectsPosition: ['foreground-left'],
      backgroundType: 'scene',
      dominantColors: ['#0f172a', '#6366f1', '#f59e0b'],
      primaryColor: '#6366f1',
      glowIntensity: 'subtle',
      saturationLevel: 'medium',
      style: 'gamer',
      dominantObject: 'weapon in foreground',
      dominantObjectPosition: 'foreground-left',
      outlineStyle: 'neon',
      hasText: false,
      textHierarchy: null,
      hasCTA: false,
      thumbnailStyle: 'gamer',
      confidenceScore: 0.4,
      visualHierarchy: 'subject-first',
      facialEmotion: 'confident',
      secondaryColor: null,
      lightingStyle: 'dramatic',
      depth: 'layered',
      visualDensity: 'balanced',
      legibilityScore: 70,
      visualEnergy: 'medium',
      facialEmotionIntensity: 'medium',
      semanticTheme: 'gaming',
      textSafeZone: 'none',
      detectedObjects: [],
      subjectScale: 'medium',
      styleKeywords: ['gaming', 'dramatic', 'ctr-focused'],
      facecamDetected: true,
      facecamPosition: 'top-right',
      facecamStyle: 'neon',
      enemyDetected: true,
      enemyPosition: 'center',
      realismLevel: 'hybrid',
      oneSecondReadability: 'good',
      genericPosterArtRisk: 'medium',
      foregroundFocus: 'weapon',
      midgroundFocus: 'enemy',
      backgroundFocus: 'map',
    };
  }
}
