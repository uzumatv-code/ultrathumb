// =============================================================================
// ThumbForge AI — Prompt Builder Service
// Converts structured input {subject, expression, pose, ...} → final DALL-E prompt.
// NO free text — every decision is typed and controlled.
// =============================================================================

import { VariantType } from '@thumbforge/shared';
import type {
  PromptBuilderInput,
  BuiltPrompt,
  BuiltImagePartPrompt,
  ReferenceAnalysisFull,
  StyleConfig,
} from '@thumbforge/shared';

const PROMPT_VERSION = '2.0';

// ─── Per-variant style directives ────────────────────────────────────────────

const VARIANT_DIRECTIVES: Record<VariantType, { tone: string; energy: string; finish: string }> = {
  [VariantType.CONSERVADORA]: {
    tone:   'faithful to the reference, moderate color palette, clean and professional',
    energy: 'calm confidence, steady presence',
    finish: 'polished, no over-saturation, natural lighting',
  },
  [VariantType.VIRAL]: {
    tone:   'ultra high-energy YouTube viral thumbnail, exaggerated expressions, bold contrast',
    energy: 'maximum visual impact, electrifying, screaming for attention',
    finish: 'oversaturated neon accents, heavy glow, shock-value composition',
  },
  [VariantType.CLEAN]: {
    tone:   'minimalist premium thumbnail, lots of breathing room, elegant typography',
    energy: 'quiet confidence, premium brand energy',
    finish: 'white or dark solid background, subtle gradient, no glow, refined',
  },
  [VariantType.DRAMATICA]: {
    tone:   'cinematic dramatic thumbnail, dark moody atmosphere, film-grade look',
    energy: 'tension and suspense, storytelling visual, epic scale',
    finish: 'cinematic color grading, dark vignette, god rays or rim lighting',
  },
  [VariantType.EXTREMA]: {
    tone:   'maximum chaos energy, particle effects, multiple elements competing, extreme visual density',
    energy: 'explosive action, overwhelming presence, raw power',
    finish: 'fire/lightning/particles overlay, 4x glow intensity, ultra-saturated',
  },
  [VariantType.PREMIUM]: {
    tone:   'luxury brand-quality thumbnail, dark premium aesthetic, highly polished',
    energy: 'authority and prestige, editorial quality',
    finish: 'metallic accents, professional lighting, perfect composition, brand-safe',
  },
};

// ─── Prompt assembly helpers ──────────────────────────────────────────────────

function buildSubjectBlock(input: PromptBuilderInput): string {
  const { subject, expression, pose } = input;
  const parts: string[] = [];

  parts.push(`Primary subject: ${subject.description}`);
  parts.push(`positioned at ${subject.position}, scale ${subject.scale}`);
  parts.push(`facial expression: ${expression.emotion} (intensity: ${expression.intensity})`);
  parts.push(`pose: ${pose.type}${pose.direction ? `, facing ${pose.direction}` : ''}`);

  return parts.join(', ');
}

function buildObjectsBlock(input: PromptBuilderInput): string {
  if (!input.objects.length) return '';
  const lines = input.objects.map(
    (o) => `${o.name} (${o.prominence}${o.position ? `, ${o.position}` : ''})`,
  );
  return `Visible elements: ${lines.join('; ')}`;
}

function buildBackgroundBlock(input: PromptBuilderInput): string {
  const { background } = input;
  return `Background: ${background.type} — ${background.description}, visual complexity ${background.complexity}`;
}

function buildLightingBlock(input: PromptBuilderInput): string {
  const { lighting } = input;
  const parts = [`Lighting: ${lighting.style} style`];
  if (lighting.rimLight) parts.push('with rim light');
  if (lighting.glowColor && lighting.glowIntensity !== 'none') {
    parts.push(`${lighting.glowIntensity} ${lighting.glowColor} glow`);
  }
  return parts.join(', ');
}

function buildPaletteBlock(input: PromptBuilderInput): string {
  const { palette } = input;
  const colors = [palette.primary, palette.secondary, palette.accent].filter(Boolean);
  return `Color palette: ${palette.mood} mood, dominant colors ${colors.join(' / ')}`;
}

function buildCompositionBlock(input: PromptBuilderInput): string {
  const { composition } = input;
  const parts = [`Composition: ${composition.layout}`];
  if (composition.textContent) {
    parts.push(`text overlay "${composition.textContent}" at ${composition.textPosition ?? 'bottom-center'}`);
    if (composition.textHierarchy) parts.push(`hierarchy: ${composition.textHierarchy}`);
  }
  if (composition.hasCTA) parts.push('includes call-to-action element');
  return parts.join(', ');
}

function buildReadabilityBlock(input: PromptBuilderInput): string {
  const { readability } = input;
  return `Readability: ${readability.priority} priority, ${readability.contrast} contrast, ${readability.fontWeight} font weight`;
}

function buildCTRBlock(input: PromptBuilderInput): string {
  const { ctrFocus } = input;
  return `CTR strategy: ${ctrFocus.strategy} (${ctrFocus.intensity} intensity) — optimized for YouTube click-through`;
}

function buildReferenceBlock(analysis: ReferenceAnalysisFull): string {
  return [
    `Reference thumbnail analysis:`,
    `layout=${analysis.layout}, style=${analysis.style}, energy=${analysis.visualEnergy}`,
    `colors=${analysis.dominantColors.join('/')}`,
    analysis.detectedObjects.length ? `detected: ${analysis.detectedObjects.slice(0, 5).join(', ')}` : '',
  ]
    .filter(Boolean)
    .join(' | ');
}

function buildVariantDirective(variantType: VariantType): string {
  const d = VARIANT_DIRECTIVES[variantType];
  return `VARIANT STYLE — ${variantType}: ${d.tone}. Energy: ${d.energy}. Finish: ${d.finish}.`;
}

// ─── Negative prompt ──────────────────────────────────────────────────────────

function buildNegativePrompt(variantType: VariantType): string {
  const base =
    'watermark, logo overlay, text artifacts, blurry faces, distorted hands, extra fingers, low resolution, pixelated, ugly, poorly composed';

  const additions: Partial<Record<VariantType, string>> = {
    [VariantType.CLEAN]:    'clutter, busy background, neon glow, heavy effects',
    [VariantType.PREMIUM]:  'cheap design, neon colors, cartoon style, low budget',
    [VariantType.CONSERVADORA]: 'extreme effects, over-saturation, chaos',
  };

  const extra = additions[variantType];
  return extra ? `${base}, ${extra}` : base;
}

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a professional YouTube thumbnail generator.
Create photorealistic, highly clickable thumbnail images for content creators.
Aspect ratio MUST be 16:9 (1280x720). Do NOT add watermarks or external logos.
Every thumbnail must be visually striking and optimized for maximum click-through rate.`;

// ─── Main service ─────────────────────────────────────────────────────────────

export class PromptBuilderService {
  build(input: PromptBuilderInput): BuiltPrompt {
    const variantType = input.variantType ?? VariantType.VIRAL;

    const blocks: string[] = [
      'Create a professional YouTube thumbnail image.',
      buildSubjectBlock(input),
      buildObjectsBlock(input),
      buildBackgroundBlock(input),
      buildLightingBlock(input),
      buildPaletteBlock(input),
      buildCompositionBlock(input),
      buildReadabilityBlock(input),
      buildCTRBlock(input),
      buildVariantDirective(variantType),
    ];

    if (input.referenceAnalysis) {
      blocks.push(buildReferenceBlock(input.referenceAnalysis));
    }

    if (input.freeTextOverride) {
      blocks.push(`Additional directive: ${input.freeTextOverride}`);
    }

    blocks.push('Output: highly clickable, visually striking, 16:9 YouTube thumbnail, no watermarks.');

    const finalPrompt = blocks.filter(Boolean).join(' ');

    return {
      structuredInput: input,
      finalPrompt,
      systemPrompt:    SYSTEM_PROMPT,
      negativePrompt:  buildNegativePrompt(variantType),
      variantType,
      promptVersion:   PROMPT_VERSION,
    };
  }

  // Build 6 prompts from a single base input, one per variant type
  buildAllVariants(baseInput: PromptBuilderInput): BuiltPrompt[] {
    return Object.values(VariantType).map((vt) =>
      this.build({ ...baseInput, variantType: vt as VariantType }),
    );
  }

  // Build a single prompt from a reference analysis with minimal input
  buildFromAnalysis(
    analysis: ReferenceAnalysisFull,
    overrides: Partial<PromptBuilderInput> = {},
    variantType: VariantType = VariantType.VIRAL,
  ): BuiltPrompt {
    const derived: PromptBuilderInput = {
      subject: {
        description: 'content creator with expressive face',
        scale: analysis.subjectScale ?? 'medium',
        position: (analysis.personPosition as 'left' | 'right' | 'center') ?? 'right',
      },
      expression: {
        emotion: (analysis.facialEmotion as never) ?? 'confident',
        intensity: 'moderate',
      },
      pose: { type: 'three-quarter', direction: 'camera' },
      objects: (analysis.detectedObjects ?? []).slice(0, 3).map((name) => ({
        name,
        prominence: 'accent' as const,
      })),
      background: {
        type: analysis.backgroundType as never,
        description: `${analysis.semanticTheme ?? 'gaming'} themed background`,
        complexity: analysis.visualDensity === 'dense' ? 'complex' : 'moderate',
      },
      lighting: {
        style: (analysis.lightingStyle as never) ?? 'dramatic',
        rimLight: analysis.glowIntensity !== 'none',
        glowColor: analysis.dominantColors[1],
        glowIntensity: analysis.glowIntensity,
      },
      palette: {
        primary: analysis.dominantColors[0] ?? '#0f172a',
        secondary: analysis.dominantColors[1],
        accent: analysis.dominantColors[2],
        mood: analysis.style === 'gamer' ? 'neon' : 'dark',
      },
      composition: {
        layout: analysis.layout,
        textPosition: 'bottom-center',
        hasCTA: analysis.hasCTA,
      },
      style: analysis.style,
      readability: {
        priority: analysis.legibilityScore >= 80 ? 'high' : 'medium',
        contrast: 'high',
        fontWeight: 'bold',
      },
      ctrFocus: {
        strategy: 'shock',
        intensity: analysis.visualEnergy === 'high' ? 'aggressive' : 'moderate',
      },
      variantType,
      referenceAnalysis: analysis,
      ...overrides,
    };

    return this.build(derived);
  }

  buildBackgroundPartPrompt(params: {
    analysis?: ReferenceAnalysisFull | undefined;
    styleConfig?: StyleConfig | undefined;
    description?: string | undefined;
    freeTextInstructions?: string | undefined;
    variantType?: VariantType | undefined;
  }): BuiltImagePartPrompt {
    const variantType = params.variantType ?? VariantType.VIRAL;
    const analysis = params.analysis;
    const compositionPrompt = params.styleConfig?.composition?.generatedBackgroundPrompt;
    const parts = [
      'Generate only the background plate for a YouTube thumbnail composition.',
      'No people, no foreground objects, no box art, no UI, no text, no logos.',
      'Leave clear subject space for later compositing on the right half of the frame.',
      analysis
        ? `Reference style: ${analysis.style}, ${analysis.thumbnailStyle}, ${analysis.backgroundType} background, colors ${analysis.dominantColors.join(', ')}.`
        : '',
      params.description ? `Scene description: ${params.description}.` : '',
      compositionPrompt ? `Background brief: ${compositionPrompt}.` : '',
      params.freeTextInstructions ? `Additional direction: ${params.freeTextInstructions}.` : '',
      buildVariantDirective(variantType),
      'Output: cinematic, clean, slightly blurred background plate ready for compositing.',
    ].filter(Boolean);

    return {
      partType: 'background',
      finalPrompt: parts.join(' '),
      negativePrompt: 'people, face, hands, readable UI, text, title, watermark, logo, item box, weapon in foreground',
      promptVersion: PROMPT_VERSION,
      variantType,
    };
  }

  buildEffectsPartPrompt(params: {
    analysis?: ReferenceAnalysisFull | undefined;
    styleConfig?: StyleConfig | undefined;
    freeTextInstructions?: string | undefined;
    variantType?: VariantType | undefined;
  }): BuiltImagePartPrompt {
    const variantType = params.variantType ?? VariantType.VIRAL;
    const analysis = params.analysis;
    const effectsPrompt = params.styleConfig?.composition?.generatedEffectsPrompt;
    const parts = [
      'Generate an abstract effects plate for a YouTube thumbnail composition.',
      'No people, no faces, no UI, no readable text, no logos.',
      'Focus on glow streaks, particles, sparks, haze, and energy accents over transparency-like dark background.',
      analysis ? `Match the palette ${analysis.dominantColors.join(', ')} and the ${analysis.style} aesthetic.` : '',
      effectsPrompt ? `Effects brief: ${effectsPrompt}.` : '',
      params.freeTextInstructions ? `Additional direction: ${params.freeTextInstructions}.` : '',
      buildVariantDirective(variantType),
      'Output: effects overlay plate with isolated glow elements and dark negative space.',
    ].filter(Boolean);

    return {
      partType: 'effects',
      finalPrompt: parts.join(' '),
      negativePrompt: 'people, full scene, readable text, user interface, logo, flat background, centered subject',
      promptVersion: PROMPT_VERSION,
      variantType,
    };
  }
}
