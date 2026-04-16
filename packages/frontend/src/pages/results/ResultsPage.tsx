// =============================================================================
// ThumbForge AI - Results Page (Preview + Payment)
// =============================================================================

import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  CheckCircle,
  Clock,
  Download,
  Loader2,
  Lock,
  Package,
  RefreshCw,
  ShoppingCart,
  Star,
  Zap,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';
import { downloadsApi, generationsApi, paymentsApi } from '../../services/api.js';
import { cn } from '../../utils/cn.js';

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
}

interface Generation {
  id: string;
  status: string;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
  variants: Variant[];
}

interface Payment {
  paymentId: string;
  pixQrCode: string | null;
  pixQrCodeText: string | null;
  pixExpiresAt: string;
  amountCents: number;
  status: string;
}

function ScoreBar({ label, value }: { label: string; value: number | null }) {
  if (!value) return null;

  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-slate-400">{label}</span>
        <span className="font-medium text-slate-300">{value}%</span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-surface-700">
        <div
          className={cn(
            'h-1 rounded-full',
            value >= 80 ? 'bg-emerald-500' : value >= 60 ? 'bg-amber-500' : 'bg-red-500',
          )}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

function formatElapsed(elapsedMs: number) {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function ResultsPage() {
  const { generationId } = useParams<{ generationId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [selectedVariants, setSelectedVariants] = useState<string[]>([]);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  const { data: generation, isLoading } = useQuery<Generation>({
    queryKey: ['generation', generationId],
    queryFn: () =>
      generationsApi.get(generationId!).then((response) => response.data.data as Generation),
    refetchInterval: (query) => {
      const status = (query.state.data as Generation | undefined)?.status;
      return status === 'QUEUED' || status === 'PROCESSING' ? 2000 : false;
    },
    enabled: !!generationId,
  });

  useEffect(() => {
    if (!generationId) return;

    const socket = io('/', { path: '/socket.io' });
    socket.emit('join', `generation:${generationId}`);
    socket.on('generation:update', (data: { generationId: string }) => {
      if (data.generationId === generationId) {
        void queryClient.invalidateQueries({ queryKey: ['generation', generationId] });
      }
    });
    socket.on('payment:update', () => {
      void queryClient.invalidateQueries({ queryKey: ['generation', generationId] });
    });

    return () => {
      socket.disconnect();
    };
  }, [generationId, queryClient]);

  useEffect(() => {
    if (!generation) return;
    if (generation.status !== 'QUEUED' && generation.status !== 'PROCESSING') return;

    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, [generation]);

  const toggleVariant = (id: string) => {
    setSelectedVariants((previous) =>
      previous.includes(id) ? previous.filter((variantId) => variantId !== id) : [...previous, id],
    );
  };

  const selectAll = () => {
    const unpaidVariantIds =
      generation?.variants.filter((variant) => !variant.isPaid).map((variant) => variant.id) ?? [];
    setSelectedVariants(unpaidVariantIds);
  };

  const isCombo = selectedVariants.length === 3;
  const priceLabel = isCombo
    ? 'R$ 40,00'
    : `R$ ${(selectedVariants.length * 19.9).toFixed(2).replace('.', ',')}`;
  const isProcessing = generation?.status === 'QUEUED' || generation?.status === 'PROCESSING';
  const isFailed = generation?.status === 'FAILED';

  const processingElapsedMs = useMemo(() => {
    if (!generation) return 0;
    const baseline = generation.startedAt ?? generation.createdAt;
    return Math.max(0, now - new Date(baseline).getTime());
  }, [generation, now]);

  const isDelayed = processingElapsedMs >= 120000;

  const handlePay = async () => {
    if (!selectedVariants.length) return;

    setPaymentLoading(true);
    try {
      const { data } = await paymentsApi.create({
        type: isCombo ? 'COMBO_VARIANTS' : 'SINGLE_VARIANT',
        variantIds: isCombo ? selectedVariants : [selectedVariants[0]!],
      });
      setPayment(data.data as Payment);
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ??
        'Erro ao criar pagamento';
      toast.error(message);
    } finally {
      setPaymentLoading(false);
    }
  };

  const handleDownload = async (variantId: string) => {
    setDownloadingId(variantId);

    try {
      const { data } = await downloadsApi.request(variantId);
      const anchor = document.createElement('a');
      anchor.href = data.data.downloadUrl;
      anchor.download = 'thumbnail.webp';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      toast.success('Download iniciado.');
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ??
        'Erro ao baixar';
      toast.error(message);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleCancelGeneration = async () => {
    if (!generationId) return;

    try {
      await generationsApi.cancel(generationId);
      toast.success('Geracao cancelada.');
      navigate('/generate');
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ??
        'Nao foi possivel cancelar a geracao';
      toast.error(message);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="space-y-4 text-center">
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-brand-400" />
          <p className="text-slate-400">Carregando resultados...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container animate-fade-in space-y-6 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-slate-100">Resultados</h1>
          <p className="mt-1 text-slate-400">
            {isProcessing ? 'Gerando suas thumbnails...' : 'Escolha e baixe as que voce mais gostou'}
          </p>
        </div>
        {generation?.status === 'COMPLETED' && (
          <button
            onClick={() => navigate('/generate')}
            className="btn-secondary flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Nova geracao
          </button>
        )}
      </div>

      {isProcessing && (
        <div className="glass-card space-y-6 p-12 text-center">
          <div className="relative mx-auto h-20 w-20">
            <div className="absolute inset-0 animate-ping rounded-full bg-brand-500/20" />
            <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-brand-500/30">
              <Zap className="h-8 w-8 text-brand-400" />
            </div>
          </div>

          <div>
            <h3 className="text-xl font-display font-bold text-slate-100">
              {generation?.status === 'QUEUED' ? 'Na fila de geracao...' : 'Criando suas thumbnails...'}
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-400">
              A IA esta analisando sua referencia e gerando 3 opcoes personalizadas. Isso pode levar ate 2 minutos.
            </p>
            <p className="mt-3 text-xs text-slate-500">
              Tempo decorrido: {formatElapsed(processingElapsedMs)}
            </p>
          </div>

          <div className="flex items-center justify-center gap-2">
            <div
              className="h-2 w-2 animate-bounce rounded-full bg-brand-400"
              style={{ animationDelay: '0ms' }}
            />
            <div
              className="h-2 w-2 animate-bounce rounded-full bg-brand-400"
              style={{ animationDelay: '150ms' }}
            />
            <div
              className="h-2 w-2 animate-bounce rounded-full bg-brand-400"
              style={{ animationDelay: '300ms' }}
            />
          </div>

          {isDelayed && (
            <div className="mx-auto max-w-xl rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-left">
              <p className="text-sm font-medium text-amber-300">
                A geracao esta demorando mais do que o esperado.
              </p>
              <p className="mt-2 text-sm text-slate-300">
                Isso costuma acontecer quando o worker da fila nao esta ativo ou quando o job falhou em segundo plano.
                Voce pode atualizar o status ou cancelar e tentar de novo.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  onClick={() => {
                    void queryClient.invalidateQueries({ queryKey: ['generation', generationId] });
                  }}
                  className="btn-secondary text-sm"
                >
                  Atualizar status
                </button>
                <button
                  onClick={() => {
                    void handleCancelGeneration();
                  }}
                  className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-300 transition-colors hover:bg-red-500/20"
                >
                  Cancelar geracao
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {isFailed && (
        <div className="glass-card space-y-5 p-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/15 text-red-300">
            <RefreshCw className="h-7 w-7" />
          </div>
          <div>
            <h3 className="text-xl font-display font-bold text-slate-100">A geracao falhou</h3>
            <p className="mx-auto mt-2 max-w-2xl text-sm text-slate-400">
              {generation?.errorMessage ?? 'O sistema nao conseguiu concluir esta geracao.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button onClick={() => navigate('/generate')} className="btn-primary">
              Tentar novamente
            </button>
            <button
              onClick={() => {
                void queryClient.invalidateQueries({ queryKey: ['generation', generationId] });
              }}
              className="btn-secondary"
            >
              Atualizar status
            </button>
          </div>
        </div>
      )}

      {generation?.variants && generation.variants.length > 0 && (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {generation.variants.map((variant) => (
              <motion.div
                key={variant.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: (variant.variantIndex - 1) * 0.1 }}
                className={cn(
                  'glass-card cursor-pointer overflow-hidden transition-all duration-200',
                  selectedVariants.includes(variant.id) && !variant.isPaid
                    ? 'ring-2 ring-brand-500 shadow-glow'
                    : variant.isPaid
                      ? 'ring-2 ring-emerald-500'
                      : 'hover:border-slate-600',
                )}
                onClick={() => {
                  if (!variant.isPaid) toggleVariant(variant.id);
                }}
              >
                <div className="relative aspect-video overflow-hidden bg-surface-800">
                  {variant.previewUrl ? (
                    <>
                      <img
                        src={variant.previewUrl}
                        alt={`Variacao ${variant.variantIndex}`}
                        className="h-full w-full object-cover"
                        draggable={false}
                        onContextMenu={(event) => event.preventDefault()}
                      />
                      <div className="absolute inset-0 bg-transparent" style={{ pointerEvents: 'none' }} />
                    </>
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
                    </div>
                  )}

                  <div className="absolute left-2 top-2">
                    <span className="badge badge-neutral text-[10px]">Opcao {variant.variantIndex}</span>
                  </div>

                  {variant.isPaid && (
                    <div className="absolute right-2 top-2">
                      <span className="badge badge-success text-[10px]">
                        <CheckCircle className="h-2.5 w-2.5" />
                        Pago
                      </span>
                    </div>
                  )}

                  {!variant.isPaid && selectedVariants.includes(variant.id) && (
                    <div className="absolute inset-0 flex items-center justify-center bg-brand-500/10">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-500">
                        <CheckCircle className="h-5 w-5 text-white" />
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-3 p-4">
                  {(variant.templateAdherenceScore || variant.visualImpactScore) && (
                    <div className="space-y-1.5">
                      <ScoreBar label="Aderencia ao template" value={variant.templateAdherenceScore} />
                      <ScoreBar label="Impacto visual" value={variant.visualImpactScore} />
                      <ScoreBar label="Legibilidade" value={variant.textReadabilityScore} />
                    </div>
                  )}

                  {variant.isPaid ? (
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        void handleDownload(variant.id);
                      }}
                      disabled={downloadingId === variant.id}
                      className="btn-primary flex w-full items-center justify-center gap-2 py-2 text-sm"
                    >
                      {downloadingId === variant.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Download className="h-3.5 w-3.5" />
                      )}
                      Baixar HD
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Lock className="h-3.5 w-3.5" />
                      Selecione para comprar
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>

          {!payment && selectedVariants.length > 0 && (
            <div className="glass-card p-6">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-slate-200">
                    {isCombo ? 'Combo - 3 thumbnails' : `Comprar ${selectedVariants.length} thumbnail`}
                  </h3>
                  <p className="mt-0.5 text-sm text-slate-400">
                    {isCombo
                      ? 'Desconto especial ao comprar as 3.'
                      : 'Selecione as 3 para economizar R$ 19,70.'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-display font-bold text-brand-400">{priceLabel}</p>
                  {isCombo && <p className="text-xs text-slate-500 line-through">R$ 59,70</p>}
                </div>
              </div>

              <div className="flex items-center gap-3">
                {selectedVariants.length < 3 && (
                  <button onClick={selectAll} className="btn-secondary flex items-center gap-2 text-sm">
                    <Package className="h-4 w-4" />
                    Selecionar as 3
                  </button>
                )}
                <button
                  onClick={() => {
                    void handlePay();
                  }}
                  disabled={paymentLoading}
                  className="btn-primary flex flex-1 items-center justify-center gap-2"
                >
                  {paymentLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ShoppingCart className="h-4 w-4" />
                  )}
                  Pagar via PIX
                </button>
              </div>
            </div>
          )}

          {payment && payment.status !== 'APPROVED' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="glass-card space-y-4 p-6 text-center"
            >
              <h3 className="text-lg font-display font-bold text-slate-100">Pague via PIX</h3>
              <p className="text-sm text-slate-400">Escaneie o QR Code ou copie o codigo.</p>

              {payment.pixQrCode && (
                <div className="flex justify-center">
                  <div className="rounded-2xl bg-white p-4">
                    <QRCodeSVG value={payment.pixQrCodeText ?? ''} size={200} />
                  </div>
                </div>
              )}

              {payment.pixQrCodeText && (
                <div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(payment.pixQrCodeText!);
                      toast.success('Codigo copiado.');
                    }}
                    className="btn-secondary w-full text-sm"
                  >
                    Copiar codigo PIX
                  </button>
                </div>
              )}

              <div className="flex items-center justify-center gap-2 text-sm text-slate-400">
                <Clock className="h-4 w-4" />
                <span>Expira em 30 minutos - aguardando pagamento...</span>
              </div>

              <div className="flex items-center gap-2 rounded-xl bg-amber-500/10 p-3 text-sm text-amber-400">
                <Star className="h-4 w-4 flex-shrink-0" />
                Apos o pagamento, o download sera liberado automaticamente.
              </div>
            </motion.div>
          )}
        </>
      )}
    </div>
  );
}
