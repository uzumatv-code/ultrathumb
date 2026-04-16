// =============================================================================
// ThumbForge AI — AI Provider Interface (Abstraction)
// =============================================================================

import type { ReferenceAnalysis, StructuredPrompt, AIGenerationResult, VariantType, BuiltPrompt } from '@thumbforge/shared';

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
   * Estimate the cost of a generation request in cents.
   */
  estimateCostCents(request: GenerationRequest): number;

  /**
   * Health check.
   */
  healthCheck(): Promise<boolean>;
}
