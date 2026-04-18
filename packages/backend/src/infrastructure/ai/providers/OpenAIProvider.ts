// =============================================================================
// ThumbForge AI — OpenAI Provider
// =============================================================================

import OpenAI from 'openai';
import type {
  AIImageProviderInterface,
  GenerationRequest,
  ImagePartGenerationRequest,
  ImagePartGenerationResult,
} from '../AIProviderInterface.js';
import type { ReferenceAnalysis, AIGenerationResult } from '@thumbforge/shared';
import { logger } from '../../../shared/utils/logger.js';
import { AIProviderError } from '../../../shared/errors/AppError.js';

const VISION_MODEL = 'gpt-4o';
const GENERATION_MODEL = 'dall-e-3'; // Primary; switch to gpt-image-1 when available

// Cost estimates (USD → BRL at ~5.5x, converted to cents)
const COST_PER_IMAGE_USD = 0.04; // DALL-E 3 standard quality
const BRL_MULTIPLIER = 5.5;

function tocentsCents(usd: number): number {
  return Math.ceil(usd * BRL_MULTIPLIER * 100);
}

export class OpenAIProvider implements AIImageProviderInterface {
  readonly name = 'OpenAI';
  readonly type = 'OPENAI';

  private client: OpenAI;

  constructor(apiKey?: string) {
    this.client = new OpenAI({
      apiKey: apiKey ?? process.env['OPENAI_API_KEY'],
      organization: process.env['OPENAI_ORG_ID'] || undefined,
      timeout: parseInt(process.env['AI_GENERATION_TIMEOUT_MS'] ?? '120000'),
      maxRetries: parseInt(process.env['AI_MAX_RETRIES'] ?? '3'),
    });
  }

  async analyzeReference(imageBuffer: Buffer): Promise<ReferenceAnalysis> {
    const base64Image = imageBuffer.toString('base64');

    const response = await this.client.chat.completions.create({
      model: VISION_MODEL,
      messages: [
        {
          role: 'system',
          content: `You are an expert thumbnail analyst for YouTube content creators.
Analyze the given thumbnail image and return a JSON object with the exact structure specified.
Be precise and actionable in your analysis.`,
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Analyze this YouTube thumbnail and return ONLY a JSON object with this exact structure:
{
  "layout": "centered" | "left-dominant" | "right-dominant" | "split",
  "personPosition": "left" | "right" | "center" | "none",
  "objectsPosition": ["description of object positions"],
  "backgroundType": "solid" | "gradient" | "scene" | "blurred",
  "dominantColors": ["#hex1", "#hex2", "#hex3"],
  "glowIntensity": "none" | "subtle" | "medium" | "intense",
  "style": "gamer" | "cinematic" | "clean" | "high-energy" | "dramatic" | "minimal",
  "hasText": boolean,
  "textHierarchy": "title-only" | "title-subtitle" | "multiple" | null,
  "hasCTA": boolean,
  "thumbnailStyle": "gamer" | "clickbait" | "cinematic" | "educational" | "reaction",
  "confidenceScore": 0.0-1.0
}`,
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/webp;base64,${base64Image}`,
                detail: 'high',
              },
            },
          ],
        },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 500,
    });

    const content = response.choices[0]?.message.content;
    if (!content) throw new AIProviderError('Empty response from vision model');

    try {
      return JSON.parse(content) as ReferenceAnalysis;
    } catch {
      throw new AIProviderError('Failed to parse reference analysis', { content });
    }
  }

  async generateVariants(request: GenerationRequest): Promise<AIGenerationResult> {
    const startTime = Date.now();

    // Total variant count: use builtPrompts length or variantsCount
    const count = request.builtPrompts?.length ?? request.variantsCount;

    // Build the fallback prompt (used when no builtPrompts)
    const prompt = this.buildGenerationPrompt(request);
    logger.info({ generationId: request.generationId, promptLength: prompt.length, variantCount: count }, 'Generating variants');

    // Generate variants in parallel
    const variantPromises = Array.from({ length: count }, (_, i) =>
      this.generateSingleVariant(prompt, i + 1, request),
    );

    const results = await Promise.allSettled(variantPromises);

    const variants: AIGenerationResult['variants'] = [];
    let totalCost = 0;

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result?.status === 'fulfilled') {
        variants.push(result.value);
        totalCost += tocentsCents(COST_PER_IMAGE_USD);
      } else {
        logger.error(
          { generationId: request.generationId, variant: i + 1, error: result?.reason },
          'Variant generation failed',
        );
        throw new AIProviderError(`Failed to generate variant ${i + 1}`, {
          reason: (result?.reason as Error)?.message,
        });
      }
    }

    return {
      variants,
      modelUsed: GENERATION_MODEL,
      promptTokens: 0,   // DALL-E doesn't return token counts
      completionTokens: 0,
      estimatedCostCents: totalCost,
      durationMs: Date.now() - startTime,
    };
  }

  async generateImagePart(request: ImagePartGenerationRequest): Promise<ImagePartGenerationResult> {
    const response = await this.client.images.generate({
      model: GENERATION_MODEL,
      prompt: request.builtPrompt?.finalPrompt ?? request.prompt,
      n: 1,
      size: this.resolveSize(request.width, request.height),
      quality: 'hd',
      response_format: 'b64_json',
      style: 'vivid',
    });

    const imageData = response.data?.[0];
    if (!imageData?.b64_json) {
      throw new AIProviderError(`No image data returned for ${request.partType}`);
    }

    return {
      imageBuffer: Buffer.from(imageData.b64_json, 'base64'),
      ...(imageData.revised_prompt ? { revisedPrompt: imageData.revised_prompt } : {}),
      estimatedCostCents: tocentsCents(COST_PER_IMAGE_USD),
      modelUsed: GENERATION_MODEL,
    };
  }

  estimateCostCents(request: GenerationRequest): number {
    // Vision model call + N image generations
    const visionCost = tocentsCents(0.005); // ~$0.005 for vision analysis
    const generationCost = tocentsCents(COST_PER_IMAGE_USD * request.variantsCount);
    return visionCost + generationCost;
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.client.models.list();
      return true;
    } catch {
      return false;
    }
  }

  // ─── Private Helpers ──────────────────────────────────────────────────────

  private async generateSingleVariant(
    prompt: string,
    variantIndex: number,
    request: GenerationRequest,
  ): Promise<AIGenerationResult['variants'][0]> {
    // Use pre-built prompt if available (from PromptBuilderService)
    const builtPrompt = request.builtPrompts?.[variantIndex - 1];
    const variantSuffixes = [
      'Make this version bold and impactful.',
      'Make this version clean and polished.',
      'Make this version dramatic and cinematic.',
    ];

    const variantPrompt = builtPrompt
      ? builtPrompt.finalPrompt
      : `${prompt}\n\n${variantSuffixes[variantIndex - 1] ?? ''}`;

    const response = await this.client.images.generate({
      model: GENERATION_MODEL,
      prompt: variantPrompt,
      n: 1,
      size: '1792x1024',  // 16:9 closest to 1280x720
      quality: 'hd',
      response_format: 'b64_json',
      style: 'vivid',
    });

    const imageData = response.data?.[0];
    if (!imageData?.b64_json) {
      throw new AIProviderError(`No image data returned for variant ${variantIndex}`);
    }

    return {
      index: variantIndex,
      imageBuffer: Buffer.from(imageData.b64_json, 'base64'),
      ...(imageData.revised_prompt ? { revisedPrompt: imageData.revised_prompt } : {}),
      ...(builtPrompt ? { variantType: builtPrompt.variantType } : {}),
    };
  }

  private buildGenerationPrompt(request: GenerationRequest): string {
    const { structuredPrompt, freeTextPrompt } = request;
    const analysis = structuredPrompt.referenceAnalysis;

    const parts: string[] = [
      `Create a professional YouTube thumbnail image for a content creator.`,
    ];

    if (analysis) {
      parts.push(
        `Style reference: ${analysis.thumbnailStyle} style thumbnail with ${analysis.style} aesthetic.`,
        `Layout: ${analysis.layout} composition.`,
        `Background: ${analysis.backgroundType} background type.`,
        `Color scheme: Based on colors ${analysis.dominantColors.join(', ')}.`,
        `Glow effects: ${analysis.glowIntensity} glow intensity.`,
      );

      if (analysis.personPosition !== 'none') {
        parts.push(`Person positioned at: ${analysis.personPosition}.`);
      }
    }

    if (structuredPrompt.personDescription) {
      parts.push(`Person: ${structuredPrompt.personDescription}`);
    }

    if (structuredPrompt.assetsDescription?.length) {
      parts.push(`Include elements: ${structuredPrompt.assetsDescription.join(', ')}.`);
    }

    if (structuredPrompt.styleConfig.text) {
      parts.push(
        `Text overlay: "${structuredPrompt.styleConfig.text}" in ${structuredPrompt.styleConfig.fontFamily ?? 'bold'} font.`,
        `Text color: ${structuredPrompt.styleConfig.fontColor ?? 'white'} with ${structuredPrompt.styleConfig.fontOutlineColor ?? 'black'} outline.`,
      );
    }

    if (freeTextPrompt) {
      parts.push(`Additional instructions: ${freeTextPrompt}`);
    }

    parts.push(
      `The thumbnail must be highly clickable, visually striking, and professional.`,
      `Aspect ratio: 16:9 (YouTube standard).`,
      `Do not include any watermarks, logos, or text overlays unless specified.`,
    );

    return parts.join(' ');
  }

  private resolveSize(width = 1280, height = 720): '1024x1024' | '1792x1024' | '1024x1792' {
    if (height > width) return '1024x1792';
    if (width > height) return '1792x1024';
    return '1024x1024';
  }
}
