'use client';

import React from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { motion } from 'framer-motion';
import { Zap, TrendingDown, Play } from 'lucide-react';
import type { EnergyPoint } from './types';

interface EnergyTimelineChartProps {
  timeline: EnergyPoint[];
  currentHour: number;
  peakStart: number;
  peakEnd: number;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const point: EnergyPoint = payload[0]?.payload;
  return (
    <div className="bg-[#0d0d12]/95 border border-foreground/10 rounded-xl px-3 py-2 shadow-xl backdrop-blur-xl">
      <p className="text-[10px] text-foreground/40 uppercase tracking-widest font-bold">{label}</p>
      <p className="text-sm font-bold text-white mt-0.5">{point.energy}% capacity</p>
      {point.isPeak && <p className="flex items-center gap-1 text-[10px] text-green-400 font-bold"><Zap className="w-3 h-3" /> PEAK WINDOW</p>}
      {point.isDip && <p className="flex items-center gap-1 text-[10px] text-amber-400 font-bold"><TrendingDown className="w-3 h-3" /> AFTERNOON DIP</p>}
      {point.isCurrent && <p className="flex items-center gap-1 text-[10px] text-indigo-400 font-bold"><Play className="w-2.5 h-2.5 fill-indigo-400" /> NOW</p>}
    </div>
  );
};

export function EnergyTimelineChart({ timeline, currentHour, peakStart, peakEnd }: EnergyTimelineChartProps) {
  return (
    <motion.div
      className="w-full"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6, duration: 0.6 }}
    >
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-xs font-black tracking-[0.25em] uppercase text-foreground/70">
            Mental Energy Timeline
          </h3>
          <p className="text-[10px] text-foreground/30 mt-0.5">Circadian performance model · 24h</p>
        </div>
        <div className="flex items-center gap-3 text-[10px]">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_6px_#22c55e]" />
            <span className="text-foreground/40 font-medium">Peak</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span className="text-foreground/40 font-medium">Dip</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-indigo-400" />
            <span className="text-foreground/40 font-medium">Now</span>
          </span>
        </div>
      </div>

      <div className="h-44 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={timeline} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
            <defs>
              <linearGradient id="energyGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
              {/* Peak highlight */}
              <linearGradient id="peakGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22c55e" stopOpacity={0.15} />
                <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
            </defs>

            <XAxis
              dataKey="label"
              tick={{ fill: 'rgba(255,255,255,0.25)', fontSize: 9, fontWeight: 600 }}
              tickLine={false}
              axisLine={false}
              interval={3}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fill: 'rgba(255,255,255,0.2)', fontSize: 9 }}
              tickLine={false}
              axisLine={false}
              tickCount={4}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip content={<CustomTooltip />} />

            {/* Peak window zone */}
            <ReferenceLine x={`${peakStart.toString().padStart(2, '0')}:00`}
              stroke="#22c55e" strokeOpacity={0.4} strokeDasharray="3 3" strokeWidth={1} />
            <ReferenceLine x={`${peakEnd.toString().padStart(2, '0')}:00`}
              stroke="#22c55e" strokeOpacity={0.4} strokeDasharray="3 3" strokeWidth={1} />

            {/* Current time line */}
            <ReferenceLine
              x={`${currentHour.toString().padStart(2, '0')}:00`}
              stroke="#818cf8"
              strokeWidth={2}
              strokeOpacity={0.9}
              label={{ value: 'NOW', fill: '#818cf8', fontSize: 8, fontWeight: 900 }}
            />

            <Area
              type="monotone"
              dataKey="energy"
              stroke="#6366f1"
              strokeWidth={2}
              fill="url(#energyGradient)"
              dot={(props: any) => {
                const { cx, cy, payload } = props;
                if (payload.isCurrent) {
                  return (
                    <g key={`dot-current-${cx}-${cy}`}>
                      <circle cx={cx} cy={cy} r={5} fill="#818cf8" stroke="#fff" strokeWidth={2} />
                    </g>
                  );
                }
                if (payload.isPeak) {
                  return <circle key={`dot-peak-${cx}-${cy}`} cx={cx} cy={cy} r={3.5} fill="#22c55e" />;
                }
                if (payload.isDip) {
                  return <circle key={`dot-dip-${cx}-${cy}`} cx={cx} cy={cy} r={3.5} fill="#f59e0b" />;
                }
                return <g key={`dot-empty-${cx}-${cy}`} />;
              }}
              activeDot={{ r: 5, fill: '#6366f1', stroke: '#fff', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}
