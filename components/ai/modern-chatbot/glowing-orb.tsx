'use client';

import React, { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

export type OrbState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'loading' | 'error';

interface OrbConfig {
  dots: number;
  radius: number;
  dotSize: number;
  speed: number;          // rotation speed multiplier
  pulseScale: number;     // outer glow scale
  color: string;
  glowColor: string;
  scatterRadius: number;  // how far dots scatter from their orbit
}

const STATE_CONFIG: Record<OrbState, OrbConfig> = {
  idle: {
    dots: 10,
    radius: 10,
    dotSize: 1.4,
    speed: 0.3,
    pulseScale: 1,
    color: 'rgba(255,255,255,0.25)',
    glowColor: 'rgba(255,255,255,0.04)',
    scatterRadius: 0.5,
  },
  listening: {
    dots: 14,
    radius: 11,
    dotSize: 1.8,
    speed: 1.1,
    pulseScale: 1.15,
    color: 'rgba(99,179,237,0.9)',
    glowColor: 'rgba(99,179,237,0.18)',
    scatterRadius: 2.5,
  },
  thinking: {
    dots: 18,
    radius: 11,
    dotSize: 1.6,
    speed: 2.2,
    pulseScale: 1.25,
    color: 'rgba(167,139,250,0.9)',
    glowColor: 'rgba(139,92,246,0.22)',
    scatterRadius: 4,
  },
  speaking: {
    dots: 16,
    radius: 11,
    dotSize: 2,
    speed: 1.6,
    pulseScale: 1.2,
    color: 'rgba(52,211,153,0.9)',
    glowColor: 'rgba(16,185,129,0.20)',
    scatterRadius: 3,
  },
  loading: {
    dots: 12,
    radius: 10,
    dotSize: 1.5,
    speed: 3.5,
    pulseScale: 1.1,
    color: 'rgba(251,191,36,0.85)',
    glowColor: 'rgba(245,158,11,0.15)',
    scatterRadius: 1.5,
  },
  error: {
    dots: 10,
    radius: 10,
    dotSize: 1.8,
    speed: 0.6,
    pulseScale: 1.05,
    color: 'rgba(248,113,113,0.9)',
    glowColor: 'rgba(239,68,68,0.18)',
    scatterRadius: 1,
  },
};

const SIZE_MAP = {
  sm: 28,
  md: 56,
  lg: 96,
};

export function GlowingOrb({
  state = 'idle',
  size = 'md',
  className,
}: {
  state?: OrbState;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const stateRef = useRef<OrbState>(state);
  const timeRef = useRef<number>(0);

  // Update state ref whenever prop changes
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const px = SIZE_MAP[size];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // HiDPI
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = px * dpr;
    canvas.height = px * dpr;
    ctx.scale(dpr, dpr);

    const cx = px / 2;
    const cy = px / 2;

    let last = performance.now();
    // Keep a stable non-null reference for use inside the rAF closure
    const ctx2 = ctx;

    function lerp(a: number, b: number, t: number) {
      return a + (b - a) * t;
    }

    // Current interpolated values
    let curRadius = STATE_CONFIG[stateRef.current].radius;
    let curSpeed = STATE_CONFIG[stateRef.current].speed;
    let curScatter = STATE_CONFIG[stateRef.current].scatterRadius;
    let curDotSize = STATE_CONFIG[stateRef.current].dotSize;

    function draw(now: number) {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      timeRef.current += dt;
      const t = timeRef.current;

      const cfg = STATE_CONFIG[stateRef.current];
      const lerpT = 1 - Math.pow(0.05, dt * 6); // smooth ~60fps interpolation

      curRadius = lerp(curRadius, cfg.radius, lerpT);
      curSpeed = lerp(curSpeed, cfg.speed, lerpT);
      curScatter = lerp(curScatter, cfg.scatterRadius, lerpT);
      curDotSize = lerp(curDotSize, cfg.dotSize, lerpT);

      ctx2.clearRect(0, 0, px, px);

      // Outer glow
      const glowR = px * 0.45 * cfg.pulseScale;
      const grd = ctx2.createRadialGradient(cx, cy, 0, cx, cy, glowR);
      grd.addColorStop(0, cfg.glowColor.replace(')', ', 0.9)').replace('rgba', 'rgba'));
      grd.addColorStop(0.5, cfg.glowColor);
      grd.addColorStop(1, 'transparent');
      ctx2.fillStyle = grd;
      ctx2.beginPath();
      ctx2.arc(cx, cy, glowR, 0, Math.PI * 2);
      ctx2.fill();

      // Center core dot
      const coreSize = curDotSize * (size === 'sm' ? 0.9 : 1.2);
      ctx2.fillStyle = cfg.color;
      ctx2.beginPath();
      ctx2.arc(cx, cy, coreSize * 0.5, 0, Math.PI * 2);
      ctx2.fill();

      // Orbit dots
      const n = cfg.dots;
      for (let i = 0; i < n; i++) {
        const angle = (i / n) * Math.PI * 2 + t * curSpeed;

        // Scatter: each dot wobbles on its own phase
        const phase = (i / n) * Math.PI * 2;
        const scatter = Math.sin(t * 1.8 + phase) * curScatter;
        const r = curRadius + scatter;

        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;

        // Opacity: leading dots brighter
        const opacityNorm = 0.3 + 0.7 * ((i / n + 0.5) % 1);
        const sz = curDotSize * (size === 'sm' ? 0.75 : 1);

        ctx2.globalAlpha = opacityNorm;
        ctx2.fillStyle = cfg.color;
        ctx2.beginPath();
        ctx2.arc(x, y, sz, 0, Math.PI * 2);
        ctx2.fill();
      }

      ctx2.globalAlpha = 1;
      animRef.current = requestAnimationFrame(draw);
    }

    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [px, size]);

  return (
    <div
      className={cn('relative inline-flex items-center justify-center flex-shrink-0', className)}
      style={{ width: px, height: px }}
    >
      <canvas
        ref={canvasRef}
        style={{ width: px, height: px }}
        className="rounded-full"
      />
    </div>
  );
}
