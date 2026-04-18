import { VariantType } from '@thumbforge/shared';
import type {
  BuiltPrompt,
  PromptBuilderInput,
  ReferenceAnalysisFull,
  StyleConfig,
  TemplateIntelligenceInput,
  TemplateLayoutResponse,
  TemplateLayoutSuggestion,
  VisualStyle,
} from '@thumbforge/shared';
import { PromptBuilderService } from '../prompt-builder/prompt-builder.service.js';

function normalizeToken(value: string): string {
  return value.trim().toLowerCase();
}

function resolvePalette(color: string): [string, string, string] {
  const token = normalizeToken(color);

  if (token.startsWith('#') && token.length === 7) {
    return [token, '#111827', '#f8fafc'];
  }

  switch (token) {
    case 'red':
    case 'vermelho':
      return ['#ef4444', '#f59e0b', '#111827'];
    case 'orange':
    case 'laranja':
      return ['#f97316', '#facc15', '#1f2937'];
    case 'yellow':
    case 'amarelo':
      return ['#facc15', '#f97316', '#111827'];
    case 'green':
    case 'verde':
      return ['#22c55e', '#0f172a', '#f8fafc'];
    case 'cyan':
    case 'ciano':
      return ['#06b6d4', '#1d4ed8', '#f8fafc'];
    case 'blue':
    case 'azul':
      return ['#3b82f6', '#06b6d4', '#111827'];
    default:
      return ['#f97316', '#facc15', '#111827'];
  }
}

function mapEmotion(emotion: string): PromptBuilderInput['expression']['emotion'] {
  const token = normalizeToken(emotion);

  if (/(shock|surpres|choc)/.test(token)) return 'shocked';
  if (/(agress|raiva|furia)/.test(token)) return 'aggressive';
  if (/(focus|focad|concentr)/.test(token)) return 'focused';
  if (/(happy|feliz|comemor)/.test(token)) return 'happy';
  if (/(confian|domina|seguro)/.test(token)) return 'confident';
  return 'excited';
}

function mapVisualStyle(emotion: string, recommended: VariantType): VisualStyle {
  const token = normalizeToken(emotion);

  if (recommended === VariantType.CLEAN || recommended === VariantType.PREMIUM) {
    return 'clean';
  }
  if (recommended === VariantType.DRAMATICA) {
    return 'dramatic';
  }
  if (/(cinema|dram)/.test(token)) {
    return 'cinematic';
  }
  return 'high-energy';
}

function compositionToLayout(
  compositionType: TemplateLayoutSuggestion['compositionType'],
): PromptBuilderInput['composition']['layout'] {
  switch (compositionType) {
    case 'central':
      return 'centered';
    case 'split':
      return 'split';
    case 'facecam-overlay':
      return 'right-dominant';
    default:
      return 'left-dominant';
  }
}

function buildLayoutSuggestions(input: TemplateIntelligenceInput): TemplateLayoutSuggestion[] {
  const [primary, secondary, accent] = resolvePalette(input.dominantColor);
  const game = input.game.trim();
  const videoType = input.videoType.trim();
  const emotion = input.emotion.trim();
  const mainObject = input.mainObject.trim();
  const facecamStyle = input.facecamStyle.trim();

  return [
    {
      id: 'hero-weapon-push',
      name: 'Hero Weapon Push',
      hook: 'arma enorme em primeiro plano com leitura instantanea',
      description: `first-person com ${mainObject} gigante, mapa de ${game} ao fundo e facecam em destaque`,
      compositionType: 'first-person',
      textZone: 'bottom-left',
      facecamPosition: 'top-right',
      visualPriority: [mainObject, 'facecam', `${game} map`],
      ctrReasoning: 'objeto principal grande, contraste forte e facecam limpa aumentam leitura em feed pequeno',
      score: 94,
      recommendedVariantType: VariantType.VIRAL,
      styleConfigPatch: {
        dominantColors: [primary, secondary, accent],
        glowColor: secondary,
        glowIntensity: 82,
        textPosition: 'bottom-left',
        visualStyle: 'high-energy',
        dominantColor: input.dominantColor,
        mainObject,
        facecamStyle,
        templateLayoutId: 'hero-weapon-push',
      },
      freeTextDirective: `highlight ${mainObject} in first-person perspective, keep facecam ${facecamStyle} in the top-right corner, avoid generic poster art, prioritize instant readability at thumbnail size`,
    },
    {
      id: 'enemy-lock-center',
      name: 'Enemy Lock Center',
      hook: 'inimigo central com tensao alta e arma guiando o olhar',
      description: `inimigo ao centro, ${mainObject} em diagonal e look mais dramatico para ${videoType}`,
      compositionType: 'diagonal',
      textZone: 'top-left',
      facecamPosition: 'top-right',
      visualPriority: ['enemy', mainObject, 'facecam'],
      ctrReasoning: 'um centro forte com conflito claro facilita entender o tema em menos de 1 segundo',
      score: 91,
      recommendedVariantType: VariantType.DRAMATICA,
      styleConfigPatch: {
        dominantColors: [primary, '#111827', secondary],
        glowColor: primary,
        glowIntensity: 68,
        textPosition: 'top-left',
        visualStyle: 'dramatic',
        dominantColor: input.dominantColor,
        mainObject,
        facecamStyle,
        templateLayoutId: 'enemy-lock-center',
      },
      freeTextDirective: `place the enemy at the center, keep ${mainObject} crossing the frame diagonally, push tension and separation between foreground and background, feel authentic to ${game}`,
    },
    {
      id: 'reaction-split-proof',
      name: 'Reaction Split Proof',
      hook: 'facecam forte de um lado e prova visual do outro',
      description: `split layout com facecam ${facecamStyle} e gameplay organizado para ${videoType}`,
      compositionType: 'split',
      textZone: 'middle-left',
      facecamPosition: 'top-right',
      visualPriority: ['facecam', mainObject, 'proof moment'],
      ctrReasoning: 'split claro ajuda o usuario a ler causa e efeito rapidamente sem poluicao',
      score: 88,
      recommendedVariantType: VariantType.PREMIUM,
      styleConfigPatch: {
        dominantColors: [primary, secondary, accent],
        glowColor: accent,
        glowIntensity: 54,
        textPosition: 'middle-left',
        visualStyle: 'clean',
        dominantColor: input.dominantColor,
        mainObject,
        facecamStyle,
        templateLayoutId: 'reaction-split-proof',
      },
      freeTextDirective: `build a split layout with expressive facecam ${facecamStyle} on the right side and gameplay proof on the left, keep the text area clean, make it feel like a big gaming channel thumbnail`,
    },
    {
      id: 'clean-map-callout',
      name: 'Clean Map Callout',
      hook: 'menos ruido, mais leitura e um unico ponto de impacto',
      description: `layout limpo com ${mainObject} dominante, mapa reconhecivel de ${game} e texto curto`,
      compositionType: 'facecam-overlay',
      textZone: 'bottom-center',
      facecamPosition: 'top-right',
      visualPriority: [mainObject, `${game} map`, 'short text'],
      ctrReasoning: 'reduzir excesso de elementos melhora clareza e evita cara de poster generico',
      score: 86,
      recommendedVariantType: VariantType.CLEAN,
      styleConfigPatch: {
        dominantColors: [primary, '#0f172a', accent],
        glowColor: primary,
        glowIntensity: 34,
        textPosition: 'bottom-center',
        visualStyle: 'clean',
        dominantColor: input.dominantColor,
        mainObject,
        facecamStyle,
        templateLayoutId: 'clean-map-callout',
      },
      freeTextDirective: `keep only the strongest elements, make ${mainObject} large and readable, use the ${game} map as a supporting background, remove excess neon and preserve clear depth`,
    },
  ];
}

export class ThumbnailWorkflowService {
  constructor(private readonly promptBuilder = new PromptBuilderService()) {}

  generateTemplateLayouts(input: TemplateIntelligenceInput): TemplateLayoutResponse {
    return {
      input,
      layouts: buildLayoutSuggestions(input),
    };
  }

  buildTemplateModePrompts(params: {
    input: TemplateIntelligenceInput;
    selectedLayoutIds?: string[] | undefined;
    styleConfig?: StyleConfig | undefined;
    referenceAnalysis?: ReferenceAnalysisFull | undefined;
  }): BuiltPrompt[] {
    const layouts = this.generateTemplateLayouts(params.input).layouts;
    const selected = params.selectedLayoutIds?.length
      ? layouts.filter((layout) => params.selectedLayoutIds?.includes(layout.id))
      : layouts;
    const activeLayouts = selected.length > 0 ? selected : layouts;

    const [primary, secondary, accent] = resolvePalette(params.input.dominantColor);

    return activeLayouts.map((layout) => {
      const input: PromptBuilderInput = {
        subject: {
          description: `gaming creator covering ${params.input.videoType} in ${params.input.game}`,
          scale: layout.id === 'reaction-split-proof' ? 'medium' : 'large',
          position: layout.facecamPosition.includes('right') ? 'right' : 'left',
        },
        expression: {
          emotion: mapEmotion(params.input.emotion),
          intensity: layout.recommendedVariantType === VariantType.CLEAN ? 'moderate' : 'extreme',
        },
        pose: {
          type: layout.id === 'hero-weapon-push' ? 'action' : layout.id === 'reaction-split-proof' ? 'closeup' : 'three-quarter',
          direction: 'camera',
        },
        objects: [
          {
            name: params.input.mainObject,
            prominence: 'dominant',
            position: layout.visualPriority[0],
          },
          ...(layout.id === 'enemy-lock-center'
            ? [{ name: 'enemy target', prominence: 'foreground' as const, position: 'center' }]
            : []),
        ],
        background: {
          type: 'scene',
          description: `${params.input.game} map supporting a ${params.input.videoType} moment`,
          complexity: layout.recommendedVariantType === VariantType.CLEAN ? 'minimal' : 'moderate',
        },
        lighting: {
          style:
            layout.recommendedVariantType === VariantType.DRAMATICA
              ? 'dramatic'
              : layout.recommendedVariantType === VariantType.CLEAN
                ? 'studio'
                : 'neon',
          rimLight: true,
          glowColor: layout.styleConfigPatch.glowColor ?? secondary,
          glowIntensity:
            layout.recommendedVariantType === VariantType.CLEAN
              ? 'subtle'
              : layout.recommendedVariantType === VariantType.PREMIUM
                ? 'medium'
                : 'intense',
        },
        palette: {
          primary,
          secondary,
          accent,
          mood: layout.recommendedVariantType === VariantType.CLEAN ? 'dark' : 'neon',
        },
        composition: {
          layout: compositionToLayout(layout.compositionType),
          textPosition: layout.textZone,
          textContent: params.input.text,
          textHierarchy: params.input.text ? 'title-only' : undefined,
          hasCTA: false,
        },
        style: mapVisualStyle(params.input.emotion, layout.recommendedVariantType),
        readability: {
          priority: 'high',
          contrast: 'high',
          fontWeight: params.input.text ? 'black' : 'bold',
        },
        ctrFocus: {
          strategy: /(tutorial|guide|dica|como)/i.test(params.input.videoType) ? 'value' : 'shock',
          intensity: layout.recommendedVariantType === VariantType.CLEAN ? 'moderate' : 'aggressive',
        },
        variantType: layout.recommendedVariantType,
        freeTextOverride: `${layout.freeTextDirective}. Keep the center focus readable. Avoid generic poster art. Make it feel like a high-CTR YouTube gaming thumbnail.`,
        referenceAnalysis: params.referenceAnalysis,
      };

      return this.promptBuilder.build({
        ...input,
        style: (params.styleConfig?.visualStyle as VisualStyle | undefined) ?? input.style,
      });
    });
  }
}
