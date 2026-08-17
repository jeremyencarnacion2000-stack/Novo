'use client';

import { Database, Link2 } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import type { ContextSource } from '@/lib/ai/source-attribution';

export function SourceCitations({ sources }: { sources?: ContextSource[] }) {
  const { language } = useTranslation();
  if (!sources?.length) return null;

  const copy = language === 'es'
    ? { title: 'Contexto consultado', novo: 'Datos de Novo', integration: 'Integración conectada' }
    : language === 'fr'
      ? { title: 'Contexte consulté', novo: 'Données Novo', integration: 'Intégration connectée' }
      : language === 'de'
        ? { title: 'Verwendeter Kontext', novo: 'Novo-Daten', integration: 'Verbundene Integration' }
        : { title: 'Context consulted', novo: 'Novo data', integration: 'Connected integration' };

  return (
    <section className="mt-4 rounded-2xl border border-white/[0.07] bg-white/[0.025] px-3 py-2.5" aria-label={copy.title}>
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
        <Database className="h-3 w-3" />
        {copy.title}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {sources.map((source) => (
          <span
            key={source.id}
            title={`${source.kind === 'novo' ? copy.novo : copy.integration}: ${source.detail}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-black/10 px-2 py-1 text-[10px] font-medium text-white/65"
          >
            <Link2 className="h-2.5 w-2.5 text-primary/80" />
            {source.label}
          </span>
        ))}
      </div>
    </section>
  );
}
