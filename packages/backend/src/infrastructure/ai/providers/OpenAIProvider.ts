// =============================================================================
// ThumbForge AI — OpenAI Provider
// =============================================================================

import OpenAI, { toFile } from 'openai';
import type { Uploadable } from 'openai/uploads.js';
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
const GENERATION_MODEL = 'gpt-image-1';

// gpt-image-1 medium quality pricing (USD → BRL at ~5.5x, in cents)
// medium 1536x1024 ≈ $0.042 per image
const COST_PER_IMAGE_USD = 0.042;
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

    const count = request.builtPrompts?.length ?? request.variantsCount;

    // Convert image buffers to uploadable files so gpt-image-1 can see them
    const imageFiles = await this.buildImageFiles(request);

    const prompt = this.buildGenerationPrompt(request);
    logger.info(
      {
        generationId: request.generationId,
        promptLength: prompt.length,
        variantCount: count,
        imageCount: imageFiles.length,
        model: GENERATION_MODEL,
      },
      'Generating variants',
    );

    // Generate variants in parallel
    const variantPromises = Array.from({ length: count }, (_, i) =>
      this.generateSingleVariant(prompt, i + 1, request, imageFiles),
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
      promptTokens: 0,
      completionTokens: 0,
      estimatedCostCents: totalCost,
      durationMs: Date.now() - startTime,
    };
  }

  async generateImagePart(request: ImagePartGenerationRequest): Promise<ImagePartGenerationResult> {
    const prompt = request.builtPrompt?.finalPrompt ?? request.prompt;
    const size = this.resolveSize(request.width, request.height);

    let b64: string;
    let revisedPrompt: string | undefined;

    if (request.referenceImageBuffer) {
      const imageFile = await toFile(request.referenceImageBuffer, 'reference.png', { type: 'image/png' });
      // gpt-image-1 images.edit: 'quality' and 'response_format' are not accepted;
      // the model always returns base64 in data[0].b64_json automatically.
      const response = await this.client.images.edit({
        model: GENERATION_MODEL,
        image: imageFile,
        prompt,
        n: 1,
        size,
      });
      const imageData = response.data?.[0];
      if (!imageData?.b64_json) throw new AIProviderError(`No image data returned for ${request.partType}`);
      b64 = imageData.b64_json;
      revisedPrompt = imageData.revised_prompt ?? undefined;
    } else {
      const response = await this.client.images.generate({
        model: GENERATION_MODEL,
        prompt,
        n: 1,
        size,
        quality: 'medium',
        response_format: 'b64_json',
      });
      const imageData = response.data?.[0];
      if (!imageData?.b64_json) throw new AIProviderError(`No image data returned for ${request.partType}`);
      b64 = imageData.b64_json;
      revisedPrompt = imageData.revised_prompt ?? undefined;
    }

    return {
      imageBuffer: Buffer.from(b64, 'base64'),
      ...(revisedPrompt ? { revisedPrompt } : {}),
      estimatedCostCents: tocentsCents(COST_PER_IMAGE_USD),
      modelUsed: GENERATION_MODEL,
    };
  }

  estimateCostCents(request: GenerationRequest): number {
    const visionCost = tocentsCents(0.005);
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

  /**
   * Convert all uploaded image buffers into Uploadable files for gpt-image-1.
   * File names encode the role so the model understands what each image represents.
   */
  private async buildImageFiles(request: GenerationRequest): Promise<Uploadable[]> {
    const files: Uploadable[] = [];

    if (request.referenceImageBuffer) {
      files.push(
        await toFile(request.referenceImageBuffer, 'image_1_background_scene.png', { type: 'image/png' }),
      );
    }
    if (request.personImageBuffer) {
      files.push(
        await toFile(request.personImageBuffer, 'image_2_person_streamer.png', { type: 'image/png' }),
      );
    }
    if (request.assetBuffers) {
      for (let i = 0; i < request.assetBuffers.length; i++) {
        const buf = request.assetBuffers[i];
        if (buf) {
          files.push(
            await toFile(buf, `image_${files.length + 1}_game_asset.png`, { type: 'image/png' }),
          );
        }
      }
    }

    return files;
  }

  private async generateSingleVariant(
    prompt: string,
    variantIndex: number,
    request: GenerationRequest,
    imageFiles: Uploadable[],
  ): Promise<AIGenerationResult['variants'][0]> {
    const builtPrompt = request.builtPrompts?.[variantIndex - 1];
    const variantSuffixes = [
      '\n\nVariant direction: bold and impactful — high contrast, maximum visual energy.',
      '\n\nVariant direction: clean and polished — breathing room, premium feel.',
      '\n\nVariant direction: dramatic and cinematic — moody lighting, film-grade quality.',
    ];

    const variantPrompt = builtPrompt
      ? builtPrompt.finalPrompt
      : `${prompt}${variantSuffixes[variantIndex - 1] ?? ''}`;

    let b64: string;
    let revisedPrompt: string | undefined;

    if (imageFiles.length > 0) {
      // Pass all reference images directly — gpt-image-1 sees them and follows the user's instruction.
      // gpt-image-1 images.edit: 'quality' and 'response_format' are not accepted;
      // the model always returns base64 in data[0].b64_json automatically.
      const response = await this.client.images.edit({
        model: GENERATION_MODEL,
        image: imageFiles as Uploadable & Uploadable[],
        prompt: variantPrompt,
        n: 1,
        size: '1536x1024',
      });
      const imageData = response.data?.[0];
      if (!imageData?.b64_json) throw new AIProviderError(`No image data for variant ${variantIndex}`);
      b64 = imageData.b64_json;
      revisedPrompt = imageData.revised_prompt ?? undefined;
    } else {
      // No reference images — pure text-to-image generation
      const response = await this.client.images.generate({
        model: GENERATION_MODEL,
        prompt: variantPrompt,
        n: 1,
        size: '1536x1024',
        quality: 'medium',
        response_format: 'b64_json',
      });
      const imageData = response.data?.[0];
      if (!imageData?.b64_json) throw new AIProviderError(`No image data for variant ${variantIndex}`);
      b64 = imageData.b64_json;
      revisedPrompt = imageData.revised_prompt ?? undefined;
    }

    return {
      index: variantIndex,
      imageBuffer: Buffer.from(b64, 'base64'),
      ...(revisedPrompt ? { revisedPrompt } : {}),
      ...(builtPrompt ? { variantType: builtPrompt.variantType } : {}),
    };
  }

  /**
   * Build the generation prompt.
   *
   * When the user provides a free-text instruction (the most common case with
   * reference images), that instruction becomes the PRIMARY directive and the
   * images are labelled so the model knows what each one represents.
   * Style analysis is included as secondary context only.
   *
   * Without free text, the original analysis-driven prompt is used.
   */
  private buildGenerationPrompt(request: GenerationRequest): string {
    const { freeTextPrompt, referenceImageBuffer, personImageBuffer, assetBuffers, structuredPrompt } = request;
    const analysis = structuredPrompt.referenceAnalysis;
    const hasImages = !!(referenceImageBuffer || personImageBuffer || assetBuffers?.length);

    if (freeTextPrompt) {
      const parts: string[] = [];

      // Tell the model what each uploaded image represents
      if (hasImages) {
        let idx = 1;
        const labels: string[] = [];
        if (referenceImageBuffer) labels.push(`image ${idx++} = background/reference scene`);
        if (personImageBuffer) labels.push(`image ${idx++} = the person/streamer to feature`);
        if (assetBuffers?.length) {
          assetBuffers.forEach(() => labels.push(`image ${idx++} = game asset or weapon`));
        }
        parts.push(`Images provided: ${labels.join('; ')}.`);
      }

      // User instruction is the primary directive — placed first, not at the end
      parts.push(freeTextPrompt);

      // Style analysis as supporting context only
      if (analysis) {
        parts.push(
          `Visual style context: ${analysis.thumbnailStyle} thumbnail, ` +
          `${analysis.style} aesthetic, ${analysis.glowIntensity} glow, ` +
          `dominant colors ${analysis.dominantColors.slice(0, 3).join('/')}.`,
        );
      }

      parts.push(
        'Output: professional YouTube thumbnail, 16:9 aspect ratio (1536×1024 px), highly clickable, no watermarks or logos.',
      );

      return parts.join('\n\n');
    }

    // No free text: build entirely from analysis
    const parts: string[] = ['Create a professional YouTube thumbnail for a gaming content creator.'];

    if (analysis) {
      parts.push(
        `Style: ${analysis.thumbnailStyle} thumbnail, ${analysis.style} aesthetic.`,
        `Layout: ${analysis.layout} composition.`,
        `Background: ${analysis.backgroundType}.`,
        `Colors: ${analysis.dominantColors.join(', ')}.`,
        `Glow: ${analysis.glowIntensity} intensity.`,
      );
      if (analysis.personPosition !== 'none') {
        parts.push(`Person at: ${analysis.personPosition}.`);
      }
    }

    if (structuredPrompt.personDescription) {
      parts.push(`Person: ${structuredPrompt.personDescription}`);
    }
    if (structuredPrompt.assetsDescription?.length) {
      parts.push(`Elements: ${structuredPrompt.assetsDescription.join(', ')}.`);
    }
    if (structuredPrompt.styleConfig.text) {
      parts.push(`Text overlay: "${structuredPrompt.styleConfig.text}".`);
    }

    parts.push('16:9 aspect ratio, highly clickable, no watermarks.');
    return parts.join(' ');
  }

  private resolveSize(width = 1536, height = 1024): '1024x1024' | '1536x1024' | '1024x1536' {
    if (height > width) return '1024x1536';
    if (width > height) return '1536x1024';
    return '1024x1024';
  }
}
