'use client';

import React from 'react';
import { Music, Headphones, Radio, ExternalLink } from 'lucide-react';

interface MusicRecommendationCardProps {
  content: {
    mood?: string;
    genre?: string;
    searchQuery?: string;
    frequency?: string;
    reason?: string;
    tracks?: Array<{ title: string; artist?: string }>;
  };
}

export function MusicRecommendationCard({ content }: MusicRecommendationCardProps) {
  const handleOpenSpotify = () => {
    const query = content.searchQuery || content.mood || 'focus music';
    window.open(`https://open.spotify.com/search/${encodeURIComponent(query)}`, '_blank');
  };

  const handleOpenYouTube = () => {
    const query = content.searchQuery || `${content.mood} ${content.frequency || ''} music`;
    window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`, '_blank');
  };

  return (
    <div className="my-3 rounded-2xl border border-white/[0.08] bg-gradient-to-br from-emerald-500/[0.04] to-transparent overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] bg-white/[0.02]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/15 flex items-center justify-center">
            <Music className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div>
            <p className="text-[10px] font-black tracking-[0.2em] uppercase text-emerald-400/60">Music Recommendation</p>
            <p className="text-[11px] text-white/50">Frecuencias optimizadas para tu estado</p>
          </div>
        </div>
      </div>

      {/* Mood & Genre */}
      <div className="px-4 py-3.5 space-y-2.5">
        {content.mood && (
          <div className="flex items-center gap-2">
            <Headphones className="w-3.5 h-3.5 text-emerald-400/70" />
            <span className="text-[10px] font-black uppercase tracking-widest text-white/30">Mood:</span>
            <span className="text-xs font-bold text-emerald-400">{content.mood}</span>
          </div>
        )}

        {content.frequency && (
          <div className="flex items-center gap-2">
            <Radio className="w-3.5 h-3.5 text-purple-400/70" />
            <span className="text-[10px] font-black uppercase tracking-widest text-white/30">Frequency:</span>
            <span className="text-xs font-bold text-purple-400">{content.frequency}</span>
          </div>
        )}

        {content.reason && (
          <p className="text-xs text-white/50 leading-relaxed pt-1 border-t border-white/[0.04]">
            {content.reason}
          </p>
        )}

        {/* Track list */}
        {content.tracks && content.tracks.length > 0 && (
          <div className="space-y-1.5 pt-2">
            {content.tracks.map((track, i) => (
              <div key={i} className="flex items-center gap-2.5 p-2 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                <div className="w-6 h-6 rounded-md bg-emerald-500/10 flex items-center justify-center text-[10px] font-black text-emerald-400">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-white/80 truncate">{track.title}</p>
                  {track.artist && <p className="text-[10px] text-white/30">{track.artist}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 px-4 py-3 border-t border-white/[0.04]">
        <button
          onClick={handleOpenSpotify}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-wider hover:bg-emerald-500/20 transition-colors"
        >
          <ExternalLink className="w-3 h-3" />
          Spotify
        </button>
        <button
          onClick={handleOpenYouTube}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-black uppercase tracking-wider hover:bg-red-500/20 transition-colors"
        >
          <ExternalLink className="w-3 h-3" />
          YouTube
        </button>
      </div>
    </div>
  );
}
