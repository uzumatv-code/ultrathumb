import { useEffect, useMemo, useRef, useState, type ElementType } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import toast from 'react-hot-toast';
import {
  Bot,
  Camera,
  Check,
  Eye,
  ImagePlus,
  LayoutTemplate,
  Loader2,
  Package,
  Sparkles,
  User,
  Wand2,
  X,
} from 'lucide-react';
import { VariantType } from '@thumbforge/shared';
import type {
  ReferenceAnalysisResponse,
  StyleConfig,
  TemplateIntelligenceInput,
  TemplateLayoutResponse,
  TemplateLayoutSuggestion,
} from '@thumbforge/shared';
import { generationsApi, referenceAnalyzerApi } from '../../services/api.js';
import { cn } from '../../utils/cn.js';

type WorkflowMode = 'reference' | 'template';
type UploadField = 'reference' | 'person' | 'assets';

interface UploadedFile {
  file: File;
  preview: string;
  fieldname: UploadField;
}

interface ReferenceOptionsState {
  keepComposition: boolean;
  swapFace: boolean;
  swapWeapon: boolean;
  swapMap: boolean;
  realismGoal: 'maintain' | 'realistic' | 'punchier';
}

const DOMINANT_COLORS = [
  'amarelo',
  'laranja',
  'vermelho',
  'verde',
  'azul',
  'ciano',
];

const FACECAM_STYLES = [
  'clean',
  'neon',
  'cutout',
  'rounded',
];

const QUICK_EDITOR_COMMANDS = [
  'deixa a arma maior',
  'troca o fundo',
  'aumenta a expressao',
  'deixa mais parecido com CS',
  'remove excesso de neon',
  'deixa menos artificial',
  'destaca mais o inimigo',
  'faz parecer thumbnail de canal grande',
];

const TEMPLATE_TEXT_FIELDS: Array<{
  field: 'game' | 'videoType' | 'emotion' | 'mainObject';
  label: string;
  placeholder: string;
}> = [
  { field: 'game', label: 'Jogo', placeholder: 'Counter-Strike 2' },
  { field: 'videoType', label: 'Tipo de video', placeholder: 'highlight, tutorial, clutch, rank up' },
  { field: 'emotion', label: 'Emocao', placeholder: 'agressivo, chocado, focado' },
  { field: 'mainObject', label: 'Objeto principal', placeholder: 'AK-47, faca, personagem' },
];

const DEFAULT_TEMPLATE_INPUT: TemplateIntelligenceInput = {
  game: 'Counter-Strike 2',
  videoType: 'highlight',
  emotion: 'agressivo',
  mainObject: 'AK-47',
  text: '',
  dominantColor: 'laranja',
  facecamStyle: 'neon',
};

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-400">{label}</span>
        <span className="font-medium text-slate-200">{value}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-800">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            value >= 85 ? 'bg-emerald-500' : value >= 70 ? 'bg-amber-500' : 'bg-red-500',
          )}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

function UploadCard({
  title,
  description,
  fieldname,
  files,
  onAdd,
  onRemove,
  multiple = false,
  icon: Icon,
}: {
  title: string;
  description: string;
  fieldname: UploadField;
  files: UploadedFile[];
  onAdd: (fieldname: UploadField, files: File[]) => void;
  onRemove: (fieldname: UploadField, preview?: string) => void;
  multiple?: boolean;
  icon: ElementType;
}) {
  const fieldFiles = files.filter((file) => file.fieldname === fieldname);
  const onDrop = (accepted: File[]) => onAdd(fieldname, accepted);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple,
    accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp'] },
    maxSize: 10 * 1024 * 1024,
  });

  return (
    <div className="glass-card p-4">
      <div className="mb-3">
        <div className="flex items-center gap-2 text-slate-100">
          <Icon className="h-4 w-4 text-brand-400" />
          <h3 className="font-medium">{title}</h3>
        </div>
        <p className="mt-1 text-xs text-slate-500">{description}</p>
      </div>

      {fieldFiles.length > 0 ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-3">
            {fieldFiles.map((file) => (
              <div key={file.preview} className="group relative">
                <img
                  src={file.preview}
                  alt=""
                  className="h-20 w-28 rounded-xl border border-slate-700 object-cover"
                />
                <button
                  type="button"
                  onClick={() => onRemove(fieldname, file.preview)}
                  className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>

          {(multiple || fieldFiles.length === 0) && (
            <button
              type="button"
              {...getRootProps()}
              className="btn-secondary w-full border-dashed py-3 text-sm"
            >
              <input {...getInputProps()} />
              Adicionar mais arquivos
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          {...getRootProps()}
          className={cn(
            'flex min-h-32 w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 text-center transition-all',
            isDragActive
              ? 'border-brand-500 bg-brand-500/10'
              : 'border-slate-700 bg-surface-900 hover:border-brand-500/60',
          )}
        >
          <input {...getInputProps()} />
          <Icon className="mb-2 h-7 w-7 text-slate-500" />
          <p className="text-sm text-slate-300">
            {isDragActive ? 'Solte os arquivos aqui' : 'Arraste ou clique para enviar'}
          </p>
          <p className="mt-1 text-xs text-slate-500">PNG, JPG ou WEBP ate 10MB</p>
        </button>
      )}
    </div>
  );
}

function buildReferencePrompt(options: ReferenceOptionsState, extraPrompt: string) {
  const directives: string[] = [];

  directives.push(
    options.keepComposition
      ? 'manter a composicao principal da referencia e preservar a leitura em tamanho pequeno'
      : 'pode recompor a estrutura para aumentar clareza e CTR',
  );

  if (options.swapFace) directives.push('trocar apenas o rosto ou a facecam, sem perder a estrutura');
  if (options.swapWeapon) directives.push('trocar a arma principal e manter o restante coerente');
  if (options.swapMap) directives.push('trocar o mapa ou fundo e manter o foco do assunto');

  if (options.realismGoal === 'realistic') {
    directives.push('deixar menos artificial, com look mais realista e menos poster art');
  }
  if (options.realismGoal === 'punchier') {
    directives.push('deixar mais chamativa, com contraste forte e leitura instantanea');
  }

  if (extraPrompt.trim()) {
    directives.push(extraPrompt.trim());
  }

  directives.push('evitar poster art generica e priorizar leitura imediata em miniatura');

  return directives.join('. ');
}

function getReferenceVariantTypes(
  realismGoal: ReferenceOptionsState['realismGoal'],
): VariantType[] {
  if (realismGoal === 'realistic') {
    return [VariantType.CONSERVADORA, VariantType.PREMIUM, VariantType.DRAMATICA];
  }

  if (realismGoal === 'punchier') {
    return [VariantType.VIRAL, VariantType.DRAMATICA, VariantType.EXTREMA];
  }

  return [VariantType.CONSERVADORA, VariantType.VIRAL, VariantType.PREMIUM];
}

export function GeneratePage() {
  const navigate = useNavigate();

  const [mode, setMode] = useState<WorkflowMode>('reference');
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [referenceInsight, setReferenceInsight] = useState<ReferenceAnalysisResponse | null>(null);
  const [referenceOptions, setReferenceOptions] = useState<ReferenceOptionsState>({
    keepComposition: true,
    swapFace: false,
    swapWeapon: false,
    swapMap: false,
    realismGoal: 'maintain',
  });
  const [templateInput, setTemplateInput] = useState<TemplateIntelligenceInput>(DEFAULT_TEMPLATE_INPUT);
  const [templateLayouts, setTemplateLayouts] = useState<TemplateLayoutSuggestion[]>([]);
  const [selectedLayoutIds, setSelectedLayoutIds] = useState<string[]>([]);
  const [freeTextPrompt, setFreeTextPrompt] = useState('');
  const [isAnalyzingReference, setIsAnalyzingReference] = useState(false);
  const [isGeneratingLayouts, setIsGeneratingLayouts] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastAnalyzedPreview, setLastAnalyzedPreview] = useState<string | null>(null);
  const filesRef = useRef<UploadedFile[]>([]);

  const referenceFile = files.find((file) => file.fieldname === 'reference');
  const selectedLayouts = useMemo(
    () => templateLayouts.filter((layout) => selectedLayoutIds.includes(layout.id)),
    [templateLayouts, selectedLayoutIds],
  );

  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  useEffect(() => {
    return () => {
      filesRef.current.forEach((file) => URL.revokeObjectURL(file.preview));
    };
  }, []);

  useEffect(() => {
    if (mode !== 'reference') return;
    if (!referenceFile) {
      setReferenceInsight(null);
      setLastAnalyzedPreview(null);
      return;
    }
    if (referenceFile.preview === lastAnalyzedPreview) return;

    const analyze = async () => {
      setIsAnalyzingReference(true);
      try {
        const formData = new FormData();
        formData.append('image', referenceFile.file, referenceFile.file.name);
        const { data } = await referenceAnalyzerApi.analyze(formData);
        setReferenceInsight(data.data as ReferenceAnalysisResponse);
        setLastAnalyzedPreview(referenceFile.preview);
      } catch (error: unknown) {
        const message =
          (error as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ??
          'Nao foi possivel analisar a referencia';
        toast.error(message);
      } finally {
        setIsAnalyzingReference(false);
      }
    };

    void analyze();
  }, [lastAnalyzedPreview, mode, referenceFile]);

  const addFiles = (fieldname: UploadField, accepted: File[]) => {
    setFiles((previous) => {
      const next = [...previous];

      if (fieldname !== 'assets') {
        previous
          .filter((file) => file.fieldname === fieldname)
          .forEach((file) => URL.revokeObjectURL(file.preview));
      }

      const withoutCurrent =
        fieldname === 'assets'
          ? next
          : next.filter((file) => file.fieldname !== fieldname);

      const mapped = accepted.map((file) => ({
        file,
        preview: URL.createObjectURL(file),
        fieldname,
      }));

      return [...withoutCurrent, ...mapped];
    });
  };

  const removeFiles = (fieldname: UploadField, preview?: string) => {
    setFiles((previous) => {
      const remaining = previous.filter((file) => {
        if (file.fieldname !== fieldname) return true;
        if (fieldname === 'assets' && preview && file.preview !== preview) return true;
        URL.revokeObjectURL(file.preview);
        return false;
      });

      return remaining;
    });

    if (fieldname === 'reference') {
      setReferenceInsight(null);
      setLastAnalyzedPreview(null);
    }
  };

  const handleGenerateLayouts = async () => {
    setIsGeneratingLayouts(true);
    try {
      const { data } = await generationsApi.templateLayouts(templateInput);
      const payload = data.data as TemplateLayoutResponse;
      setTemplateLayouts(payload.layouts);
      setSelectedLayoutIds(payload.layouts.map((layout) => layout.id));
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ??
        'Nao foi possivel gerar os layouts';
      toast.error(message);
    } finally {
      setIsGeneratingLayouts(false);
    }
  };

  const handleSubmitReferenceMode = async () => {
    if (!referenceFile) {
      toast.error('Envie uma thumbnail de referencia primeiro.');
      return;
    }

    setIsGenerating(true);
    try {
      const formData = new FormData();
      const analysis = referenceInsight?.analysis;
      const styleConfig: StyleConfig = {
        workflowMode: 'reference',
        visualStyle: analysis?.style ?? 'gamer',
        dominantColors: analysis?.dominantColors,
        dominantColor: analysis?.primaryColor ?? analysis?.dominantColors[0],
        facecamStyle: analysis?.facecamStyle,
        mainObject: analysis?.dominantObject ?? templateInput.mainObject,
        realismGoal: referenceOptions.realismGoal,
      };

      formData.append('styleConfig', JSON.stringify(styleConfig));
      formData.append('workflowMode', 'reference');
      formData.append(
        'variantTypes',
        JSON.stringify(getReferenceVariantTypes(referenceOptions.realismGoal)),
      );
      formData.append(
        'freeTextPrompt',
        buildReferencePrompt(referenceOptions, freeTextPrompt),
      );

      files.forEach((file) => {
        formData.append(file.fieldname, file.file, file.file.name);
      });

      const { data } = await generationsApi.create(formData);
      toast.success('Analise aplicada e geracao iniciada.');
      navigate(`/editor/${(data.data as { id: string }).id}`);
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ??
        'Nao foi possivel iniciar a geracao';
      toast.error(message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSubmitTemplateMode = async () => {
    if (!templateLayouts.length) {
      await handleGenerateLayouts();
      return;
    }

    if (!selectedLayoutIds.length) {
      toast.error('Selecione pelo menos um layout.');
      return;
    }

    setIsGenerating(true);
    try {
      const formData = new FormData();
      const firstLayout = selectedLayouts[0];
      const styleConfig: StyleConfig = {
        workflowMode: 'template',
        visualStyle: firstLayout?.styleConfigPatch.visualStyle ?? 'high-energy',
        dominantColors: firstLayout?.styleConfigPatch.dominantColors,
        glowColor: firstLayout?.styleConfigPatch.glowColor,
        glowIntensity: firstLayout?.styleConfigPatch.glowIntensity,
        textPosition: firstLayout?.styleConfigPatch.textPosition,
        text: templateInput.text,
        dominantColor: templateInput.dominantColor,
        game: templateInput.game,
        videoType: templateInput.videoType,
        emotion: templateInput.emotion,
        mainObject: templateInput.mainObject,
        facecamStyle: templateInput.facecamStyle,
        templateLayoutId: firstLayout?.id,
      };

      formData.append('styleConfig', JSON.stringify(styleConfig));
      formData.append('workflowMode', 'template');
      formData.append('templateModeInput', JSON.stringify(templateInput));
      formData.append('selectedLayoutIds', JSON.stringify(selectedLayoutIds));
      formData.append(
        'variantTypes',
        JSON.stringify(selectedLayouts.map((layout) => layout.recommendedVariantType)),
      );
      formData.append(
        'freeTextPrompt',
        [
          freeTextPrompt.trim(),
          'Apply high CTR gaming thumbnail logic, avoid generic poster art, prioritize instant readability at small size.',
        ]
          .filter(Boolean)
          .join('. '),
      );

      files
        .filter((file) => file.fieldname !== 'reference')
        .forEach((file) => {
          formData.append(file.fieldname, file.file, file.file.name);
        });

      const { data } = await generationsApi.create(formData);
      toast.success('Os 4 layouts foram enviados para geracao.');
      navigate(`/editor/${(data.data as { id: string }).id}`);
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ??
        'Nao foi possivel iniciar a geracao';
      toast.error(message);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="page-container space-y-8 py-8">
      <section className="grid gap-6 lg:grid-cols-[1.5fr_0.9fr]">
        <div className="space-y-4">
          <span className="badge badge-brand">Studio de Thumbnail</span>
          <div>
            <h1 className="text-4xl font-display font-bold text-slate-100">
              Gere por referencia, template inteligente e refine no editor IA
            </h1>
            <p className="mt-3 max-w-3xl text-base text-slate-400">
              O fluxo agora separa claramente leitura visual, composicao de CTR e refinamento localizado.
              Em vez de regenerar tudo do zero, voce analisa, decide o que preservar e continua editando por comando curto.
            </p>
          </div>
        </div>

        <div className="glass-card p-5">
          <div className="mb-4 flex items-center gap-2 text-slate-100">
            <Bot className="h-5 w-5 text-brand-400" />
            <h2 className="font-semibold">Modo 3 - Editor com IA</h2>
          </div>
          <p className="text-sm text-slate-400">
            Depois de gerar, voce cai direto no editor para ajustar apenas o que importa.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {QUICK_EDITOR_COMMANDS.map((command) => (
              <span key={command} className="rounded-full border border-slate-700 bg-surface-800 px-3 py-1 text-xs text-slate-300">
                {command}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <button
          type="button"
          onClick={() => setMode('reference')}
          className={cn(
            'glass-card p-5 text-left transition-all',
            mode === 'reference' ? 'border-brand-500/60 shadow-glow-sm' : 'hover:border-slate-600',
          )}
        >
          <div className="mb-3 flex items-center gap-2">
            <ImagePlus className="h-5 w-5 text-brand-400" />
            <span className="badge badge-brand">Modo 1</span>
          </div>
          <h2 className="text-lg font-semibold text-slate-100">Thumbnail por referencia</h2>
          <p className="mt-2 text-sm text-slate-400">
            Envie uma thumb modelo, veja o DNA visual extraido e escolha exatamente o que vai manter ou trocar.
          </p>
        </button>

        <button
          type="button"
          onClick={() => setMode('template')}
          className={cn(
            'glass-card p-5 text-left transition-all',
            mode === 'template' ? 'border-brand-500/60 shadow-glow-sm' : 'hover:border-slate-600',
          )}
        >
          <div className="mb-3 flex items-center gap-2">
            <LayoutTemplate className="h-5 w-5 text-brand-400" />
            <span className="badge badge-brand">Modo 2</span>
          </div>
          <h2 className="text-lg font-semibold text-slate-100">Template inteligente</h2>
          <p className="mt-2 text-sm text-slate-400">
            Escolha jogo, tipo de video, emocao, objeto, texto, cor e facecam. O sistema responde com 4 layouts guiados por CTR.
          </p>
        </button>

        <div className="glass-card border-dashed p-5">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-brand-400" />
            <span className="badge badge-info">Apos gerar</span>
          </div>
          <h2 className="text-lg font-semibold text-slate-100">Refino sem regenerar tudo</h2>
          <p className="mt-2 text-sm text-slate-400">
            O editor recebe comandos curtos para trocar arma, fundo, mapa, intensidade emocional, neon e realismo sem perder a base.
          </p>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            {mode === 'reference' && (
              <UploadCard
                title="Thumbnail modelo"
                description="A IA vai extrair composicao, objeto dominante, paleta, facecam e teste de leitura em 1 segundo."
                fieldname="reference"
                files={files}
                onAdd={addFiles}
                onRemove={removeFiles}
                icon={ImagePlus}
              />
            )}

            <UploadCard
              title="Pessoa ou personagem"
              description="Opcional. Envie o rosto ou sujeito que deve entrar na thumb."
              fieldname="person"
              files={files}
              onAdd={addFiles}
              onRemove={removeFiles}
              icon={User}
            />

            <UploadCard
              title="Objetos e itens"
              description="Opcional. Armas, itens, logos ou props que devem aparecer."
              fieldname="assets"
              files={files}
              onAdd={addFiles}
              onRemove={removeFiles}
              multiple
              icon={Package}
            />

            {mode === 'template' && (
              <div className="glass-card p-4">
                <div className="mb-3 flex items-center gap-2 text-slate-100">
                  <Camera className="h-4 w-4 text-brand-400" />
                  <h3 className="font-medium">Facecam e acabamento</h3>
                </div>
                <p className="text-xs text-slate-500">
                  O modo template usa esses campos para gerar layouts com leitura forte e espacamento correto.
                </p>
              </div>
            )}
          </div>

          {mode === 'reference' ? (
            <div className="space-y-4">
              <div className="glass-card p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-100">Leitura automatica da referencia</h2>
                    <p className="mt-1 text-sm text-slate-400">
                      O sistema detecta a composicao base e sugere o que voce pode preservar ou trocar.
                    </p>
                  </div>
                  {isAnalyzingReference && (
                    <div className="flex items-center gap-2 text-sm text-brand-300">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Analisando
                    </div>
                  )}
                </div>

                {referenceInsight ? (
                  <div className="space-y-5">
                    <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                      <div className="space-y-2">
                        {referenceInsight.guidedFlow.detections.map((detection) => (
                          <div key={detection} className="rounded-xl border border-slate-700 bg-surface-800 px-4 py-3 text-sm text-slate-200">
                            {detection}
                          </div>
                        ))}
                      </div>

                      <div className="glass-card bg-surface-950/50 p-4">
                        <div className="mb-3 flex items-center gap-2 text-slate-100">
                          <Eye className="h-4 w-4 text-brand-400" />
                          <h3 className="font-medium">Teste de 1 segundo</h3>
                        </div>
                        <div className={cn(
                          'mb-3 rounded-xl px-3 py-2 text-sm font-medium',
                          referenceInsight.guidedFlow.oneSecondTest.passes
                            ? 'bg-emerald-500/15 text-emerald-300'
                            : 'bg-amber-500/15 text-amber-300',
                        )}>
                          {referenceInsight.guidedFlow.oneSecondTest.passes ? 'Passou' : 'Precisa melhorar'}
                        </div>
                        <p className="text-sm text-slate-400">
                          {referenceInsight.guidedFlow.oneSecondTest.explanation}
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="glass-card bg-surface-950/40 p-4">
                        <h3 className="mb-3 font-medium text-slate-100">Perguntas guiadas</h3>
                        <div className="space-y-2">
                          {referenceInsight.guidedFlow.questions.map((question) => (
                            <div key={question} className="rounded-xl border border-slate-700 bg-surface-800 px-3 py-2 text-sm text-slate-300">
                              {question}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="glass-card bg-surface-950/40 p-4">
                        <h3 className="mb-3 font-medium text-slate-100">Scoring visual</h3>
                        <div className="space-y-3">
                          <ScoreBar label="Impacto" value={referenceInsight.guidedFlow.visualScoring.impact} />
                          <ScoreBar label="Clareza" value={referenceInsight.guidedFlow.visualScoring.clarity} />
                          <ScoreBar label="Estilo" value={referenceInsight.guidedFlow.visualScoring.style} />
                          <ScoreBar label="Legibilidade" value={referenceInsight.guidedFlow.visualScoring.legibility} />
                          <ScoreBar label="Semelhanca" value={referenceInsight.guidedFlow.visualScoring.referenceSimilarity} />
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-3">
                      {[
                        ['composicao', referenceInsight.guidedFlow.autoExtraction.compositionType],
                        ['objeto dominante', referenceInsight.guidedFlow.autoExtraction.dominantObject],
                        ['cor principal', referenceInsight.guidedFlow.autoExtraction.primaryColor],
                        ['saturacao', referenceInsight.guidedFlow.autoExtraction.saturationLevel],
                        ['glow', referenceInsight.guidedFlow.autoExtraction.glowLevel],
                        ['contorno', referenceInsight.guidedFlow.autoExtraction.outlineStyle],
                        ['facecam', `${referenceInsight.guidedFlow.autoExtraction.facecamPosition} / ${referenceInsight.guidedFlow.autoExtraction.facecamStyle}`],
                        ['densidade', referenceInsight.guidedFlow.autoExtraction.visualDensity],
                        ['profundidade', referenceInsight.guidedFlow.autoExtraction.depth],
                      ].map(([label, value]) => (
                        <div key={label} className="rounded-2xl border border-slate-700 bg-surface-900 px-4 py-3">
                          <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
                          <p className="mt-1 text-sm font-medium text-slate-200">{value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-700 bg-surface-900 px-5 py-10 text-center text-sm text-slate-500">
                    Envie a thumbnail modelo para liberar a analise automatica.
                  </div>
                )}
              </div>

              <div className="glass-card p-5">
                <h2 className="text-xl font-semibold text-slate-100">O que voce quer preservar ou trocar?</h2>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {[
                    {
                      label: 'manter composicao',
                      value: referenceOptions.keepComposition,
                      onToggle: () =>
                        setReferenceOptions((current) => ({ ...current, keepComposition: !current.keepComposition })),
                    },
                    {
                      label: 'trocar apenas o rosto',
                      value: referenceOptions.swapFace,
                      onToggle: () =>
                        setReferenceOptions((current) => ({ ...current, swapFace: !current.swapFace })),
                    },
                    {
                      label: 'trocar a arma',
                      value: referenceOptions.swapWeapon,
                      onToggle: () =>
                        setReferenceOptions((current) => ({ ...current, swapWeapon: !current.swapWeapon })),
                    },
                    {
                      label: 'trocar o mapa',
                      value: referenceOptions.swapMap,
                      onToggle: () =>
                        setReferenceOptions((current) => ({ ...current, swapMap: !current.swapMap })),
                    },
                  ].map((option) => (
                    <button
                      key={option.label}
                      type="button"
                      onClick={option.onToggle}
                      className={cn(
                        'flex items-center justify-between rounded-2xl border px-4 py-3 text-left transition-all',
                        option.value
                          ? 'border-brand-500/60 bg-brand-500/10 text-slate-100'
                          : 'border-slate-700 bg-surface-900 text-slate-400',
                      )}
                    >
                      <span className="text-sm">{option.label}</span>
                      {option.value && <Check className="h-4 w-4 text-brand-400" />}
                    </button>
                  ))}
                </div>

                <div className="mt-4">
                  <label className="mb-2 block text-sm font-medium text-slate-300">
                    Mais realista ou mais chamativa?
                  </label>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {[
                      ['maintain', 'manter base'],
                      ['realistic', 'mais realista'],
                      ['punchier', 'mais chamativa'],
                    ].map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() =>
                          setReferenceOptions((current) => ({
                            ...current,
                            realismGoal: value as ReferenceOptionsState['realismGoal'],
                          }))
                        }
                        className={cn(
                          'rounded-2xl border px-4 py-3 text-sm transition-all',
                          referenceOptions.realismGoal === value
                            ? 'border-brand-500/60 bg-brand-500/10 text-slate-100'
                            : 'border-slate-700 bg-surface-900 text-slate-400',
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="glass-card p-5">
                <h2 className="text-xl font-semibold text-slate-100">Brief do template inteligente</h2>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  {TEMPLATE_TEXT_FIELDS.map(({ field, label, placeholder }) => (
                    <div key={field}>
                      <label className="mb-2 block text-sm font-medium text-slate-300">{label}</label>
                      <input
                        className="input"
                        value={templateInput[field]}
                        placeholder={placeholder}
                        onChange={(event) =>
                          setTemplateInput((current) => ({
                            ...current,
                            [field]: event.target.value,
                          }))
                        }
                      />
                    </div>
                  ))}
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-300">Texto</label>
                    <input
                      className="input"
                      value={templateInput.text ?? ''}
                      placeholder="Ex: CLUTCH INSANO"
                      onChange={(event) =>
                        setTemplateInput((current) => ({ ...current, text: event.target.value }))
                      }
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-300">Cor dominante</label>
                    <div className="grid grid-cols-3 gap-2">
                      {DOMINANT_COLORS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setTemplateInput((current) => ({ ...current, dominantColor: color }))}
                          className={cn(
                            'rounded-xl border px-3 py-2 text-sm transition-all',
                            templateInput.dominantColor === color
                              ? 'border-brand-500/60 bg-brand-500/10 text-slate-100'
                              : 'border-slate-700 bg-surface-900 text-slate-400',
                          )}
                        >
                          {color}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-4">
                  <label className="mb-2 block text-sm font-medium text-slate-300">Estilo da facecam</label>
                  <div className="grid gap-2 sm:grid-cols-4">
                    {FACECAM_STYLES.map((style) => (
                      <button
                        key={style}
                        type="button"
                        onClick={() => setTemplateInput((current) => ({ ...current, facecamStyle: style }))}
                        className={cn(
                          'rounded-xl border px-3 py-2 text-sm transition-all',
                          templateInput.facecamStyle === style
                            ? 'border-brand-500/60 bg-brand-500/10 text-slate-100'
                            : 'border-slate-700 bg-surface-900 text-slate-400',
                        )}
                      >
                        {style}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => void handleGenerateLayouts()}
                    disabled={isGeneratingLayouts}
                    className="btn-secondary flex items-center gap-2"
                  >
                    {isGeneratingLayouts ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    Gerar 4 layouts CTR
                  </button>
                </div>
              </div>

              <div className="glass-card p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-100">Layouts sugeridos</h2>
                    <p className="mt-1 text-sm text-slate-400">
                      Cada layout nasce com uma regra diferente de impacto, clareza e leitura.
                    </p>
                  </div>
                  {templateLayouts.length > 0 && (
                    <span className="badge badge-brand">{selectedLayoutIds.length} selecionado(s)</span>
                  )}
                </div>

                {templateLayouts.length > 0 ? (
                  <div className="grid gap-3 lg:grid-cols-2">
                    {templateLayouts.map((layout) => {
                      const selected = selectedLayoutIds.includes(layout.id);
                      return (
                        <button
                          key={layout.id}
                          type="button"
                          onClick={() =>
                            setSelectedLayoutIds((current) =>
                              current.includes(layout.id)
                                ? current.filter((id) => id !== layout.id)
                                : [...current, layout.id],
                            )
                          }
                          className={cn(
                            'rounded-2xl border p-4 text-left transition-all',
                            selected
                              ? 'border-brand-500/60 bg-brand-500/10'
                              : 'border-slate-700 bg-surface-900 hover:border-slate-600',
                          )}
                        >
                          <div className="mb-3 flex items-start justify-between gap-3">
                            <div>
                              <p className="text-xs uppercase tracking-wide text-brand-300">{layout.hook}</p>
                              <h3 className="mt-1 text-lg font-semibold text-slate-100">{layout.name}</h3>
                            </div>
                            <div className="rounded-full bg-surface-950 px-3 py-1 text-xs font-medium text-slate-200">
                              CTR {layout.score}
                            </div>
                          </div>

                          <p className="text-sm text-slate-400">{layout.description}</p>
                          <p className="mt-3 text-xs text-slate-500">{layout.ctrReasoning}</p>

                          <div className="mt-4 flex flex-wrap gap-2">
                            <span className="badge badge-neutral">{layout.compositionType}</span>
                            <span className="badge badge-neutral">texto {layout.textZone}</span>
                            <span className="badge badge-neutral">facecam {layout.facecamPosition}</span>
                            <span className="badge badge-neutral">{layout.recommendedVariantType}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-700 bg-surface-900 px-5 py-10 text-center text-sm text-slate-500">
                    Preencha o brief e gere os 4 layouts inteligentes.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <aside className="space-y-6">
          <div className="glass-card p-5">
            <h2 className="text-xl font-semibold text-slate-100">Diretiva extra</h2>
            <p className="mt-1 text-sm text-slate-400">
              Use uma observacao curta para ajustar geracao, sem substituir a estrutura planejada.
            </p>
            <textarea
              className="input mt-4 min-h-36 resize-none"
              value={freeTextPrompt}
              maxLength={500}
              placeholder="Ex: manter a leitura central livre, destacar mais a AK, evitar glow exagerado"
              onChange={(event) => setFreeTextPrompt(event.target.value)}
            />
            <p className="mt-2 text-right text-xs text-slate-500">{freeTextPrompt.length}/500</p>
          </div>

          <div className="glass-card p-5">
            <h2 className="text-xl font-semibold text-slate-100">Resumo do fluxo</h2>
            <div className="mt-4 space-y-3 text-sm text-slate-300">
              <div className="flex items-center justify-between rounded-xl bg-surface-900 px-4 py-3">
                <span>modo ativo</span>
                <span className="font-medium text-brand-300">{mode === 'reference' ? 'referencia' : 'template'}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-surface-900 px-4 py-3">
                <span>referencia enviada</span>
                <span>{referenceFile ? 'sim' : 'nao'}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-surface-900 px-4 py-3">
                <span>assets extras</span>
                <span>{files.filter((file) => file.fieldname === 'assets').length}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-surface-900 px-4 py-3">
                <span>layouts ativos</span>
                <span>{mode === 'template' ? selectedLayoutIds.length : 3}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-surface-900 px-4 py-3">
                <span>proximo passo</span>
                <span>editor IA</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void (mode === 'reference' ? handleSubmitReferenceMode() : handleSubmitTemplateMode())}
            disabled={isGenerating || (mode === 'reference' && !referenceFile)}
            className="btn-primary flex w-full items-center justify-center gap-2 py-4 text-base"
          >
            {isGenerating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Wand2 className="h-5 w-5" />}
            {mode === 'reference' ? 'Gerar a partir da referencia' : 'Gerar layouts selecionados'}
          </button>
        </aside>
      </section>
    </div>
  );
}
