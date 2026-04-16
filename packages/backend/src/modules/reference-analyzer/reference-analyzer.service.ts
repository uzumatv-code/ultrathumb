// =============================================================================
// ThumbForge AI — Reference Analyzer Service
// Calls Vision API, extracts full DNA JSON, persists to reference_analyses.
// =============================================================================

import OpenAI from 'openai';
import { prisma } from '../../infrastructure/database/client.js';
import { storageService } from '../../infrastructure/storage/StorageService.js';
import { logger } from '../../shared/utils/logger.js';
import { AIProviderError, NotFoundError } from '../../shared/errors/AppError.js';
import type { ReferenceAnalysisFull } from '@thumbforge/shared';

const VISION_MODEL = process.env['OPENAI_VISION_MODEL'] ?? 'gpt-4o';

const ANALYSIS_SYSTEM_PROMPT = `You are an expert YouTube thumbnail analyst for content creators.
Analyze the thumbnail image and return a structured JSON describing every visual element.
Be precise, specific, and actionable. Return ONLY valid JSON — no markdown, no extra text.`;

const ANALYSIS_USER_PROMPT = `Analyze this YouTube thumbnail and return ONLY a JSON object with this exact structure:
{
  "layout": "centered" | "left-dominant" | "right-dominant" | "split",
  "personPosition": "left" | "right" | "center" | "none",
  "objectsPosition": ["string describing position of each object"],
  "backgroundType": "solid" | "gradient" | "scene" | "blurred",
  "dominantColors": ["#hex1", "#hex2", "#hex3"],
  "glowIntensity": "none" | "subtle" | "medium" | "intense",
  "style": "gamer" | "cinematic" | "clean" | "high-energy" | "dramatic" | "minimal",
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
  "semanticTheme": "short description of the content theme",
  "textSafeZone": "left" | "right" | "top" | "bottom" | "center" | "none",
  "detectedObjects": ["list of visible objects, weapons, logos, badges"],
  "subjectScale": "small" | "medium" | "large",
  "styleKeywords": ["3-5 keywords describing the visual style"]
}`;

function getOpenAIClient(): OpenAI {
  return new OpenAI({
    apiKey: process.env['OPENAI_API_KEY'],
    timeout: parseInt(process.env['AI_GENERATION_TIMEOUT_MS'] ?? '60000'),
    maxRetries: 2,
  });
}

function coerceAnalysis(raw: Record<string, unknown>): ReferenceAnalysisFull {
  const safeStr = (v: unknown, fallback: string): string =>
    typeof v === 'string' ? v : fallback;
  const safeBool = (v: unknown): boolean => v === true || v === 'true';
  const safeNum = (v: unknown, fallback: number): number =>
    typeof v === 'number' && isFinite(v) ? v : fallback;
  const safeArr = (v: unknown): string[] =>
    Array.isArray(v) ? v.map(String) : [];

  return {
    layout: safeStr(raw['layout'], 'split') as ReferenceAnalysisFull['layout'],
    personPosition: safeStr(raw['personPosition'], 'center') as ReferenceAnalysisFull['personPosition'],
    objectsPosition: safeArr(raw['objectsPosition']),
    backgroundType: safeStr(raw['backgroundType'], 'scene') as ReferenceAnalysisFull['backgroundType'],
    dominantColors: safeArr(raw['dominantColors']).length
      ? safeArr(raw['dominantColors'])
      : ['#0f172a', '#6366f1', '#f59e0b'],
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
    legibilityScore: safeNum(raw['legibilityScore'], 75),
    visualEnergy: safeStr(raw['visualEnergy'], 'medium') as ReferenceAnalysisFull['visualEnergy'],
    semanticTheme: safeStr(raw['semanticTheme'], 'gaming'),
    textSafeZone: safeStr(raw['textSafeZone'], 'none') as ReferenceAnalysisFull['textSafeZone'],
    detectedObjects: safeArr(raw['detectedObjects']),
    subjectScale: safeStr(raw['subjectScale'], 'medium') as ReferenceAnalysisFull['subjectScale'],
    styleKeywords: safeArr(raw['styleKeywords']),
  };
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
      layout: 'split',
      personPosition: 'right',
      objectsPosition: ['foreground-left'],
      backgroundType: 'scene',
      dominantColors: ['#0f172a', '#6366f1', '#f59e0b'],
      glowIntensity: 'subtle',
      style: 'gamer',
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
      semanticTheme: 'gaming',
      textSafeZone: 'none',
      detectedObjects: [],
      subjectScale: 'medium',
      styleKeywords: ['gaming', 'dramatic', 'ctr-focused'],
    };
  }
}
