'use client';

import React from 'react';
import { Shirt, Palette, Heart, Sparkles, Sun, Moon, Cloud } from 'lucide-react';

interface OutfitRecommendationCardProps {
  content: {
    outfit?: string;
    style?: string;
    context?: string;
    psychology?: string;
    colorPalette?: string[];
    weatherContext?: string;
    items?: Array<{ name: string; category?: string }>;
  };
}

export function OutfitRecommendationCard({ content }: OutfitRecommendationCardProps) {
  const WeatherIcon = content.weatherContext?.includes('sol') || content.weatherContext?.includes('sun')
    ? Sun
    : content.weatherContext?.includes('noche') || content.weatherContext?.includes('night')
      ? Moon
      : Cloud;

  return (
    <div className="my-3 rounded-2xl border border-white/[0.08] bg-gradient-to-br from-amber-500/[0.04] to-pink-500/[0.02] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] bg-white/[0.02]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-amber-500/15 flex items-center justify-center">
            <Shirt className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div>
            <p className="text-[10px] font-black tracking-[0.2em] uppercase text-amber-400/60">Outfit Suggestion</p>
            <p className="text-[11px] text-white/50">Basado en tu estado cognitivo actual</p>
          </div>
        </div>
        {content.weatherContext && (
          <div className="flex items-center gap-1 text-[9px] text-white/30">
            <WeatherIcon className="w-3 h-3" />
            <span>{content.weatherContext}</span>
          </div>
        )}
      </div>

      {/* Main Outfit */}
      <div className="px-4 py-3.5 space-y-3">
        {content.style && (
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-xs font-black text-amber-400">{content.style}</span>
          </div>
        )}

        {content.outfit && (
          <p className="text-sm font-semibold text-white/90 leading-relaxed">
            {content.outfit}
          </p>
        )}

        {content.context && (
          <p className="text-xs text-white/40 leading-relaxed italic">
            {content.context}
          </p>
        )}

        {/* Color Palette */}
        {content.colorPalette && content.colorPalette.length > 0 && (
          <div className="space-y-1.5 pt-2">
            <div className="flex items-center gap-1.5">
              <Palette className="w-3 h-3 text-white/30" />
              <span className="text-[9px] font-black uppercase tracking-widest text-white/25">Color Palette</span>
            </div>
            <div className="flex gap-1.5">
              {content.colorPalette.map((color, i) => (
                <div
                  key={i}
                  className="w-8 h-8 rounded-lg border border-white/[0.08] shadow-md transition-transform hover:scale-110 cursor-pointer"
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
          </div>
        )}

        {/* Item Tags */}
        {content.items && content.items.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-2 border-t border-white/[0.04]">
            {content.items.map((item, i) => (
              <span
                key={i}
                className="text-[10px] px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/[0.06] text-white/60 font-medium"
              >
                {item.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Psychology Insight */}
      {content.psychology && (
        <div className="px-4 py-3 border-t border-white/[0.04] bg-white/[0.01]">
          <div className="flex items-center gap-1.5 mb-1">
            <Heart className="w-3 h-3 text-pink-400" />
            <span className="text-[9px] font-black uppercase tracking-widest text-pink-400/50">Style Psychology</span>
          </div>
          <p className="text-xs text-white/50 leading-relaxed">{content.psychology}</p>
        </div>
      )}
    </div>
  );
}
