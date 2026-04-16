import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, Filter, ImageIcon, Search } from 'lucide-react';
import { generationsApi } from '../../services/api.js';

interface HistoryGeneration {
  id: string;
  status: string;
  createdAt: string;
  template?: { name?: string | null } | null;
  variants?: Array<{ id: string; thumbnailUrl?: string | null; isPaid?: boolean }>;
}

export function HistoryPage() {
  const [statusFilter, setStatusFilter] = useState('');
  const [query, setQuery] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['history', statusFilter],
    queryFn: () =>
      generationsApi
        .list({ page: 1, limit: 24, ...(statusFilter ? { status: statusFilter } : {}) })
        .then((response) => response.data.data as HistoryGeneration[]),
  });

  const items = useMemo(() => {
    if (!data) return [];

    return data.filter((item) => {
      if (!query.trim()) return true;
      return (
        item.id.toLowerCase().includes(query.toLowerCase()) ||
        item.template?.name?.toLowerCase().includes(query.toLowerCase())
      );
    });
  }, [data, query]);

  return (
    <div className="page-container py-8 space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-slate-100">Historico</h1>
          <p className="text-slate-400 mt-1">
            Revise geracoes, status de compra e resultados anteriores em um unico lugar.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="input pl-10 sm:w-72"
              placeholder="Buscar por ID ou template"
            />
          </label>

          <label className="relative">
            <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="input pl-10 sm:w-52"
            >
              <option value="">Todos os status</option>
              <option value="QUEUED">Na fila</option>
              <option value="PROCESSING">Processando</option>
              <option value="COMPLETED">Concluida</option>
              <option value="FAILED">Falhou</option>
              <option value="CANCELLED">Cancelada</option>
            </select>
          </label>
        </div>
      </div>

      <div className="glass-card p-4">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {isLoading &&
            Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="animate-pulse rounded-2xl border border-slate-800 bg-surface-900/70 p-4"
              >
                <div className="aspect-video rounded-xl bg-surface-800" />
                <div className="mt-4 h-4 w-2/3 rounded bg-surface-800" />
                <div className="mt-2 h-3 w-1/2 rounded bg-surface-800" />
              </div>
            ))}

          {!isLoading && items.length === 0 && (
            <div className="col-span-full rounded-2xl border border-dashed border-slate-700 bg-surface-900/60 p-12 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-500/10 text-brand-400">
                <CalendarDays className="h-8 w-8" />
              </div>
              <h2 className="font-display text-2xl font-bold text-slate-100">
                Nenhuma geracao encontrada
              </h2>
              <p className="mt-2 text-sm text-slate-400">
                Ajuste os filtros ou gere novas thumbs para povoar o historico.
              </p>
            </div>
          )}

          {!isLoading &&
            items.map((item) => {
              const cover = item.variants?.[0]?.thumbnailUrl;
              const paidCount = item.variants?.filter((variant) => variant.isPaid).length ?? 0;

              return (
                <article
                  key={item.id}
                  className="overflow-hidden rounded-2xl border border-slate-800 bg-surface-900/70"
                >
                  <div className="aspect-video bg-surface-800">
                    {cover ? (
                      <img src={cover} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-slate-600">
                        <ImageIcon className="h-10 w-10" />
                      </div>
                    )}
                  </div>

                  <div className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                          {item.template?.name ?? 'Sem template'}
                        </p>
                        <p className="mt-1 font-mono text-sm text-slate-200">{item.id}</p>
                      </div>
                      <span className="badge badge-info">{item.status}</span>
                    </div>

                    <div className="flex items-center justify-between text-sm text-slate-400">
                      <span>{new Date(item.createdAt).toLocaleString('pt-BR')}</span>
                      <span>{paidCount} variante(s) paga(s)</span>
                    </div>
                  </div>
                </article>
              );
            })}
        </div>
      </div>
    </div>
  );
}
