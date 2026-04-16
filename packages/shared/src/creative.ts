import type { ReferenceAnalysis, StyleConfig, VisualStyle } from './types.js';

export type VisualDensityLevel = 'clean' | 'balanced' | 'dense';
export type LightingStyle = 'flat' | 'studio' | 'dramatic' | 'ambient' | 'neon';
export type SubjectScale = 'small' | 'medium' | 'large';
export type SemanticEditPreserve =
  | 'layout'
  | 'subject'
  | 'background'
  | 'lighting'
  | 'palette'
  | 'objects'
  | 'text'
  | 'style';

export interface CreativeReferenceAnalysis extends ReferenceAnalysis {
  visualHierarchy?: 'subject-first' | 'object-first' | 'text-first' | 'balanced' | undefined;
  facialEmotion?: 'neutral' | 'confident' | 'excited' | 'shocked' | 'aggressive' | 'focused' | undefined;
  secondaryColor?: string | null | undefined;
  lightingStyle?: LightingStyle | undefined;
  depth?: 'flat' | 'layered' | 'deep' | undefined;
  visualDensity?: VisualDensityLevel | undefined;
  legibilityScore?: number | undefined;
  visualEnergy?: 'low' | 'medium' | 'high' | undefined;
  semanticTheme?: string | undefined;
  textSafeZone?: 'left' | 'right' | 'top' | 'bottom' | 'center' | 'none' | undefined;
  detectedObjects?: string[] | undefined;
  subjectScale?: SubjectScale | undefined;
  styleKeywords?: string[] | undefined;
}

export interface ThumbnailScoreCard {
  readability: number;
  subjectDominance: number;
  objectFocus: number;
  contrast: number;
  visualBalance: number;
  visualDensity: VisualDensityLevel;
}

export interface CreativeSuggestion {
  id: string;
  category:
    | 'composition'
    | 'subject'
    | 'contrast'
    | 'objects'
    | 'palette'
    | 'text'
    | 'style';
  severity: 'info' | 'warning' | 'opportunity';
  title: string;
  description: string;
  suggestedPrompt?: string;
}

export interface SemanticEditChangeSet {
  subject?: 'keep' | 'replace' | 'enhance' | undefined;
  facialExpression?:
    | 'keep'
    | 'more_shocked'
    | 'more_confident'
    | 'more_aggressive'
    | 'more_excited'
    | 'more_focused'
    | undefined;
  paletteShift?: string | undefined;
  visualDensity?: 'keep' | 'reduce' | 'increase' | undefined;
  background?: 'keep' | 'replace' | 'simplify' | 'blur' | undefined;
  subjectScale?: 'keep' | 'smaller' | 'larger' | undefined;
  glowIntensity?: 'keep' | 'lower' | 'higher' | undefined;
  objectFocus?: 'keep' | 'increase' | 'decrease' | undefined;
  textTreatment?: 'keep' | 'add' | 'remove' | 'refine' | undefined;
  styleDirective?:
    | 'keep'
    | 'more_clean'
    | 'more_viral'
    | 'more_premium'
    | 'more_gaming'
    | 'more_dramatic'
    | undefined;
  compositionLock?: 'preserve' | 'rebalance' | undefined;
}

export interface SemanticEditRequest {
  baseVariantId?: string | undefined;
  prompt: string;
  preserve: SemanticEditPreserve[];
  change: SemanticEditChangeSet;
}

export interface SemanticEditDraft {
  generationId: string;
  baseVariantId?: string | null;
  sourcePrompt: string;
  normalizedRequest: SemanticEditRequest;
  promptDelta: string[];
  previewSummary: string;
}

export interface GenerationCreativeSummary {
  generationId: string;
  baseVariantId?: string | null;
  styleConfig: StyleConfig;
  visualStyle: VisualStyle;
  referenceAnalysis: CreativeReferenceAnalysis;
  scorecard: ThumbnailScoreCard;
  suggestions: CreativeSuggestion[];
  recommendedPreserveOptions: SemanticEditPreserve[];
  quickEditPrompts: string[];
}
