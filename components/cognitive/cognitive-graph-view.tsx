'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { CognitiveGraph, GraphNode } from '@/lib/cognitive-graph';

// Hand-rolled force-directed layout — small node count (root + ~10-14 nodes),
// so a from-scratch simulation is simpler and lighter than pulling in a
// graph-viz library for this one view. Same physics idea as Obsidian's graph:
// pairwise repulsion, spring edges, weak centering, light damping so it keeps
// a faint living drift instead of freezing solid. Dragged nodes are pinned to
// the pointer each frame instead of taking forces, so the rest of the graph
// still reacts to a node you're moving.

interface SimNode extends GraphNode {
  x: number; y: number; vx: number; vy: number;
}

export const KIND_COLOR: Record<GraphNode['kind'], string> = {
  root: '#ffffff',
  identity: '#818cf8',
  energy: '#fbbf24',
  bottleneck: '#fb7185',
  signal: '#34d399',
  metric: '#60a5fa',
};

const KIND_LABEL: Record<GraphNode['kind'], string> = {
  root: 'Tú',
  identity: 'Identidad',
  energy: 'Energía',
  bottleneck: 'Bloqueo',
  signal: 'Comportamiento',
  metric: 'Métrica',
};

function useForceLayout(graph: CognitiveGraph | null, width: number, height: number) {
  const [positions, setPositions] = useState<SimNode[]>([]);
  const simRef = useRef<SimNode[]>([]);
  const rafRef = useRef<number | null>(null);
  const dragRef = useRef<{ id: string; x: number; y: number } | null>(null);

  useEffect(() => {
    if (!graph || width === 0 || height === 0) return;
    const cx = width / 2, cy = height / 2;
    simRef.current = graph.nodes.map((n, i) => {
      const angle = (i / graph.nodes.length) * Math.PI * 2;
      const r = n.kind === 'root' ? 0 : 100 + Math.random() * 50;
      return { ...n, x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r, vx: 0, vy: 0 };
    });

    const tick = () => {
      const nodes = simRef.current;
      const idx = new Map(nodes.map((n, i) => [n.id, i]));

      // Repulsion (all pairs — fine at this node count)
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          let dx = a.x - b.x, dy = a.y - b.y;
          let dist2 = dx * dx + dy * dy;
          if (dist2 < 1) dist2 = 1;
          const force = 2600 / dist2;
          const dist = Math.sqrt(dist2);
          const fx = (dx / dist) * force, fy = (dy / dist) * force;
          a.vx += fx; a.vy += fy;
          b.vx -= fx; b.vy -= fy;
        }
      }

      // Spring edges toward a target length
      for (const e of graph.edges) {
        const a = nodes[idx.get(e.source)!], b = nodes[idx.get(e.target)!];
        if (!a || !b) continue;
        const target = e.kind === 'insight' ? 150 : 110;
        const dx = b.x - a.x, dy = b.y - a.y;
        const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
        const stretch = (dist - target) * 0.02;
        const fx = (dx / dist) * stretch, fy = (dy / dist) * stretch;
        a.vx += fx; a.vy += fy;
        b.vx -= fx; b.vy -= fy;
      }

      // Drag pin, weak centering, damping + integrate
      const drag = dragRef.current;
      for (const n of nodes) {
        if (drag && drag.id === n.id) {
          n.x = drag.x; n.y = drag.y; n.vx = 0; n.vy = 0;
          continue;
        }
        if (n.kind !== 'root') {
          n.vx += (cx - n.x) * 0.0015;
          n.vy += (cy - n.y) * 0.0015;
        } else {
          n.x = cx; n.y = cy; n.vx = 0; n.vy = 0;
        }
        n.vx *= 0.82; n.vy *= 0.82;
        n.x += n.vx; n.y += n.vy;
        n.x = Math.max(28, Math.min(width - 28, n.x));
        n.y = Math.max(28, Math.min(height - 28, n.y));
      }

      setPositions([...nodes]);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [graph, width, height]);

  const startDrag = (id: string, x: number, y: number) => { dragRef.current = { id, x, y }; };
  const moveDrag = (x: number, y: number) => { if (dragRef.current) { dragRef.current.x = x; dragRef.current.y = y; } };
  const endDrag = () => { dragRef.current = null; };

  return { positions, startDrag, moveDrag, endDrag };
}

export function CognitiveGraphView() {
  const [graph, setGraph] = useState<CognitiveGraph | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  // Callback ref, not useRef: the container div only exists in the third
  // conditional render branch below (after `graph` loads), so a plain
  // useRef + empty-deps effect would fire once on the first (ref-less)
  // render and never observe anything. A callback ref fires exactly when
  // that div actually mounts, whichever render produces it.
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    fetch('/api/cognitive/graph')
      .then(r => r.ok ? r.json() : null)
      .then(setGraph)
      .catch(() => setGraph(null));
  }, []);

  useEffect(() => {
    if (!container) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setSize({ width, height });
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, [container]);

  const { positions: nodes, startDrag, moveDrag, endDrag } = useForceLayout(graph, size.width, size.height);

  const localPoint = (e: React.PointerEvent) => {
    const rect = container!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handlePointerDown = (n: SimNode) => (e: React.PointerEvent<SVGGElement>) => {
    if (n.kind === 'root') return; // the root stays centered on purpose
    (e.target as Element).setPointerCapture(e.pointerId);
    const p = localPoint(e);
    startDrag(n.id, p.x, p.y);
    setDraggingId(n.id);
  };
  const handlePointerMove = (e: React.PointerEvent<SVGGElement>) => {
    if (!draggingId) return;
    const p = localPoint(e);
    moveDrag(p.x, p.y);
  };
  const handlePointerUp = () => {
    if (draggingId) { endDrag(); setDraggingId(null); }
  };

  const connectedIds = React.useMemo(() => {
    const focusId = draggingId || hoveredId || selectedId;
    if (!focusId || !graph) return null;
    const set = new Set<string>([focusId]);
    for (const e of graph.edges) {
      if (e.source === focusId) set.add(e.target);
      if (e.target === focusId) set.add(e.source);
    }
    return set;
  }, [hoveredId, draggingId, graph]);

  const nodeById = React.useMemo(() => new Map(nodes.map(n => [n.id, n])), [nodes]);

  if (!graph) {
    return (
      <div className="h-full flex items-center justify-center text-xs text-foreground/30">
        Cargando mapa cognitivo…
      </div>
    );
  }

  if (graph.nodes.length <= 1) {
    return (
      <div className="h-full flex items-center justify-center text-xs text-foreground/30 text-center px-6">
        Tu gemelo aún no tiene suficientes señales para dibujar un mapa. Sigue usando Novo — se irá construyendo solo.
      </div>
    );
  }

  return (
    <div
      ref={setContainer}
      className="relative h-full min-h-[280px] w-full overflow-hidden rounded-[22px]"
      style={{
        background:
          'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px) 0 0/26px 26px, radial-gradient(ellipse at 50% 40%, rgba(99,102,241,0.10) 0%, transparent 65%)',
      }}
    >
      <svg
        width={size.width}
        height={size.height}
        className="absolute inset-0"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onClick={(e) => { if (e.target === e.currentTarget) setSelectedId(null); }}
      >
        {graph.edges.map((e, i) => {
          const a = nodeById.get(e.source), b = nodeById.get(e.target);
          if (!a || !b) return null;
          const dim = connectedIds && !(connectedIds.has(e.source) && connectedIds.has(e.target));
          return (
            <line
              key={i}
              x1={a.x} y1={a.y} x2={b.x} y2={b.y}
              stroke={e.kind === 'insight' ? '#fb7185b0' : '#ffffff33'}
              strokeWidth={e.kind === 'insight' ? 2 : 1.25}
              strokeDasharray={e.kind === 'insight' ? '4 4' : undefined}
              opacity={dim ? 0.12 : 1}
            />
          );
        })}
        {nodes.map((n) => {
          const dim = connectedIds && !connectedIds.has(n.id);
          const r = 8 + n.weight * 2.4;
          return (
            <g
              key={n.id}
              transform={`translate(${n.x}, ${n.y})`}
              className={n.kind === 'root' ? '' : draggingId === n.id ? 'cursor-grabbing' : 'cursor-grab'}
              onPointerDown={handlePointerDown(n)}
              onClick={(e) => { e.stopPropagation(); setSelectedId(id => id === n.id ? null : n.id); }}
              onMouseEnter={() => setHoveredId(n.id)}
              onMouseLeave={() => setHoveredId(null)}
              opacity={dim ? 0.2 : 1}
              style={{ touchAction: 'none' }}
            >
              {n.isNew && (
                <circle
                  r={r + 6}
                  fill="none"
                  stroke={KIND_COLOR[n.kind]}
                  strokeWidth={1.5}
                  className="animate-pulse"
                  pointerEvents="none"
                />
              )}
              <circle
                r={r}
                fill={KIND_COLOR[n.kind]}
                fillOpacity={n.kind === 'root' ? 1 : 0.9}
                stroke={draggingId === n.id || selectedId === n.id ? '#ffffff' : 'transparent'}
                strokeWidth={2}
                style={{ filter: `drop-shadow(0 0 ${r * 1.4}px ${KIND_COLOR[n.kind]}aa)` }}
              />
              <text
                y={r + 14}
                textAnchor="middle"
                className="select-none font-bold pointer-events-none"
                style={{ fontSize: n.kind === 'root' ? 12 : 10, fill: '#ffffffe0' }}
              >
                {n.label}
              </text>
              {(hoveredId === n.id || draggingId === n.id || selectedId === n.id) && (
                <text y={r + 27} textAnchor="middle" className="pointer-events-none" style={{ fontSize: 9, fill: '#ffffff85' }}>
                  {n.detail}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Legend — small, corner-anchored, reinforces this is a real map, not decoration */}
      <div className="absolute bottom-3 left-3 flex flex-wrap gap-x-3 gap-y-1 max-w-[70%] pointer-events-none">
        {(Object.keys(KIND_LABEL) as GraphNode['kind'][])
          .filter(k => k !== 'root' && graph.nodes.some(n => n.kind === k))
          .map(k => (
            <div key={k} className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: KIND_COLOR[k] }} />
              <span className="text-[9px] font-semibold uppercase tracking-wider text-foreground/40">{KIND_LABEL[k]}</span>
            </div>
          ))}
        {graph.nodes.some(n => n.isNew) && (
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full border border-foreground/50 animate-pulse" />
            <span className="text-[9px] font-semibold uppercase tracking-wider text-foreground/40">Recién aprendido</span>
          </div>
        )}
      </div>
    </div>
  );
}
