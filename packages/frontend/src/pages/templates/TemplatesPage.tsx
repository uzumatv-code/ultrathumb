import { Crown, Gamepad2, Rocket, Sparkles, Target, Tv2 } from 'lucide-react';
import { Link } from 'react-router-dom';

const templates = [
  {
    title: 'Gamer FPS',
    description: 'Frames intensos, alto contraste e composicao para highlight de jogadas.',
    icon: Gamepad2,
    badge: 'Popular',
  },
  {
    title: 'Battle Royale',
    description: 'Glow vibrante, explosoes ao fundo e foco em personagem principal.',
    icon: Target,
    badge: 'Trending',
  },
  {
    title: 'Mobile High Energy',
    description: 'Cores agressivas e leitura rapida para CTR alto em gameplay casual.',
    icon: Rocket,
    badge: 'CTR',
  },
  {
    title: 'Reaction / Face Cam',
    description: 'Hierarquia forte de rosto, texto curto e elementos de surpresa.',
    icon: Tv2,
    badge: 'Creator',
  },
];

export function TemplatesPage() {
  return (
    <div className="page-container py-8 space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-slate-100">Templates</h1>
          <p className="text-slate-400 mt-1">
            Catalogo inicial de estilos prontos para creators, gamers e canais high-energy.
          </p>
        </div>
        <Link to="/generate" className="btn-primary inline-flex items-center justify-center gap-2">
          <Sparkles className="h-4 w-4" />
          Usar em nova geracao
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {templates.map(({ title, description, icon: Icon, badge }) => (
          <div key={title} className="glass-card-hover relative overflow-hidden p-6">
            <div className="absolute inset-0 bg-gradient-to-br from-brand-500/5 via-transparent to-cyan-500/5" />
            <div className="relative">
              <div className="flex items-start justify-between gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-500/15 text-brand-300">
                  <Icon className="h-5 w-5" />
                </div>
                <span className="badge badge-brand">{badge}</span>
              </div>

              <h2 className="mt-5 font-display text-2xl font-bold text-slate-100">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>

              <div className="mt-5 flex items-center justify-between rounded-2xl border border-slate-800 bg-surface-900/70 px-4 py-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Tier</p>
                  <p className="text-sm font-medium text-slate-200">System template</p>
                </div>
                <div className="flex items-center gap-2 text-amber-300">
                  <Crown className="h-4 w-4" />
                  <span className="text-sm font-medium">Premium ready</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
