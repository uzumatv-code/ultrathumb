import { Bell, CreditCard, Shield, UserCircle2 } from 'lucide-react';
import { useAuthStore } from '../../stores/auth.store.js';

const sections = [
  {
    title: 'Perfil e sessao',
    description: 'Dados basicos da conta, avatar, email e seguranca de acesso.',
    icon: UserCircle2,
  },
  {
    title: 'Pagamentos',
    description: 'Historico de cobrancas, pagamentos por PIX e futuras preferencias de faturamento.',
    icon: CreditCard,
  },
  {
    title: 'Notificacoes',
    description: 'Acompanhe geracoes concluidas, pagamentos aprovados e alertas de cota.',
    icon: Bell,
  },
  {
    title: 'Seguranca',
    description: 'Rotacao de tokens, logs de atividade e trilha de auditoria por usuario.',
    icon: Shield,
  },
];

export function SettingsPage() {
  const user = useAuthStore((state) => state.user);

  return (
    <div className="page-container py-8 space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-display font-bold text-slate-100">Configuracoes</h1>
        <p className="text-slate-400 mt-1">
          Area pronta para evoluir preferencias de conta, seguranca e faturamento.
        </p>
      </div>

      <div className="glass-card p-6">
        <div className="flex flex-col gap-5 md:flex-row md:items-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-brand-500/15 text-2xl font-bold text-brand-300">
            {user?.name?.charAt(0).toUpperCase() ?? 'T'}
          </div>
          <div className="space-y-1">
            <h2 className="font-display text-2xl font-bold text-slate-100">{user?.name}</h2>
            <p className="text-slate-400">{user?.email}</p>
            <div className="flex items-center gap-2">
              <span className="badge badge-brand">{user?.role ?? 'USER'}</span>
              <span className="badge badge-neutral">{user?.tenantId ?? 'tenant-pendente'}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {sections.map(({ title, description, icon: Icon }) => (
          <div key={title} className="glass-card-hover p-5">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-500/15 text-brand-300">
              <Icon className="h-5 w-5" />
            </div>
            <h2 className="font-display text-xl font-bold text-slate-100">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
