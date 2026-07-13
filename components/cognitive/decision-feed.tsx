'use client';

import React, { useEffect, useState } from 'react';
import { CHANGE_TYPE_LABEL, CHANGE_TYPE_KIND } from '@/lib/cognitive-graph';
import { KIND_COLOR } from '@/components/cognitive/cognitive-graph-view';

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
  const [logs, setLogs] = useState<DecisionLog[] | null>(null);

  useEffect(() => {
    fetch('/api/cognitive/decisions')
      .then(r => (r.ok ? r.json() : []))
      .then(setLogs)
      .catch(() => setLogs([]));
  }, []);

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
