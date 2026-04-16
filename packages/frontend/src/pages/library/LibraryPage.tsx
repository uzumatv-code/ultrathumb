import { Bookmark, FolderHeart, Sparkles, Star } from 'lucide-react';

const libraryCards = [
  {
    title: 'Modelos salvos',
    description: 'Salve thumbs aprovadas como base reutilizavel para acelerar novos pedidos.',
    icon: FolderHeart,
  },
  {
    title: 'Presets de estilo',
    description: 'Guarde glow, cores, composicao e texto padrao para manter consistencia.',
    icon: Sparkles,
  },
  {
    title: 'Favoritos',
    description: 'Marque referencias e templates que performam melhor no seu canal.',
    icon: Star,
  },
];

export function LibraryPage() {
  return (
    <div className="page-container py-8 space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-display font-bold text-slate-100">Biblioteca</h1>
        <p className="text-slate-400 mt-1">
          Organize modelos, presets e referencias para reutilizacao futura.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {libraryCards.map(({ title, description, icon: Icon }) => (
          <div key={title} className="glass-card-hover p-5">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-500/15 text-brand-300">
              <Icon className="h-5 w-5" />
            </div>
            <h2 className="font-display text-xl font-bold text-slate-100">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>
          </div>
        ))}
      </div>

      <div className="glass-card border-dashed border-slate-700 p-12 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-500/10 text-brand-400">
          <Bookmark className="h-8 w-8" />
        </div>
        <h2 className="font-display text-2xl font-bold text-slate-100">Sua biblioteca ainda esta vazia</h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-400">
          O proximo passo natural aqui e conectar os modelos salvos do backend com thumbnails
          aprovadas, metadados de estilo e assets de referencia reutilizaveis por tenant.
        </p>
      </div>
    </div>
  );
}
