import { prisma } from '../../infrastructure/database/client.js';
import { NotFoundError } from '../../shared/errors/AppError.js';
import type {
  CreativeReferenceAnalysis,
  CreativeSuggestion,
  GenerationCreativeSummary,
  SemanticEditDraft,
  SemanticEditRequest,
  SemanticEditPreserve,
  StyleConfig,
  ThumbnailScoreCard,
  VisualStyle,
} from '@thumbforge/shared';

type GenerationRecord = Awaited<ReturnType<GenerationCreativeService['loadGeneration']>>;

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function inferVisualDensity(
  variantCount: number,
  hasText: boolean,
  visualImpactScore: number,
): ThumbnailScoreCard['visualDensity'] {
  if (variantCount >= 3 && hasText && visualImpactScore >= 75) {
    return 'dense';
  }
  if (variantCount >= 2 || hasText) {
    return 'balanced';
  }
  return 'clean';
}

function inferStyle(styleConfig: StyleConfig): VisualStyle {
  return styleConfig.visualStyle ?? 'dramatic';
}

function inferTextSafeZone(styleConfig: StyleConfig): CreativeReferenceAnalysis['textSafeZone'] {
  switch (styleConfig.textPosition) {
    case 'top-left':
    case 'middle-left':
    case 'bottom-left':
      return 'left';
    case 'top-right':
    case 'middle-right':
    case 'bottom-right':
      return 'right';
    case 'top-center':
      return 'top';
    case 'bottom-center':
      return 'bottom';
    case 'middle-center':
      return 'center';
    default:
      return 'none';
  }
}

function inferLayout(styleConfig: StyleConfig): CreativeReferenceAnalysis['layout'] {
  switch (styleConfig.textPosition) {
    case 'top-left':
    case 'middle-left':
    case 'bottom-left':
      return 'right-dominant';
    case 'top-right':
    case 'middle-right':
    case 'bottom-right':
      return 'left-dominant';
    case 'middle-center':
      return 'centered';
    default:
      return 'split';
  }
}

function inferPersonPosition(styleConfig: StyleConfig): CreativeReferenceAnalysis['personPosition'] {
  switch (styleConfig.textPosition) {
    case 'top-left':
    case 'middle-left':
    case 'bottom-left':
      return 'right';
    case 'top-right':
    case 'middle-right':
    case 'bottom-right':
      return 'left';
    case 'middle-center':
      return 'center';
    default:
      return 'center';
  }
}

function mapGlowIntensity(glowIntensity?: number): CreativeReferenceAnalysis['glowIntensity'] {
  if (!glowIntensity || glowIntensity <= 5) return 'none';
  if (glowIntensity <= 30) return 'subtle';
  if (glowIntensity <= 65) return 'medium';
  return 'intense';
}

function mapLightingStyle(styleConfig: StyleConfig): CreativeReferenceAnalysis['lightingStyle'] {
  const style = inferStyle(styleConfig);
  if (style === 'cinematic' || style === 'dramatic') return 'dramatic';
  if (style === 'gamer') return 'neon';
  if (style === 'clean' || style === 'minimal') return 'studio';
  return 'ambient';
}

function mapFacialEmotion(impact: number): CreativeReferenceAnalysis['facialEmotion'] {
  if (impact >= 85) return 'shocked';
  if (impact >= 75) return 'excited';
  if (impact >= 65) return 'focused';
  return 'confident';
}

function buildScorecard(generation: GenerationRecord): ThumbnailScoreCard {
  const leadVariant = generation.variants[0];
  const adherence = leadVariant?.templateAdherenceScore ?? 76;
  const readability = leadVariant?.textReadabilityScore ?? 74;
  const impact = leadVariant?.visualImpactScore ?? 72;
  const hasText = Boolean((generation.styleConfig as StyleConfig).text);

  return {
    readability: clampScore(readability),
    subjectDominance: clampScore((impact * 0.6) + (adherence * 0.4)),
    objectFocus: clampScore((impact * 0.7) + (adherence * 0.3)),
    contrast: clampScore((impact * 0.65) + (readability * 0.35)),
    visualBalance: clampScore((adherence * 0.55) + (readability * 0.45)),
    visualDensity: inferVisualDensity(generation.variants.length, hasText, impact),
  };
}

function buildReferenceAnalysis(
  generation: GenerationRecord,
  scorecard: ThumbnailScoreCard,
): CreativeReferenceAnalysis {
  const styleConfig = generation.styleConfig as StyleConfig;
  const storedAnalysis = (generation.referenceAnalysis ?? {}) as Partial<CreativeReferenceAnalysis>;
  const colors = styleConfig.dominantColors?.length
    ? styleConfig.dominantColors
    : ['#0f172a', '#22c55e', '#f59e0b'];
  const impact = generation.variants[0]?.visualImpactScore ?? 72;

  return {
    layout: storedAnalysis.layout ?? inferLayout(styleConfig),
    personPosition: storedAnalysis.personPosition ?? inferPersonPosition(styleConfig),
    objectsPosition: storedAnalysis.objectsPosition ?? ['foreground-accent'],
    backgroundType: storedAnalysis.backgroundType ?? 'scene',
    dominantColors: storedAnalysis.dominantColors ?? colors,
    glowIntensity: storedAnalysis.glowIntensity ?? mapGlowIntensity(styleConfig.glowIntensity),
    style: storedAnalysis.style ?? inferStyle(styleConfig),
    hasText: storedAnalysis.hasText ?? Boolean(styleConfig.text),
    textHierarchy: storedAnalysis.textHierarchy ?? (styleConfig.text ? 'title-only' : undefined),
    hasCTA: storedAnalysis.hasCTA ?? false,
    thumbnailStyle: storedAnalysis.thumbnailStyle ?? 'gamer',
    confidenceScore: storedAnalysis.confidenceScore ?? 0.74,
    visualHierarchy: storedAnalysis.visualHierarchy ?? 'subject-first',
    facialEmotion: storedAnalysis.facialEmotion ?? mapFacialEmotion(impact),
    secondaryColor: storedAnalysis.secondaryColor ?? colors[1] ?? null,
    lightingStyle: storedAnalysis.lightingStyle ?? mapLightingStyle(styleConfig),
    depth: storedAnalysis.depth ?? 'layered',
    visualDensity: storedAnalysis.visualDensity ?? scorecard.visualDensity,
    legibilityScore: storedAnalysis.legibilityScore ?? scorecard.readability,
    visualEnergy: storedAnalysis.visualEnergy ?? (impact >= 80 ? 'high' : impact >= 65 ? 'medium' : 'low'),
    semanticTheme:
      storedAnalysis.semanticTheme ?? generation.template?.category?.toLowerCase().replace(/_/g, '-') ?? 'custom',
    textSafeZone: storedAnalysis.textSafeZone ?? inferTextSafeZone(styleConfig),
    detectedObjects: storedAnalysis.detectedObjects ?? generation.assets.map((asset) => asset.type.toLowerCase()),
    subjectScale: storedAnalysis.subjectScale ?? 'medium',
    styleKeywords: storedAnalysis.styleKeywords ?? [inferStyle(styleConfig), scorecard.visualDensity, 'ctr-focused'],
  };
}

function buildSuggestions(
  scorecard: ThumbnailScoreCard,
  analysis: CreativeReferenceAnalysis,
): CreativeSuggestion[] {
  const suggestions: CreativeSuggestion[] = [];

  if (scorecard.readability < 78) {
    suggestions.push({
      id: 'readability-up',
      category: 'text',
      severity: 'opportunity',
      title: 'Melhorar leitura em miniatura',
      description: 'A thumb pode ganhar leitura com menos elementos competindo pelo texto e contraste mais alto.',
      suggestedPrompt: 'deixa mais clean e aumenta o contraste para leitura em miniatura',
    });
  }

  if (scorecard.subjectDominance < 76) {
    suggestions.push({
      id: 'subject-up',
      category: 'subject',
      severity: 'warning',
      title: 'Dar mais protagonismo ao sujeito',
      description: 'O rosto ou item principal pode ficar maior e com melhor separacao do fundo.',
      suggestedPrompt: 'deixa o rosto maior e destaca mais o sujeito principal',
    });
  }

  if (scorecard.contrast < 74) {
    suggestions.push({
      id: 'contrast-up',
      category: 'contrast',
      severity: 'opportunity',
      title: 'Aumentar contraste visual',
      description: 'Uma paleta mais contrastante pode melhorar o CTR e a leitura no feed do YouTube.',
      suggestedPrompt: 'aumenta o contraste e usa uma paleta mais agressiva',
    });
  }

  if (analysis.visualDensity === 'dense') {
    suggestions.push({
      id: 'density-down',
      category: 'composition',
      severity: 'info',
      title: 'Reduzir poluicao visual',
      description: 'Ha sinais de competicao entre elementos. Uma versao mais limpa pode performar melhor.',
      suggestedPrompt: 'tira dois elementos secundarios e deixa a thumb mais clean',
    });
  }

  if ((analysis.facialEmotion ?? 'neutral') === 'confident') {
    suggestions.push({
      id: 'emotion-up',
      category: 'style',
      severity: 'opportunity',
      title: 'Testar emocao mais intensa',
      description: 'Uma variacao com expressao mais forte pode aumentar energia visual e apelo de clique.',
      suggestedPrompt: 'deixa a expressao mais chocada e mais viral',
    });
  }

  return suggestions;
}

function uniquePreserveOptions(
  options: SemanticEditPreserve[],
): SemanticEditPreserve[] {
  return [...new Set(options)];
}

export function buildSemanticEditDraft(input: {
  generationId: string;
  baseVariantId?: string | null;
  prompt: string;
  preserve?: SemanticEditPreserve[];
}): SemanticEditDraft {
  const normalizedPrompt = input.prompt.trim();
  const lowerPrompt = normalizedPrompt.toLowerCase();
  const preserve = uniquePreserveOptions(input.preserve?.length ? input.preserve : ['layout', 'lighting']);

  const draft: SemanticEditRequest = {
    baseVariantId: input.baseVariantId ?? undefined,
    prompt: normalizedPrompt,
    preserve,
    change: {
      subject: 'keep',
      visualDensity: 'keep',
      background: 'keep',
      subjectScale: 'keep',
      glowIntensity: 'keep',
      objectFocus: 'keep',
      textTreatment: 'keep',
      styleDirective: 'keep',
      compositionLock: 'preserve',
    },
  };

  const promptDelta: string[] = [];

  if (/(troca|substitui|replace).*(pessoa|rosto|subject)/.test(lowerPrompt)) {
    draft.change.subject = 'replace';
    promptDelta.push('replace subject while preserving composition');
  }

  if (/(rosto maior|bigger face|maior|close-up)/.test(lowerPrompt)) {
    draft.change.subjectScale = 'larger';
    promptDelta.push('increase subject scale');
  }

  if (/(clean|limpa|limpo|menos polui|menos elementos)/.test(lowerPrompt)) {
    draft.change.visualDensity = 'reduce';
    if (!draft.change.styleDirective || draft.change.styleDirective === 'keep') {
      draft.change.styleDirective = 'more_clean';
    }
    promptDelta.push('reduce visual density');
  }

  if (/(viral|ctr|mais click|youtube)/.test(lowerPrompt)) {
    draft.change.styleDirective = 'more_viral';
    promptDelta.push('increase viral thumbnail energy');
  }

  if (/(premium|luxo)/.test(lowerPrompt)) {
    draft.change.styleDirective = 'more_premium';
    promptDelta.push('push premium finish and polish');
  }

  if (/(fps|gaming|gamer)/.test(lowerPrompt)) {
    draft.change.styleDirective = 'more_gaming';
    promptDelta.push('lean into gaming thumbnail language');
  }

  if (/(dram[aá]t|agressiv)/.test(lowerPrompt)) {
    draft.change.styleDirective = 'more_dramatic';
    promptDelta.push('intensify dramatic lighting and tension');
  }

  if (/(roxo|purple)/.test(lowerPrompt)) {
    draft.change.paletteShift = 'shift_to_purple';
    promptDelta.push('shift dominant palette toward purple');
  }

  if (/(verde|green)/.test(lowerPrompt) && /(roxo|purple)/.test(lowerPrompt)) {
    draft.change.paletteShift = 'green_to_purple';
    promptDelta.push('convert green accents into purple accents');
  }

  if (/(glow)/.test(lowerPrompt)) {
    draft.change.glowIntensity = /(menos glow|reduce glow|lower glow)/.test(lowerPrompt)
      ? 'lower'
      : 'higher';
    promptDelta.push(draft.change.glowIntensity === 'higher' ? 'increase glow accents' : 'reduce glow accents');
  }

  if (/(fundo|background)/.test(lowerPrompt)) {
    draft.change.background = /(blur|desfoca)/.test(lowerPrompt) ? 'blur' : 'replace';
    promptDelta.push(draft.change.background === 'blur' ? 'blur the background' : 'replace the background');
  }

  if (/(texto|headline|title)/.test(lowerPrompt)) {
    draft.change.textTreatment = /(remove|sem texto|tirar texto)/.test(lowerPrompt) ? 'remove' : 'add';
    promptDelta.push(draft.change.textTreatment === 'add' ? 'add headline treatment' : 'remove text treatment');
  }

  if (/(chocad|assustad|surpres)/.test(lowerPrompt)) {
    draft.change.facialExpression = 'more_shocked';
    promptDelta.push('increase shocked facial expression');
  } else if (/(confiante|confident)/.test(lowerPrompt)) {
    draft.change.facialExpression = 'more_confident';
    promptDelta.push('shift expression toward confidence');
  } else if (/(agressiv)/.test(lowerPrompt)) {
    draft.change.facialExpression = 'more_aggressive';
    promptDelta.push('shift expression toward aggression');
  } else if (/(focado|focus)/.test(lowerPrompt)) {
    draft.change.facialExpression = 'more_focused';
    promptDelta.push('shift expression toward focus');
  }

  if (/(destaca|highlight|objeto principal|faca|weapon|item principal)/.test(lowerPrompt)) {
    draft.change.objectFocus = 'increase';
    promptDelta.push('increase focus on the main object');
  }

  if (!promptDelta.length) {
    promptDelta.push('preserve base layout and apply targeted refinement');
  }

  return {
    generationId: input.generationId,
    baseVariantId: input.baseVariantId ?? null,
    sourcePrompt: normalizedPrompt,
    normalizedRequest: draft,
    promptDelta,
    previewSummary: promptDelta.join(', '),
  };
}

export class GenerationCreativeService {
  private async loadGeneration(generationId: string, tenantId: string) {
    const generation = await prisma.generationRequest.findFirst({
      where: { id: generationId, tenantId },
      include: {
        template: {
          select: {
            id: true,
            name: true,
            category: true,
          },
        },
        assets: {
          select: {
            type: true,
          },
        },
        variants: {
          orderBy: {
            variantIndex: 'asc',
          },
          select: {
            id: true,
            variantIndex: true,
            templateAdherenceScore: true,
            textReadabilityScore: true,
            visualImpactScore: true,
          },
        },
      },
    });

    if (!generation) {
      throw new NotFoundError('Generation', generationId);
    }

    return generation;
  }

  async getCreativeSummary(generationId: string, tenantId: string): Promise<GenerationCreativeSummary> {
    const generation = await this.loadGeneration(generationId, tenantId);
    const styleConfig = generation.styleConfig as StyleConfig;
    const scorecard = buildScorecard(generation);
    const referenceAnalysis = buildReferenceAnalysis(generation, scorecard);
    const suggestions = buildSuggestions(scorecard, referenceAnalysis);

    return {
      generationId: generation.id,
      baseVariantId: generation.variants[0]?.id ?? null,
      styleConfig,
      visualStyle: inferStyle(styleConfig),
      referenceAnalysis,
      scorecard,
      suggestions,
      recommendedPreserveOptions: ['layout', 'lighting', 'palette'],
      quickEditPrompts: [
        'deixa a arma maior',
        'troca o fundo',
        'deixa mais parecido com CS',
        'remove excesso de neon',
        'deixa menos artificial',
        'destaca mais o inimigo',
      ],
    };
  }

  async createSemanticEditDraft(
    generationId: string,
    tenantId: string,
    input: {
      baseVariantId?: string | undefined;
      prompt: string;
      preserve?: SemanticEditPreserve[] | undefined;
    },
  ): Promise<SemanticEditDraft> {
    const generation = await this.loadGeneration(generationId, tenantId);
    const baseVariantId = input.baseVariantId ?? generation.variants[0]?.id ?? undefined;

    const draftInput: Parameters<typeof buildSemanticEditDraft>[0] = {
      generationId,
      prompt: input.prompt,
    };
    if (baseVariantId) draftInput.baseVariantId = baseVariantId;
    if (input.preserve) draftInput.preserve = input.preserve;
    return buildSemanticEditDraft(draftInput);
  }
}
