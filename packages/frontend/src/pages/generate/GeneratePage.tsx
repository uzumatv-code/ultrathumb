// =============================================================================
// ThumbForge AI — Generate Page (Multi-step form)
// =============================================================================

import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload, Wand2, Loader2, ChevronRight, ChevronLeft,
  Image, User, Package, Type, Palette, Sparkles, X
} from 'lucide-react';
import { generationsApi } from '../../services/api.js';
import { cn } from '../../utils/cn.js';
import toast from 'react-hot-toast';

interface UploadedFile {
  file: File;
  preview: string;
  fieldname: string;
}

interface StyleConfig {
  text?: string;
  fontFamily?: string;
  fontColor?: string;
  glowIntensity?: number;
  glowColor?: string;
  visualStyle?: string;
  textPosition?: string;
}

const STEPS = [
  { id: 1, label: 'Referência', icon: Image, description: 'Thumbnail modelo' },
  { id: 2, label: 'Assets', icon: Package, description: 'Fotos e elementos' },
  { id: 3, label: 'Texto & Estilo', icon: Type, description: 'Personalização visual' },
  { id: 4, label: 'Instruções', icon: Sparkles, description: 'Prompt livre' },
];

const VISUAL_STYLES = [
  { value: 'gamer', label: 'Gamer', emoji: '🎮' },
  { value: 'high-energy', label: 'Alta Energia', emoji: '⚡' },
  { value: 'cinematic', label: 'Cinemático', emoji: '🎬' },
  { value: 'clean', label: 'Clean', emoji: '✨' },
  { value: 'minimal', label: 'Minimal', emoji: '◽' },
  { value: 'dramatic', label: 'Dramático', emoji: '💥' },
];

const GLOW_COLORS = ['#ff4400', '#ffd700', '#00ff88', '#00bfff', '#ff00ff', '#ffffff'];

function DropZone({
  label,
  description,
  fieldname,
  files,
  onAdd,
  onRemove,
  multiple = false,
  icon: Icon = Upload,
}: {
  label: string;
  description: string;
  fieldname: string;
  files: UploadedFile[];
  onAdd: (files: UploadedFile[]) => void;
  onRemove: (index: number, fieldname: string) => void;
  multiple?: boolean;
  icon?: React.ElementType;
}) {
  const onDrop = useCallback(
    (accepted: File[]) => {
      const newFiles = accepted.map((file) => ({
        file,
        preview: URL.createObjectURL(file),
        fieldname,
      }));
      onAdd(newFiles);
    },
    [fieldname, onAdd],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp'] },
    multiple,
    maxSize: 10 * 1024 * 1024,
  });

  const fieldFiles = files.filter((f) => f.fieldname === fieldname);

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium text-slate-200">{label}</p>
        <p className="text-xs text-slate-500 mt-0.5">{description}</p>
      </div>

      {fieldFiles.length > 0 ? (
        <div className="flex flex-wrap gap-3">
          {fieldFiles.map((f, i) => (
            <div key={i} className="relative group">
              <img
                src={f.preview}
                alt=""
                className="w-24 h-16 object-cover rounded-xl border border-slate-700"
              />
              <button
                onClick={() => onRemove(files.indexOf(f), fieldname)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3 text-white" />
              </button>
            </div>
          ))}
          {multiple && (
            <div
              {...getRootProps()}
              className="w-24 h-16 border-2 border-dashed border-slate-600 hover:border-brand-500 rounded-xl flex items-center justify-center cursor-pointer transition-colors"
            >
              <input {...getInputProps()} />
              <Upload className="w-4 h-4 text-slate-500" />
            </div>
          )}
        </div>
      ) : (
        <div
          {...getRootProps()}
          className={cn(
            'border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-200',
            isDragActive
              ? 'border-brand-500 bg-brand-500/5'
              : 'border-slate-700 hover:border-brand-500/50 hover:bg-surface-800/50',
          )}
        >
          <input {...getInputProps()} />
          <Icon className="w-8 h-8 text-slate-500 mx-auto mb-2" />
          <p className="text-sm text-slate-400">
            {isDragActive ? 'Solte aqui' : 'Arraste ou clique para selecionar'}
          </p>
          <p className="text-xs text-slate-600 mt-1">PNG, JPG, WEBP — máx. 10MB</p>
        </div>
      )}
    </div>
  );
}

export function GeneratePage() {
  const [step, setStep] = useState(1);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [styleConfig, setStyleConfig] = useState<StyleConfig>({
    visualStyle: 'gamer',
    glowIntensity: 60,
    glowColor: '#6366f1',
    textPosition: 'bottom-center',
    fontColor: '#ffffff',
  });
  const [freeTextPrompt, setFreeTextPrompt] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const addFiles = useCallback((newFiles: UploadedFile[]) => {
    setFiles((prev) => [...prev, ...newFiles]);
  }, []);

  const removeFile = useCallback((index: number) => {
    setFiles((prev) => {
      const updated = [...prev];
      URL.revokeObjectURL(prev[index]?.preview ?? '');
      updated.splice(index, 1);
      return updated;
    });
  }, []);

  const handleGenerate = async () => {
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('styleConfig', JSON.stringify(styleConfig));
      if (freeTextPrompt) formData.append('freeTextPrompt', freeTextPrompt);
      if (templateId) formData.append('templateId', templateId);

      for (const f of files) {
        formData.append(f.fieldname, f.file, f.file.name);
      }

      const { data } = await generationsApi.create(formData);
      toast.success('Geração iniciada! Aguarde alguns instantes...');
      navigate(`/generate/${data.data.id}/results`);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ??
        'Erro ao iniciar geração';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const canProceed = () => {
    if (step === 1) return files.some((f) => f.fieldname === 'reference');
    if (step === 2) return true; // Assets are optional
    if (step === 3) return true; // Style has defaults
    return true;
  };

  return (
    <div className="page-container py-8 max-w-3xl animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold text-slate-100">Nova Thumbnail</h1>
        <p className="text-slate-400 mt-1">
          Configure os elementos e gere 3 opções profissionais com IA
        </p>
      </div>

      {/* Stepper */}
      <div className="flex items-center mb-8">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center flex-1">
            <button
              onClick={() => step > s.id && setStep(s.id)}
              className={cn(
                'flex flex-col items-center gap-1.5 flex-shrink-0 transition-all',
                step > s.id ? 'cursor-pointer' : 'cursor-default',
              )}
            >
              <div
                className={cn(
                  'w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all',
                  step === s.id
                    ? 'bg-brand-500 border-brand-500 shadow-glow-sm'
                    : step > s.id
                    ? 'bg-brand-500/20 border-brand-500/50 text-brand-400'
                    : 'bg-surface-800 border-slate-700 text-slate-500',
                )}
              >
                <s.icon className="w-4 h-4 text-white" />
              </div>
              <span
                className={cn(
                  'text-xs font-medium hidden sm:block',
                  step === s.id ? 'text-brand-400' : 'text-slate-500',
                )}
              >
                {s.label}
              </span>
            </button>
            {i < STEPS.length - 1 && (
              <div
                className={cn(
                  'flex-1 h-0.5 mx-3 rounded transition-all',
                  step > s.id ? 'bg-brand-500/50' : 'bg-slate-700',
                )}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
        >
          <div className="glass-card p-6 space-y-6">
            {/* Step 1: Reference */}
            {step === 1 && (
              <>
                <div>
                  <h2 className="section-title">Thumbnail de referência</h2>
                  <p className="section-subtitle">
                    Esta é a thumb que a IA vai analisar e usar como base para o estilo visual.
                  </p>
                </div>
                <DropZone
                  label="Imagem de referência *"
                  description="A thumbnail que define o padrão visual que você quer manter"
                  fieldname="reference"
                  files={files}
                  onAdd={addFiles}
                  onRemove={removeFile}
                  icon={Image}
                />
              </>
            )}

            {/* Step 2: Assets */}
            {step === 2 && (
              <>
                <div>
                  <h2 className="section-title">Elementos visuais</h2>
                  <p className="section-subtitle">
                    Adicione os elementos que devem aparecer na thumbnail (tudo opcional).
                  </p>
                </div>
                <DropZone
                  label="Foto da pessoa"
                  description="Sua foto ou do personagem principal"
                  fieldname="person"
                  files={files}
                  onAdd={addFiles}
                  onRemove={removeFile}
                  icon={User}
                />
                <DropZone
                  label="Objetos e itens (até 5)"
                  description="Armas, acessórios, logos, badges, ícones..."
                  fieldname="assets"
                  files={files}
                  onAdd={addFiles}
                  onRemove={removeFile}
                  multiple
                  icon={Package}
                />
              </>
            )}

            {/* Step 3: Style */}
            {step === 3 && (
              <>
                <div>
                  <h2 className="section-title">Texto & Estilo visual</h2>
                  <p className="section-subtitle">
                    Configure a aparência da sua thumbnail.
                  </p>
                </div>

                {/* Text */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    Texto da thumbnail
                  </label>
                  <input
                    type="text"
                    className="input"
                    placeholder="Ex: NOVA TEMPORADA, EP 47, COMO EU FIZ..."
                    value={styleConfig.text ?? ''}
                    onChange={(e) => setStyleConfig((s) => ({ ...s, text: e.target.value }))}
                    maxLength={100}
                  />
                </div>

                {/* Visual Style */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Estilo visual
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {VISUAL_STYLES.map((vs) => (
                      <button
                        key={vs.value}
                        onClick={() => setStyleConfig((s) => ({ ...s, visualStyle: vs.value }))}
                        className={cn(
                          'p-3 rounded-xl border text-sm font-medium transition-all',
                          styleConfig.visualStyle === vs.value
                            ? 'bg-brand-500/15 border-brand-500/50 text-brand-300'
                            : 'bg-surface-800 border-slate-700 text-slate-400 hover:border-slate-600',
                        )}
                      >
                        <span className="text-lg">{vs.emoji}</span>
                        <p>{vs.label}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Glow Intensity */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-slate-300">
                      Intensidade do glow
                    </label>
                    <span className="text-sm text-brand-400 font-mono">
                      {styleConfig.glowIntensity ?? 60}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={styleConfig.glowIntensity ?? 60}
                    onChange={(e) => setStyleConfig((s) => ({ ...s, glowIntensity: parseInt(e.target.value) }))}
                    className="w-full accent-brand-500"
                  />
                  <div className="flex justify-between text-xs text-slate-600 mt-1">
                    <span>Sem glow</span>
                    <span>Máximo</span>
                  </div>
                </div>

                {/* Glow Color */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Cor do glow
                  </label>
                  <div className="flex items-center gap-2">
                    {GLOW_COLORS.map((color) => (
                      <button
                        key={color}
                        onClick={() => setStyleConfig((s) => ({ ...s, glowColor: color }))}
                        className={cn(
                          'w-8 h-8 rounded-full border-2 transition-all',
                          styleConfig.glowColor === color
                            ? 'border-white scale-110'
                            : 'border-transparent hover:scale-105',
                        )}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Step 4: Prompt */}
            {step === 4 && (
              <>
                <div>
                  <h2 className="section-title">Instruções extras</h2>
                  <p className="section-subtitle">
                    Descreva em linguagem natural o que você quer. A IA vai interpretar e criar.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    Prompt livre (opcional)
                  </label>
                  <textarea
                    className="input resize-none min-h-[140px]"
                    placeholder={'Exemplos:\n"Faça voando em uma nave espacial"\n"Estilo thumbnail de jogo mobile com muito brilho"\n"Mantenha o padrão visual da referência mas adicione explosões"'}
                    value={freeTextPrompt}
                    onChange={(e) => setFreeTextPrompt(e.target.value)}
                    maxLength={500}
                  />
                  <p className="text-xs text-slate-500 mt-1.5 text-right">
                    {freeTextPrompt.length}/500
                  </p>
                </div>

                {/* Summary */}
                <div className="bg-surface-800 rounded-xl p-4 space-y-2">
                  <p className="text-sm font-medium text-slate-300">Resumo da geração:</p>
                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-400">
                    <div>Referência: <span className="text-slate-200">{files.filter(f => f.fieldname === 'reference').length > 0 ? '✓' : '—'}</span></div>
                    <div>Pessoa: <span className="text-slate-200">{files.filter(f => f.fieldname === 'person').length > 0 ? '✓' : '—'}</span></div>
                    <div>Objetos: <span className="text-slate-200">{files.filter(f => f.fieldname === 'assets').length} arquivo(s)</span></div>
                    <div>Estilo: <span className="text-slate-200">{styleConfig.visualStyle}</span></div>
                    <div>Glow: <span className="text-slate-200">{styleConfig.glowIntensity}%</span></div>
                    <div>Variações: <span className="text-brand-400 font-medium">3 thumbnails</span></div>
                  </div>
                </div>
              </>
            )}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-6">
        <button
          onClick={() => setStep((s) => s - 1)}
          disabled={step === 1}
          className="btn-secondary flex items-center gap-2 disabled:opacity-40"
        >
          <ChevronLeft className="w-4 h-4" />
          Anterior
        </button>

        {step < STEPS.length ? (
          <button
            onClick={() => setStep((s) => s + 1)}
            disabled={!canProceed()}
            className="btn-primary flex items-center gap-2"
          >
            Próximo
            <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="btn-primary flex items-center gap-2 min-w-[180px] justify-center"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Gerando...
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4" />
                Gerar 3 thumbnails
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
