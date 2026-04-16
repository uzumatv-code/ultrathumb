// =============================================================================
// ThumbForge AI — Editor Page
// 3-column professional editor:
//   LEFT  — upload, template, color, emotion, objects
//   CENTER — large preview + 6-variant grid
//   RIGHT  — semantic editor + sliders
// =============================================================================

import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { useDropzone } from 'react-dropzone';
import toast from 'react-hot-toast';
import {
  Upload, Wand2, Loader2, ChevronRight, Image, User, Package,
  Sparkles, X, Zap, Download, Lock, Send, History, RefreshCw,
  Smile, Palette, Eye, EyeOff, Check, ArrowRight,
} from 'lucide-react';
import {
  generationsApi,
  referenceAnalyzerApi,
  semanticEditorApi,
  exportsApi,
  downloadsApi,
} from '../../services/api.js';
import { cn } from '../../utils/cn.js';

// ─── Types ────────────────────────────────────────────────────────────────────

interface UploadedFile {
  file: File;
  preview: string;
  fieldname: string;
}

interface StyleConfig {
  text?: string;
  visualStyle?: string;
  glowIntensity?: number;
  glowColor?: string;
  textPosition?: string;
  fontColor?: string;
}

interface Variant {
  id: string;
  variantIndex: number;
  status: string;
  previewUrl: string | null;
  thumbnailUrl: string | null;
  templateAdherenceScore: number | null;
  textReadabilityScore: number | null;
  visualImpactScore: number | null;
  isPaid: boolean;
  revisedPrompt?: string | null; // stores variantType when typed
}

interface Generation {
  id: string;
  status: string;
  variants: Variant[];
  errorMessage: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

interface EditOperation {
  id: string;
  promptText: string;
  previewSummary: string;
  promptDelta: string[];
  status: string;
  resultGenerationId: string | null;
  createdAt: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const VARIANT_LABELS: Record<string, { label: string; color: string; description: string }> = {
  CONSERVADORA: { label: 'Conservadora', color: 'text-slate-300', description: 'Fiel à referência' },
  VIRAL:        { label: 'Viral',        color: 'text-yellow-400', description: 'Alta energia, CTR máximo' },
  CLEAN:        { label: 'Clean',        color: 'text-sky-400',    description: 'Minimalista, premium' },
  DRAMATICA:    { label: 'Dramática',    color: 'text-orange-400', description: 'Cinematográfica' },
  EXTREMA:      { label: 'Extrema',      color: 'text-red-400',    description: 'Caos visual máximo' },
  PREMIUM:      { label: 'Premium',      color: 'text-violet-400', description: 'Luxo e autoridade' },
};

const VISUAL_STYLES = [
  { value: 'gamer',       label: 'Gamer',     color: '#6366f1' },
  { value: 'high-energy', label: 'Energia',   color: '#f59e0b' },
  { value: 'cinematic',   label: 'Cinemático', color: '#64748b' },
  { value: 'clean',       label: 'Clean',     color: '#0ea5e9' },
  { value: 'dramatic',    label: 'Dramático', color: '#dc2626' },
  { value: 'minimal',     label: 'Minimal',   color: '#94a3b8' },
];

const EMOTIONS = [
  { value: 'shocked',    label: 'Chocado',    emoji: '😱' },
  { value: 'excited',    label: 'Animado',    emoji: '🤩' },
  { value: 'confident',  label: 'Confiante',  emoji: '😎' },
  { value: 'aggressive', label: 'Agressivo',  emoji: '😤' },
  { value: 'focused',    label: 'Focado',     emoji: '🎯' },
  { value: 'neutral',    label: 'Neutro',     emoji: '🙂' },
];

const GLOW_COLORS = ['#6366f1', '#ff4400', '#ffd700', '#00ff88', '#00bfff', '#ff00ff'];

const QUICK_EDITS = [
  'deixa mais clean',
  'rosto maior',
  'mais viral e agressivo',
  'troca o fundo',
  'mais glow e neon',
  'expressão mais chocada',
  'estilo premium',
  'menos poluído',
];

// ─── Sub-components ────────────────────────────────────────────────────────────

function UploadZone({
  label,
  fieldname,
  files,
  onAdd,
  onRemove,
  multiple = false,
  compact = false,
  icon: Icon = Upload,
}: {
  label: string;
  fieldname: string;
  files: UploadedFile[];
  onAdd: (f: UploadedFile[]) => void;
  onRemove: (fieldname: string) => void;
  multiple?: boolean;
  compact?: boolean;
  icon?: React.ElementType;
}) {
  const onDrop = useCallback(
    (accepted: File[]) => {
      onAdd(accepted.map((f) => ({ file: f, preview: URL.createObjectURL(f), fieldname })));
    },
    [fieldname, onAdd],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp'] },
    multiple,
    maxSize: 10 * 1024 * 1024,
  });

  const myFiles = files.filter((f) => f.fieldname === fieldname);

  if (myFiles.length > 0 && !multiple) {
    return (
      <div className="relative group">
        <img
          src={myFiles[0]!.preview}
          alt=""
          className={cn(
            'w-full object-cover rounded-xl border border-slate-700',
            compact ? 'h-14' : 'h-20',
          )}
        />
        <button
          onClick={() => onRemove(fieldname)}
          className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <X className="w-3 h-3 text-white" />
        </button>
        <div className="absolute bottom-1 left-1">
          <span className="text-[9px] bg-black/60 text-white rounded px-1 py-0.5">{label}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      {...getRootProps()}
      className={cn(
        'border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all',
        compact ? 'h-14 p-2' : 'h-20 p-3',
        isDragActive
          ? 'border-brand-500 bg-brand-500/5'
          : 'border-slate-700 hover:border-brand-500/50',
      )}
    >
      <input {...getInputProps()} />
      <Icon className={cn('text-slate-500', compact ? 'w-4 h-4' : 'w-5 h-5')} />
      <p className="text-[10px] text-slate-500 mt-0.5 text-center leading-tight">{label}</p>
      {myFiles.length > 0 && multiple && (
        <span className="text-[9px] text-brand-400">{myFiles.length} arquivo(s)</span>
      )}
    </div>
  );
}

function ScoreBar({ label, value }: { label: string; value: number | null }) {
  if (!value) return null;
  return (
    <div>
      <div className="flex justify-between text-[10px] mb-0.5">
        <span className="text-slate-500">{label}</span>
        <span className="text-slate-400">{value}%</span>
      </div>
      <div className="h-1 rounded-full bg-surface-700 overflow-hidden">
        <div
          className={cn('h-1 rounded-full transition-all', value >= 80 ? 'bg-emerald-500' : value >= 60 ? 'bg-amber-500' : 'bg-red-500')}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

// ─── Left panel ────────────────────────────────────────────────────────────────

function LeftPanel({
  files,
  styleConfig,
  emotion,
  selectedVariantTypes,
  onAddFiles,
  onRemoveFiles,
  onStyleChange,
  onEmotionChange,
  onVariantTypeToggle,
}: {
  files: UploadedFile[];
  styleConfig: StyleConfig;
  emotion: string;
  selectedVariantTypes: string[];
  onAddFiles: (f: UploadedFile[]) => void;
  onRemoveFiles: (fieldname: string) => void;
  onStyleChange: (patch: Partial<StyleConfig>) => void;
  onEmotionChange: (v: string) => void;
  onVariantTypeToggle: (vt: string) => void;
}) {
  return (
    <div className="flex flex-col gap-4 overflow-y-auto h-full pr-1">
      {/* Uploads */}
      <section>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Assets</p>
        <div className="grid grid-cols-2 gap-2">
          <UploadZone label="Referência *" fieldname="reference" files={files} onAdd={onAddFiles} onRemove={onRemoveFiles} icon={Image} />
          <UploadZone label="Pessoa" fieldname="person" files={files} onAdd={onAddFiles} onRemove={onRemoveFiles} icon={User} />
        </div>
        <div className="mt-2">
          <UploadZone label="Objetos (até 5)" fieldname="assets" files={files} onAdd={onAddFiles} onRemove={onRemoveFiles} multiple icon={Package} compact />
        </div>
      </section>

      {/* Visual Style */}
      <section>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Estilo Visual</p>
        <div className="grid grid-cols-3 gap-1.5">
          {VISUAL_STYLES.map((vs) => (
            <button
              key={vs.value}
              onClick={() => onStyleChange({ visualStyle: vs.value })}
              className={cn(
                'py-1.5 px-2 rounded-lg text-xs font-medium transition-all border',
                styleConfig.visualStyle === vs.value
                  ? 'border-brand-500/60 bg-brand-500/15 text-brand-300'
                  : 'border-slate-700 text-slate-400 hover:border-slate-600',
              )}
            >
              {vs.label}
            </button>
          ))}
        </div>
      </section>

      {/* Emotion */}
      <section>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <Smile className="w-3 h-3" /> Emoção do Rosto
        </p>
        <div className="grid grid-cols-3 gap-1.5">
          {EMOTIONS.map((em) => (
            <button
              key={em.value}
              onClick={() => onEmotionChange(em.value)}
              className={cn(
                'py-1.5 px-1 rounded-lg text-center transition-all border',
                emotion === em.value
                  ? 'border-brand-500/60 bg-brand-500/15'
                  : 'border-slate-700 hover:border-slate-600',
              )}
            >
              <div className="text-base">{em.emoji}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">{em.label}</div>
            </button>
          ))}
        </div>
      </section>

      {/* Glow Color */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Palette className="w-3 h-3" /> Glow
          </p>
          <span className="text-xs text-brand-400 font-mono">{styleConfig.glowIntensity ?? 60}%</span>
        </div>
        <input
          type="range" min={0} max={100}
          value={styleConfig.glowIntensity ?? 60}
          onChange={(e) => onStyleChange({ glowIntensity: parseInt(e.target.value) })}
          className="w-full accent-brand-500 mb-2"
        />
        <div className="flex gap-1.5">
          {GLOW_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => onStyleChange({ glowColor: c })}
              className={cn(
                'w-7 h-7 rounded-full border-2 transition-all',
                styleConfig.glowColor === c ? 'border-white scale-110' : 'border-transparent',
              )}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </section>

      {/* Variant Types */}
      <section>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Variações para Gerar</p>
        <div className="space-y-1">
          {Object.entries(VARIANT_LABELS).map(([vt, meta]) => (
            <button
              key={vt}
              onClick={() => onVariantTypeToggle(vt)}
              className={cn(
                'w-full flex items-center justify-between px-3 py-1.5 rounded-lg border text-xs transition-all',
                selectedVariantTypes.includes(vt)
                  ? 'border-brand-500/60 bg-brand-500/10'
                  : 'border-slate-700 hover:border-slate-600',
              )}
            >
              <div className="flex items-center gap-2">
                <div className={cn('w-1.5 h-1.5 rounded-full', selectedVariantTypes.includes(vt) ? 'bg-brand-400' : 'bg-slate-600')} />
                <span className={meta.color}>{meta.label}</span>
              </div>
              <span className="text-slate-600 text-[10px]">{meta.description}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Text */}
      <section>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Texto</p>
        <input
          type="text"
          placeholder="Texto da thumbnail (opcional)"
          value={styleConfig.text ?? ''}
          onChange={(e) => onStyleChange({ text: e.target.value })}
          className="input text-sm"
          maxLength={100}
        />
      </section>
    </div>
  );
}

// ─── Center panel ──────────────────────────────────────────────────────────────

function CenterPanel({
  generation,
  selectedVariantId,
  onSelectVariant,
  onDownload,
  downloadingId,
}: {
  generation: Generation | null | undefined;
  selectedVariantId: string | null;
  onSelectVariant: (id: string) => void;
  onDownload: (id: string) => void;
  downloadingId: string | null;
}) {
  const isProcessing = generation?.status === 'QUEUED' || generation?.status === 'PROCESSING';
  const selected = generation?.variants.find((v) => v.id === selectedVariantId);

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Main preview */}
      <div className="relative flex-1 min-h-0 bg-surface-900 rounded-2xl overflow-hidden border border-slate-800">
        {selected?.previewUrl ? (
          <>
            <img
              src={selected.previewUrl}
              alt="Preview"
              className="w-full h-full object-contain"
              draggable={false}
              onContextMenu={(e) => e.preventDefault()}
            />
            <div className="absolute inset-0 pointer-events-none" />
            {/* Variant type badge */}
            {selected.revisedPrompt && VARIANT_LABELS[selected.revisedPrompt] && (
              <div className="absolute top-3 left-3">
                <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full bg-black/60', VARIANT_LABELS[selected.revisedPrompt]!.color)}>
                  {VARIANT_LABELS[selected.revisedPrompt]!.label}
                </span>
              </div>
            )}
            {/* Score overlay */}
            {selected.visualImpactScore && (
              <div className="absolute bottom-3 right-3 bg-black/70 rounded-xl p-2 space-y-1 min-w-[130px]">
                <ScoreBar label="Impacto" value={selected.visualImpactScore} />
                <ScoreBar label="Legibilidade" value={selected.textReadabilityScore} />
                <ScoreBar label="Aderência" value={selected.templateAdherenceScore} />
              </div>
            )}
          </>
        ) : isProcessing ? (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <div className="relative">
              <div className="absolute inset-0 animate-ping rounded-full bg-brand-500/20" />
              <div className="relative w-16 h-16 flex items-center justify-center rounded-full bg-brand-500/20">
                <Zap className="w-7 h-7 text-brand-400" />
              </div>
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-slate-300">
                {generation?.status === 'QUEUED' ? 'Na fila...' : 'Gerando thumbnails...'}
              </p>
              <p className="text-xs text-slate-500 mt-1">Aguarde até 2 minutos</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-600">
            <Image className="w-12 h-12" />
            <p className="text-sm">Selecione uma variação abaixo</p>
          </div>
        )}
      </div>

      {/* Variant grid */}
      {generation?.variants && generation.variants.length > 0 && (
        <div className="grid grid-cols-3 gap-2 flex-shrink-0">
          {generation.variants.map((v) => (
            <button
              key={v.id}
              onClick={() => onSelectVariant(v.id)}
              className={cn(
                'relative rounded-xl overflow-hidden border-2 transition-all aspect-video',
                selectedVariantId === v.id
                  ? 'border-brand-500 shadow-glow-sm'
                  : 'border-slate-700 hover:border-slate-600',
              )}
            >
              {v.previewUrl ? (
                <>
                  <img src={v.previewUrl} alt="" className="w-full h-full object-cover" draggable={false} onContextMenu={(e) => e.preventDefault()} />
                  <div className="absolute inset-0 pointer-events-none" />
                </>
              ) : (
                <div className="flex items-center justify-center w-full h-full bg-surface-800">
                  <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
                </div>
              )}
              {/* Variant type label */}
              {v.revisedPrompt && VARIANT_LABELS[v.revisedPrompt] && (
                <div className="absolute bottom-0 inset-x-0 bg-black/60 py-0.5 px-1">
                  <span className={cn('text-[9px] font-medium', VARIANT_LABELS[v.revisedPrompt]!.color)}>
                    {VARIANT_LABELS[v.revisedPrompt]!.label}
                  </span>
                </div>
              )}
              {!v.revisedPrompt && (
                <div className="absolute top-1 left-1">
                  <span className="text-[9px] bg-black/60 text-slate-300 rounded px-1">#{v.variantIndex}</span>
                </div>
              )}
              {v.isPaid && (
                <div className="absolute top-1 right-1 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center">
                  <Check className="w-2.5 h-2.5 text-white" />
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Download row */}
      {selected && selected.isPaid && (
        <button
          onClick={() => onDownload(selected.id)}
          disabled={downloadingId === selected.id}
          className="btn-primary flex items-center justify-center gap-2 flex-shrink-0"
        >
          {downloadingId === selected.id ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          Baixar HD 1280×720
        </button>
      )}
      {selected && !selected.isPaid && (
        <div className="flex items-center justify-center gap-2 text-xs text-slate-500 flex-shrink-0">
          <Lock className="w-3.5 h-3.5" />
          Compre esta variação para baixar em HD
        </div>
      )}
    </div>
  );
}

// ─── Right panel ───────────────────────────────────────────────────────────────

function RightPanel({
  generation,
  selectedVariantId,
  onEditApplied,
}: {
  generation: Generation | null | undefined;
  selectedVariantId: string | null;
  onEditApplied: (newGenerationId: string) => void;
}) {
  const [editPrompt, setEditPrompt] = useState('');
  const [preserve, setPreserve] = useState<string[]>(['layout', 'lighting']);
  const [history, setHistory] = useState<EditOperation[]>([]);
  const [tab, setTab] = useState<'edit' | 'history'>('edit');
  const [draftDelta, setDraftDelta] = useState<string[]>([]);
  const queryClient = useQueryClient();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const PRESERVE_OPTIONS = ['layout', 'subject', 'background', 'lighting', 'palette', 'objects', 'text', 'style'];

  const commitMutation = useMutation({
    mutationFn: async () => {
      if (!generation?.id || !editPrompt.trim()) return;
      const commitPayload: { baseVariantId?: string; prompt: string; preserve?: string[] } = {
        prompt: editPrompt,
        preserve,
      };
      if (selectedVariantId) commitPayload.baseVariantId = selectedVariantId;
      const { data } = await semanticEditorApi.commit(generation.id, commitPayload);
      return data.data as EditOperation;
    },
    onSuccess: async (op) => {
      if (!op) return;
      const { data } = await semanticEditorApi.apply(op.id);
      toast.success('Edição enviada para processamento!');
      onEditApplied(data.data.newGenerationId as string);
      setEditPrompt('');
      setDraftDelta([]);
      void queryClient.invalidateQueries({ queryKey: ['generation', generation?.id] });
    },
    onError: () => toast.error('Erro ao aplicar edição'),
  });

  // Live draft preview as user types
  useEffect(() => {
    if (!generation?.id || !editPrompt.trim()) {
      setDraftDelta([]);
      return;
    }
    const timeout = window.setTimeout(async () => {
      try {
        const { data } = await semanticEditorApi.draft(generation.id, {
          prompt: editPrompt,
          preserve,
        });
        setDraftDelta((data.data as { promptDelta: string[] }).promptDelta ?? []);
      } catch {
        // ignore
      }
    }, 400);
    return () => clearTimeout(timeout);
  }, [editPrompt, preserve, generation?.id]);

  // Load history
  useEffect(() => {
    if (!generation?.id) return;
    void semanticEditorApi.getHistory(generation.id).then(({ data }) => {
      setHistory((data.data as EditOperation[]) ?? []);
    });
  }, [generation?.id]);

  const togglePreserve = (opt: string) => {
    setPreserve((prev) =>
      prev.includes(opt) ? prev.filter((p) => p !== opt) : [...prev, opt],
    );
  };

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Tab switcher */}
      <div className="flex bg-surface-800 rounded-xl p-1 gap-1 flex-shrink-0">
        {(['edit', 'history'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'flex-1 py-1.5 text-xs font-medium rounded-lg transition-all',
              tab === t ? 'bg-brand-500 text-white' : 'text-slate-400 hover:text-slate-300',
            )}
          >
            {t === 'edit' ? 'Editor Semântico' : 'Histórico'}
          </button>
        ))}
      </div>

      {tab === 'edit' && (
        <div className="flex flex-col gap-3 flex-1 overflow-y-auto">
          {/* Quick edits */}
          <div>
            <p className="text-xs text-slate-500 mb-1.5">Ações rápidas:</p>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_EDITS.map((qe) => (
                <button
                  key={qe}
                  onClick={() => setEditPrompt(qe)}
                  className="px-2 py-1 text-[10px] rounded-lg bg-surface-800 border border-slate-700 text-slate-400 hover:border-brand-500/50 hover:text-brand-400 transition-all"
                >
                  {qe}
                </button>
              ))}
            </div>
          </div>

          {/* Command input */}
          <div>
            <p className="text-xs text-slate-500 mb-1.5">Comando:</p>
            <div className="relative">
              <textarea
                ref={textareaRef}
                className="input resize-none text-sm min-h-[80px] pr-10"
                placeholder={'Ex: "deixa o rosto maior e mais expressivo"\n"troca o fundo por algo mais escuro"\n"menos poluído, estilo clean premium"'}
                value={editPrompt}
                onChange={(e) => setEditPrompt(e.target.value)}
                maxLength={500}
              />
              <button
                onClick={() => void commitMutation.mutate()}
                disabled={!editPrompt.trim() || commitMutation.isPending || !generation || generation.status !== 'COMPLETED'}
                className="absolute bottom-2 right-2 w-7 h-7 bg-brand-500 rounded-lg flex items-center justify-center disabled:opacity-40 transition-opacity hover:bg-brand-600"
              >
                {commitMutation.isPending
                  ? <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
                  : <Send className="w-3.5 h-3.5 text-white" />
                }
              </button>
            </div>
          </div>

          {/* Live delta preview */}
          <AnimatePresence>
            {draftDelta.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="bg-brand-500/10 border border-brand-500/30 rounded-xl p-3"
              >
                <p className="text-xs font-semibold text-brand-400 mb-1.5 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Mudanças detectadas:
                </p>
                <ul className="space-y-0.5">
                  {draftDelta.map((d, i) => (
                    <li key={i} className="flex items-center gap-1.5 text-xs text-slate-300">
                      <ArrowRight className="w-3 h-3 text-brand-500 flex-shrink-0" />
                      {d}
                    </li>
                  ))}
                </ul>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Preserve options */}
          <div>
            <p className="text-xs text-slate-500 mb-1.5">Preservar durante a edição:</p>
            <div className="flex flex-wrap gap-1.5">
              {PRESERVE_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  onClick={() => togglePreserve(opt)}
                  className={cn(
                    'px-2 py-0.5 text-[10px] rounded-lg border transition-all',
                    preserve.includes(opt)
                      ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-400'
                      : 'bg-surface-800 border-slate-700 text-slate-500',
                  )}
                >
                  {preserve.includes(opt) ? '✓ ' : ''}{opt}
                </button>
              ))}
            </div>
          </div>

          {/* Post-processing sliders */}
          <div className="border-t border-slate-800 pt-3">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Pós-processamento</p>
            <PostProcessingSliders generation={generation} selectedVariantId={selectedVariantId} />
          </div>
        </div>
      )}

      {tab === 'history' && (
        <div className="flex-1 overflow-y-auto space-y-2">
          {history.length === 0 ? (
            <div className="text-center py-8 text-slate-600 text-sm">
              Nenhuma edição semântica ainda.
            </div>
          ) : (
            history.map((op) => (
              <div key={op.id} className="bg-surface-800 rounded-xl p-3 border border-slate-700">
                <div className="flex items-center justify-between mb-1">
                  <span className={cn(
                    'text-[10px] font-medium px-1.5 py-0.5 rounded',
                    op.status === 'COMPLETED' ? 'bg-emerald-500/20 text-emerald-400' :
                    op.status === 'PROCESSING' ? 'bg-amber-500/20 text-amber-400' :
                    op.status === 'FAILED' ? 'bg-red-500/20 text-red-400' :
                    'bg-slate-700 text-slate-400',
                  )}>
                    {op.status}
                  </span>
                  <span className="text-[10px] text-slate-600">
                    {new Date(op.createdAt).toLocaleTimeString('pt-BR')}
                  </span>
                </div>
                <p className="text-xs text-slate-300 font-medium mb-1">"{op.promptText}"</p>
                <p className="text-[10px] text-slate-500">{op.previewSummary}</p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function PostProcessingSliders({
  generation,
  selectedVariantId,
}: {
  generation: Generation | null | undefined;
  selectedVariantId: string | null;
}) {
  const [options, setOptions] = useState({
    sharpenSigma:  0.8,
    contrastBoost: true,
    faceEnhance:   true,
    upscale:       true,
  });
  const [exporting, setExporting] = useState(false);
  const [exportDone, setExportDone] = useState(false);

  const handleExport = async () => {
    if (!selectedVariantId) return;
    setExporting(true);
    try {
      const { data } = await exportsApi.create(selectedVariantId, {
        ...options,
        targetWidth:  1280,
        targetHeight: 720,
        format:       'webp',
        quality:      92,
        sharpen:      true,
      });
      toast.success('Processamento iniciado — pronto em instantes!');
      setExportDone(true);
      // Poll for completion
      const jobId = (data.data as { id: string }).id;
      const poll = setInterval(async () => {
        const { data: statusData } = await exportsApi.get(jobId);
        const job = statusData.data as { status: string; outputUrl?: string };
        if (job.status === 'COMPLETED') {
          clearInterval(poll);
          if (job.outputUrl) {
            const a = document.createElement('a');
            a.href = job.outputUrl;
            a.download = 'thumbnail-hd.webp';
            a.click();
          }
          toast.success('Export HD concluído!');
        } else if (job.status === 'FAILED') {
          clearInterval(poll);
          toast.error('Export falhou');
        }
      }, 1500);
    } catch {
      toast.error('Erro ao iniciar export');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <div className="flex justify-between text-xs mb-1">
          <span className="text-slate-400">Sharpen</span>
          <span className="text-brand-400 font-mono">{options.sharpenSigma.toFixed(1)}</span>
        </div>
        <input
          type="range" min={0.3} max={3.0} step={0.1}
          value={options.sharpenSigma}
          onChange={(e) => setOptions((o) => ({ ...o, sharpenSigma: parseFloat(e.target.value) }))}
          className="w-full accent-brand-500"
        />
      </div>

      <div className="flex gap-2">
        {([
          { key: 'contrastBoost', label: 'Contraste' },
          { key: 'faceEnhance',   label: 'Rosto HD' },
          { key: 'upscale',       label: 'Upscale' },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setOptions((o) => ({ ...o, [key]: !o[key] }))}
            className={cn(
              'flex-1 py-1 text-[10px] rounded-lg border transition-all',
              options[key]
                ? 'bg-brand-500/15 border-brand-500/50 text-brand-300'
                : 'bg-surface-900 border-slate-700 text-slate-500',
            )}
          >
            {options[key] ? '✓ ' : ''}{label}
          </button>
        ))}
      </div>

      <button
        onClick={() => void handleExport()}
        disabled={exporting || !selectedVariantId}
        className="btn-primary w-full flex items-center justify-center gap-2 text-sm"
      >
        {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
        Exportar 1280×720 HD
      </button>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function EditorPage() {
  const { generationId } = useParams<{ generationId?: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Editor state
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [styleConfig, setStyleConfig] = useState<StyleConfig>({
    visualStyle: 'gamer',
    glowIntensity: 60,
    glowColor: '#6366f1',
    textPosition: 'bottom-center',
    fontColor: '#ffffff',
  });
  const [emotion, setEmotion] = useState('shocked');
  const [selectedVariantTypes, setSelectedVariantTypes] = useState<string[]>(['VIRAL', 'CLEAN', 'DRAMATICA']);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Load generation if generationId provided
  const { data: generation, isLoading } = useQuery<Generation>({
    queryKey: ['generation', generationId],
    queryFn: () => generationsApi.get(generationId!).then((r) => r.data.data as Generation),
    refetchInterval: (query) => {
      const status = (query.state.data as Generation | undefined)?.status;
      return status === 'QUEUED' || status === 'PROCESSING' ? 2000 : false;
    },
    enabled: !!generationId,
  });

  // Auto-select first variant when generation completes
  useEffect(() => {
    if (generation?.variants.length && !selectedVariantId) {
      setSelectedVariantId(generation.variants[0]!.id);
    }
  }, [generation?.variants, selectedVariantId]);

  const addFiles = useCallback((newFiles: UploadedFile[]) => {
    setFiles((prev) => {
      // For single-file fields, replace existing
      const nonOverlapping = prev.filter(
        (f) => !['reference', 'person'].includes(f.fieldname) ||
               !newFiles.some((nf) => nf.fieldname === f.fieldname),
      );
      return [...nonOverlapping, ...newFiles];
    });
  }, []);

  const removeFiles = useCallback((fieldname: string) => {
    setFiles((prev) => {
      const removed = prev.filter((f) => f.fieldname !== fieldname);
      prev.filter((f) => f.fieldname === fieldname).forEach((f) => URL.revokeObjectURL(f.preview));
      return removed;
    });
  }, []);

  const handleGenerate = async () => {
    if (!files.some((f) => f.fieldname === 'reference')) {
      toast.error('Adicione uma imagem de referência');
      return;
    }

    setGenerating(true);
    try {
      const formData = new FormData();
      formData.append('styleConfig', JSON.stringify({
        ...styleConfig,
        emotion,
      }));
      if (selectedVariantTypes.length) {
        formData.append('variantTypes', JSON.stringify(selectedVariantTypes));
      }

      for (const f of files) {
        formData.append(f.fieldname, f.file, f.file.name);
      }

      const { data } = await generationsApi.create(formData);
      toast.success('Geração iniciada!');
      navigate(`/editor/${(data.data as { id: string }).id}`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? 'Erro ao gerar';
      toast.error(msg);
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async (variantId: string) => {
    setDownloadingId(variantId);
    try {
      const { data } = await downloadsApi.request(variantId);
      const a = document.createElement('a');
      a.href = (data.data as { downloadUrl: string }).downloadUrl;
      a.download = 'thumbnail.webp';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success('Download iniciado.');
    } catch {
      toast.error('Erro ao baixar');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleEditApplied = (newGenerationId: string) => {
    navigate(`/editor/${newGenerationId}`);
    void queryClient.invalidateQueries({ queryKey: ['generation', newGenerationId] });
  };

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800 flex-shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-display font-bold text-slate-100">Editor</h1>
          {generation && (
            <span className={cn(
              'text-xs px-2 py-0.5 rounded-full font-medium',
              generation.status === 'COMPLETED' ? 'bg-emerald-500/20 text-emerald-400' :
              generation.status === 'PROCESSING' ? 'bg-amber-500/20 text-amber-400 animate-pulse' :
              generation.status === 'FAILED' ? 'bg-red-500/20 text-red-400' :
              'bg-slate-700 text-slate-400',
            )}>
              {generation.status}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {generation?.id && (
            <button
              onClick={() => navigate(`/generate/${generation.id}/results`)}
              className="btn-secondary text-sm flex items-center gap-1.5"
            >
              <Eye className="w-3.5 h-3.5" /> Resultados
            </button>
          )}
          <button
            onClick={() => void handleGenerate()}
            disabled={generating || isLoading}
            className="btn-primary flex items-center gap-2"
          >
            {generating
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Gerando...</>
              : <><Wand2 className="w-4 h-4" /> {generationId ? 'Nova Geração' : 'Gerar'}</>
            }
          </button>
        </div>
      </div>

      {/* 3-column layout */}
      <div className="flex-1 flex gap-0 min-h-0 overflow-hidden">
        {/* LEFT — 280px */}
        <div className="w-[280px] flex-shrink-0 border-r border-slate-800 p-4 overflow-hidden">
          <LeftPanel
            files={files}
            styleConfig={styleConfig}
            emotion={emotion}
            selectedVariantTypes={selectedVariantTypes}
            onAddFiles={addFiles}
            onRemoveFiles={removeFiles}
            onStyleChange={(patch) => setStyleConfig((s) => ({ ...s, ...patch }))}
            onEmotionChange={setEmotion}
            onVariantTypeToggle={(vt) =>
              setSelectedVariantTypes((prev) =>
                prev.includes(vt) ? prev.filter((v) => v !== vt) : [...prev, vt],
              )
            }
          />
        </div>

        {/* CENTER — flex */}
        <div className="flex-1 p-4 overflow-hidden min-w-0">
          <CenterPanel
            generation={generation}
            selectedVariantId={selectedVariantId}
            onSelectVariant={setSelectedVariantId}
            onDownload={handleDownload}
            downloadingId={downloadingId}
          />
        </div>

        {/* RIGHT — 300px */}
        <div className="w-[300px] flex-shrink-0 border-l border-slate-800 p-4 overflow-hidden">
          <RightPanel
            generation={generation ?? null}
            selectedVariantId={selectedVariantId}
            onEditApplied={handleEditApplied}
          />
        </div>
      </div>
    </div>
  );
}
