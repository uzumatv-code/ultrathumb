import { ArrowRight, Check, Layers3, Shield, Wand2, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';

const features = [
  {
    title: '3 variacoes por geracao',
    description:
      'Envie a referencia, descreva o estilo e receba tres opcoes consistentes para escolher.',
    icon: Wand2,
  },
  {
    title: 'Preview protegido',
    description:
      'Watermark, baixa resolucao, blur leve e assets HD mantidos em storage privado.',
    icon: Shield,
  },
  {
    title: 'Templates para creators',
    description:
      'Categorias prontas para gamer, mobile, reaction, tutorial, clickbait e visual cinematico.',
    icon: Layers3,
  },
];

const metrics = [
  { label: 'Plano mensal', value: 'R$ 49,90' },
  { label: 'Geracoes por mes', value: '30' },
  { label: 'Variacoes por pedido', value: '3' },
  { label: 'Combo das 3', value: 'R$ 40,00' },
];

export function LandingPage() {
  return (
    <div className="min-h-screen bg-surface-950 text-slate-100">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10rem] left-[-8rem] h-80 w-80 rounded-full bg-brand-500/15 blur-3xl" />
        <div className="absolute right-[-8rem] top-40 h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute bottom-[-12rem] left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-brand-900/25 blur-3xl" />
      </div>

      <header className="page-container relative z-10 flex items-center justify-between py-6">
        <Link to="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-brand shadow-glow">
            <Zap className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="font-display text-lg font-bold gradient-text">ThumbForge AI</p>
            <p className="text-xs text-slate-500">Thumbnail SaaS para creators</p>
          </div>
        </Link>

        <div className="flex items-center gap-3">
          <Link to="/login" className="btn-ghost">
            Entrar
          </Link>
          <Link to="/register" className="btn-primary inline-flex items-center gap-2">
            Criar conta
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </header>

      <main className="page-container relative z-10 pb-16 pt-8">
        <section className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div className="space-y-6">
            <span className="badge badge-brand">
              <Zap className="h-3 w-3" />
              Fluxo focado em conversao e velocidade
            </span>

            <div className="space-y-4">
              <h1 className="max-w-3xl text-balance font-display text-5xl font-bold leading-tight text-slate-50 md:text-6xl">
                Gere thumbnails premium com IA sem perder seu padrao visual.
              </h1>
              <p className="max-w-2xl text-lg text-slate-300">
                Envie uma referencia, assets separados, texto e instrucoes livres. O ThumbForge
                monta tres opcoes prontas para preview, pagamento e download seguro em HD.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link to="/register" className="btn-primary inline-flex items-center justify-center gap-2">
                Comecar agora
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/templates" className="btn-secondary inline-flex items-center justify-center gap-2">
                Ver templates
              </Link>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {metrics.map((metric) => (
                <div key={metric.label} className="glass-card p-4">
                  <p className="text-sm text-slate-400">{metric.label}</p>
                  <p className="mt-1 font-display text-2xl font-bold text-slate-100">
                    {metric.value}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card relative overflow-hidden border-brand-500/20 p-5 shadow-card-hover">
            <div className="absolute inset-0 bg-gradient-to-br from-brand-500/10 via-transparent to-cyan-500/10" />
            <div className="relative space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Pipeline ThumbForge</p>
                  <p className="font-display text-2xl font-bold text-slate-100">
                    Referencia para resultado pago
                  </p>
                </div>
                <span className="badge badge-success">PIX + webhooks</span>
              </div>

              <div className="space-y-3">
                {[
                  'Upload da thumb de referencia',
                  'Analise visual e prompt estruturado',
                  'Geracao de 3 variacoes consistentes',
                  'Preview protegido com watermark',
                  'Liberacao HD apenas apos pagamento aprovado',
                ].map((item) => (
                  <div
                    key={item}
                    className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-surface-900/70 px-4 py-3"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-500/15 text-brand-300">
                      <Check className="h-4 w-4" />
                    </div>
                    <p className="text-sm text-slate-300">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-16 space-y-6">
          <div>
            <h2 className="section-title">Pensado para criadores que vivem de clique</h2>
            <p className="section-subtitle">
              Base multi-tenant, pagamentos por PIX, historico completo e arquitetura preparada para escalar.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {features.map(({ title, description, icon: Icon }) => (
              <div key={title} className="glass-card-hover p-5">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-500/15 text-brand-300">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="font-display text-xl font-bold text-slate-100">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
