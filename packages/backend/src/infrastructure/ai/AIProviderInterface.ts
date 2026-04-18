// =============================================================================
// ThumbForge AI — AI Provider Interface (Abstraction)
// =============================================================================

import type {
  ReferenceAnalysis,
  StructuredPrompt,
  AIGenerationResult,
  VariantType,
  BuiltPrompt,
  BuiltImagePartPrompt,
} from '@thumbforge/shared';

export interface GenerationRequest {
  generationId: string;
  referenceImageBuffer?: Buffer | undefined;
  personImageBuffer?: Buffer | undefined;
  assetBuffers?: Buffer[] | undefined;
  structuredPrompt: StructuredPrompt;
  freeTextPrompt?: string | undefined;
  variantsCount: number;
  // Extended: typed variants with pre-built prompts
  variantTypes?: VariantType[] | undefined;
  builtPrompts?: BuiltPrompt[] | undefined;
}

export interface ImagePartGenerationRequest {
  generationId: string;
  partType: 'background' | 'effects';
  prompt: string;
  width?: number | undefined;
  height?: number | undefined;
  variantIndex?: number | undefined;
  variantType?: VariantType | undefined;
  referenceImageBuffer?: Buffer | undefined;
  builtPrompt?: BuiltImagePartPrompt | undefined;
}

export interface ImagePartGenerationResult {
  imageBuffer: Buffer;
  revisedPrompt?: string | undefined;
  estimatedCostCents: number;
  modelUsed: string;
}

export interface AIImageProviderInterface {
  readonly name: string;
  readonly type: string;

  /**
   * Analyze a reference thumbnail and extract visual characteristics.
   */
  analyzeReference(imageBuffer: Buffer): Promise<ReferenceAnalysis>;

  /**
   * Generate N image variants based on the structured prompt.
   */
  generateVariants(request: GenerationRequest): Promise<AIGenerationResult>;

  /**
   * Generate a single isolated image part, such as a background plate or effects overlay.
   */
  generateImagePart(request: ImagePartGenerationRequest): Promise<ImagePartGenerationResult>;

  /**
   * Estimate the cost of a generation request in cents.
   */
  estimateCostCents(request: GenerationRequest): number;

  /**
   * Health check.
   */
  healthCheck(): Promise<boolean>;
}
