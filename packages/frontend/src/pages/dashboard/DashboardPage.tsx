// =============================================================================
// ThumbForge AI — Dashboard Page
// =============================================================================

import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Wand2, Download, Zap, TrendingUp, Clock, Image, ChevronRight, Plus } from 'lucide-react';
import { useAuthStore } from '../../stores/auth.store.js';
import { subscriptionsApi, generationsApi } from '../../services/api.js';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function StatCard({
  label,
  value,
  icon: Icon,
  color = 'brand',
  suffix = '',
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color?: string;
  suffix?: string;
}) {
  const colorMap: Record<string, string> = {
    brand: 'bg-brand-500/10 text-brand-400',
    green: 'bg-emerald-500/10 text-emerald-400',
    orange: 'bg-amber-500/10 text-amber-400',
    purple: 'bg-purple-500/10 text-purple-400',
  };

  return (
    <div className="glass-card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-400">{label}</p>
          <p className="text-2xl font-display font-bold text-slate-100 mt-1">
            {value}
            {suffix && <span className="text-lg text-slate-400 ml-1">{suffix}</span>}
          </p>
        </div>
        <div className={`p-2.5 rounded-xl ${colorMap[color] ?? colorMap['brand']}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}

export function DashboardPage() {
  const user = useAuthStore((s) => s.user);

  const { data: subscription } = useQuery({
    queryKey: ['subscription'],
    queryFn: () => subscriptionsApi.current().then((r) => r.data.data),
  });

  const { data: recentGenerations } = useQuery({
    queryKey: ['generations', { limit: 6 }],
    queryFn: () => generationsApi.list({ limit: 6 }).then((r) => r.data.data),
  });

  const generationsUsed = (subscription as { generationsUsed?: number })?.generationsUsed ?? 0;
  const generationsLimit = (subscription as { generationsLimit?: number })?.generationsLimit ?? 30;
  const quotaPercent = Math.round((generationsUsed / generationsLimit) * 100);

  return (
    <div className="page-container py-8 space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-slate-100">
            Olá, {user?.name?.split(' ')[0]} 👋
          </h1>
          <p className="text-slate-400 mt-1">
            {format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}
          </p>
        </div>
        <Link to="/generate" className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Nova Thumbnail
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Gerações usadas" value={`${generationsUsed}/${generationsLimit}`} icon={Zap} color="brand" />
        <StatCard label="Downloads" value={12} icon={Download} color="green" />
        <StatCard label="Templates usados" value={4} icon={Image} color="purple" />
        <StatCard label="Taxa de conversão" value="73" suffix="%" icon={TrendingUp} color="orange" />
      </div>

      {/* Quota Progress */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-semibold text-slate-200">Cota mensal de gerações</h3>
            <p className="text-sm text-slate-400 mt-0.5">
              {generationsUsed} de {generationsLimit} gerações utilizadas
            </p>
          </div>
          <span className={`badge ${quotaPercent >= 90 ? 'badge-error' : quotaPercent >= 70 ? 'badge-warning' : 'badge-success'}`}>
            {generationsLimit - generationsUsed} restantes
          </span>
        </div>
        <div className="w-full bg-surface-800 rounded-full h-2.5 overflow-hidden">
          <div
            className={`h-2.5 rounded-full transition-all duration-500 ${
              quotaPercent >= 90 ? 'bg-red-500' : quotaPercent >= 70 ? 'bg-amber-500' : 'bg-brand-500'
            }`}
            style={{ width: `${quotaPercent}%` }}
          />
        </div>
      </div>

      {/* Recent Generations */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="section-title">Gerações recentes</h2>
          <Link to="/history" className="text-sm text-brand-400 hover:text-brand-300 flex items-center gap-1">
            Ver todas <ChevronRight className="w-3 h-3" />
          </Link>
        </div>

        {!recentGenerations?.length ? (
          <div className="glass-card p-12 text-center">
            <div className="w-16 h-16 bg-brand-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Wand2 className="w-8 h-8 text-brand-400" />
            </div>
            <h3 className="font-semibold text-slate-200 mb-2">Nenhuma geração ainda</h3>
            <p className="text-slate-400 text-sm mb-6">
              Crie sua primeira thumbnail com IA agora mesmo!
            </p>
            <Link to="/generate" className="btn-primary inline-flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Criar primeira thumbnail
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {(recentGenerations as Array<{
              id: string;
              status: string;
              createdAt: string;
              variants?: Array<{ thumbnailUrl?: string; isPaid?: boolean }>;
            }>).map((gen) => (
              <Link
                key={gen.id}
                to={`/generate/${gen.id}/results`}
                className="glass-card-hover overflow-hidden group"
              >
                <div className="aspect-video bg-surface-800 relative overflow-hidden">
                  {gen.variants?.[0]?.thumbnailUrl ? (
                    <img
                      src={gen.variants[0].thumbnailUrl}
                      alt="Thumbnail"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      {gen.status === 'PROCESSING' || gen.status === 'QUEUED' ? (
                        <div className="flex flex-col items-center gap-2">
                          <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                          <span className="text-xs text-slate-400">Gerando...</span>
                        </div>
                      ) : (
                        <Image className="w-8 h-8 text-slate-600" />
                      )}
                    </div>
                  )}
                  <div className="absolute top-2 right-2">
                    <span className={`badge text-[10px] px-1.5 py-0.5 ${
                      gen.status === 'COMPLETED' ? 'badge-success' :
                      gen.status === 'FAILED' ? 'badge-error' :
                      'badge-warning'
                    }`}>
                      {gen.status === 'COMPLETED' ? 'Pronto' :
                       gen.status === 'FAILED' ? 'Erro' :
                       gen.status === 'QUEUED' ? 'Na fila' : 'Gerando'}
                    </span>
                  </div>
                </div>
                <div className="p-3">
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <Clock className="w-3 h-3" />
                    {format(new Date(gen.createdAt), "d/MM 'às' HH:mm")}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* CTA Card */}
      <div className="relative overflow-hidden glass-card p-6 border-brand-500/20">
        <div className="absolute inset-0 bg-gradient-to-r from-brand-900/40 to-purple-900/40" />
        <div className="relative flex items-center justify-between">
          <div>
            <h3 className="font-display font-bold text-lg text-slate-100">
              Explore os templates prontos
            </h3>
            <p className="text-slate-400 text-sm mt-1">
              9 estilos profissionais para acelerar sua criação
            </p>
          </div>
          <Link to="/templates" className="btn-primary flex items-center gap-2 flex-shrink-0">
            Ver templates
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
