'use client';

import React from 'react';
import { CHANGE_TYPE_LABEL, CHANGE_TYPE_KIND } from '@/lib/cognitive-graph';
import { useSWRWithConfig } from '@/hooks/use-swr';

const KIND_COLOR: Record<string, string> = {
  root: '#b7f3d0', identity: '#b7f3d0', energy: '#8ed8bd', bottleneck: '#e6a38f', signal: '#74d1b1', metric: '#9db8d8',
}

interface DecisionLog {
  id: string;
  changeType: string;
  description: string;
  createdAt: string;
}

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Ahora';
  if (mins < 60) return `Hace ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Hace ${hrs}h`;
  return `Hace ${Math.floor(hrs / 24)}d`;
}

// Timestamped list of what the twin actually inferred, straight from
// TwinEvolutionLog — the "why did the graph just pulse" answer, sitting next
// to the graph it explains.
export function DecisionFeed() {
  const { data, error } = useSWRWithConfig<DecisionLog[]>('/api/cognitive/decisions');
  const logs = error ? [] : data ?? null;

  if (!logs) {
    return (
      <div className="h-full flex items-center justify-center text-xs text-foreground/30">
        Cargando bitácora…
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-xs text-foreground/30 text-center px-6">
        Tu twin aún no ha detectado patrones. Sigue usando Novo — esta bitácora se irá llenando sola.
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto custom-scrollbar space-y-2.5 pr-1">
      {logs.map((log) => {
        const color = KIND_COLOR[CHANGE_TYPE_KIND[log.changeType] || 'metric'];
        return (
          <div key={log.id} className="flex gap-3 p-3 rounded-2xl bg-foreground/[0.02] border border-foreground/[0.05]">
            <div
              className="mt-1 w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: color, boxShadow: `0 0 8px ${color}aa` }}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-bold text-foreground/80">
                  {CHANGE_TYPE_LABEL[log.changeType] || log.changeType}
                </p>
                <span className="text-[9px] text-foreground/25 flex-shrink-0">{timeAgo(log.createdAt)}</span>
              </div>
              <p className="text-[10px] text-foreground/40 leading-relaxed mt-0.5">{log.description}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
