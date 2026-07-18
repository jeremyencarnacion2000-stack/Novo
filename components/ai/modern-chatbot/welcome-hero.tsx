'use client';

import React from 'react';
import { Mic, MicOff } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { GlowingOrb } from './glowing-orb';
import { SUGGESTIONS } from './chat-input';

const DESKTOP_SUGGESTIONS = SUGGESTIONS.slice(0, 4);

function getGreetingTime(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Buenos días';
  if (hour < 18) return 'Buenas tardes';
  return 'Buenas noches';
}

// Mobile Hero - DeepSeek/PulseChat style
export function MobileHero({
  onChipClick,
  onVoiceClick,
  isVoiceListening,
}: {
  onChipClick: (text: string) => void;
  onVoiceClick: () => void;
  isVoiceListening: boolean;
}) {
  const { data: session } = useSession();
  const firstName = session?.user?.name?.split(' ')[0] ?? '';

  return (
    <motion.div
      className="flex-1 flex flex-col items-center justify-center px-6 pb-8 pt-16 relative overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.35 }}
    >
      <motion.div
        className="relative mb-8"
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      >
        <GlowingOrb state={isVoiceListening ? 'listening' : 'idle'} size="md" />
      </motion.div>

      <motion.p
        className="text-white/50 text-[15px] tracking-wide font-medium mb-1.5"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
      >
        Hola{firstName ? `, ${firstName}` : ''}
      </motion.p>
      <motion.h1
        className="text-[28px] leading-tight font-semibold text-white text-center tracking-tight mb-2"
        initial={{ y: 16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.4 }}
      >
        ¿En qué puedo ayudarte?
      </motion.h1>

      <motion.div
        className="flex flex-wrap justify-center gap-2.5 mt-8 max-w-xs"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.4 }}
      >
        {['Crear una tarea', 'Crear una rutina', 'Modo enfoque', 'Planear mi día', 'Motívame'].map((chip) => (
          <button
            key={chip}
            onClick={() => onChipClick(chip)}
            className="px-4 py-2 rounded-full bg-white/[0.07] border border-white/10 text-white/75 text-sm font-medium hover:bg-white/[0.12] hover:text-white hover:border-white/20 active:scale-95 transition-all duration-200"
          >
            {chip}
          </button>
        ))}
      </motion.div>

      <motion.button
        onClick={onVoiceClick}
        className={cn(
          'mt-10 flex items-center gap-2.5 px-5 py-2.5 rounded-full border text-sm font-medium transition-all duration-300',
          isVoiceListening
            ? 'bg-primary/20 border-primary/40 text-primary animate-pulse'
            : 'bg-white/[0.04] border-white/10 text-white/40 hover:text-white/70 hover:bg-white/[0.08]'
        )}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.45 }}
      >
        {isVoiceListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        {isVoiceListening ? 'Escuchando... toca para detener' : 'O toca para hablar'}
      </motion.button>
    </motion.div>
  );
}

// Voice Listening Overlay - PulseChat style full-screen orb
export function VoiceListeningOverlay({ onStop }: { onStop: () => void }) {
  // Reduced motion means gentler, not zero — the opacity pulse on "Escuchando..."
  // stays (it aids comprehension), but the continuous scaleY waveform movement
  // is the kind of infinite motion prefers-reduced-motion exists to suppress.
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[var(--background)]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="relative flex items-center justify-center">
        <GlowingOrb state="listening" size="lg" />
        <Mic className="absolute w-10 h-10 text-white drop-shadow-lg" />
      </div>

      <motion.p
        className="mt-8 text-white/60 text-sm font-medium tracking-widest uppercase"
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        Escuchando...
      </motion.p>

      <div className="flex items-center gap-1.5 mt-3 mb-12">
        {[0, 1, 2, 3, 4].map((i) => (
          <motion.div
            key={i}
            className="w-1 rounded-full bg-emerald-400"
            style={{ height: `${16 + i * 6}px`, transformOrigin: 'center' }}
            animate={reduceMotion ? { scaleY: 0.75 } : { scaleY: [0.5, 1, 0.5] }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.7, repeat: Infinity, delay: i * 0.1, ease: 'easeInOut' }}
          />
        ))}
      </div>

      <button
        onClick={onStop}
        className="px-8 py-3 rounded-full bg-white/10 border border-white/15 text-white/80 text-sm font-semibold hover:bg-white/20 active:scale-95 transition-[background-color,transform]"
      >
        Detener
      </button>
    </motion.div>
  );
}

// Desktop Hero — PulseChat style: orb + greeting only, nothing else. Input is
// the persistent bottom pill (rendered once, always docked, by index.tsx) —
// this hero used to embed its own separate input box, which meant the app
// had two different-looking composers depending on whether a chat was
// active. One input surface, matching the reference, is the point.
export function DesktopHero({ onChipClick }: { onChipClick?: (text: string) => void }) {
  const { data: session } = useSession();
  const firstName = session?.user?.name?.split(' ')[0] ?? '';

  return (
    <motion.div
      className="flex-1 flex flex-col items-center justify-center px-8 py-12 relative overflow-hidden"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8, scale: 0.98 }}
      transition={{ duration: 0.4 }}
    >
      <motion.div
        className="mb-8"
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      >
        <GlowingOrb state="idle" size="lg" />
      </motion.div>

      <motion.p
        className="text-white/50 text-[15px] tracking-wide font-medium mb-1.5"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
      >
        {getGreetingTime()}{firstName ? `, ${firstName}` : ''}
      </motion.p>
      <motion.h1
        className="text-[34px] leading-tight font-semibold text-white text-center tracking-tight"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        ¿En qué puedo<br />ayudarte hoy?
      </motion.h1>
      <motion.p
        className="text-white/35 text-sm text-center mt-3 max-w-sm"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        Desde respuestas rápidas hasta recomendaciones basadas en tu energía real.
      </motion.p>

      {onChipClick && (
        <motion.div
          className="flex flex-wrap justify-center gap-2.5 mt-9 max-w-xl"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.4 }}
        >
          {DESKTOP_SUGGESTIONS.map((chip) => (
            <button
              key={chip}
              onClick={() => onChipClick(chip)}
              className="px-4 py-2 rounded-full bg-white/[0.05] border border-white/10 text-white/70 text-sm font-medium hover:bg-white/[0.1] hover:text-white hover:border-white/20 active:scale-95 transition-all duration-200"
            >
              {chip}
            </button>
          ))}
        </motion.div>
      )}
    </motion.div>
  );
}