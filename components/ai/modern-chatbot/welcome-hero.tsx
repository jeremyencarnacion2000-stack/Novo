'use client';

import React, { useState } from 'react';
import {
  Sparkles, ListTodo, CalendarDays, Globe, Brain,
  Zap, MessageSquare, ChevronRight, FileEdit, Lightbulb,
  Mic, MicOff, TrendingUp
} from 'lucide-react';
import { useChatbot } from './context';
import { useSession } from 'next-auth/react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

const QUICK_CHIPS = [
  { label: 'Write a draft', icon: FileEdit },
  { label: 'Create a task', icon: ListTodo },
  { label: 'Get advice', icon: Lightbulb },
  { label: 'Make a plan', icon: CalendarDays },
  { label: 'Search web', icon: Globe },
];

const SUGGESTION_CARDS = [
  {
    icon: MessageSquare,
    title: 'Continue a conversation',
    subtitle: 'Pick up where you left off',
    color: 'from-violet-500/10 to-purple-500/5',
    border: 'border-violet-500/20',
  },
  {
    icon: Zap,
    title: 'Quick actions',
    subtitle: 'Tasks, routines, goals',
    color: 'from-amber-500/10 to-orange-500/5',
    border: 'border-amber-500/20',
  },
  {
    icon: TrendingUp,
    title: 'Cognitive insights',
    subtitle: 'Your focus & energy today',
    color: 'from-emerald-500/10 to-teal-500/5',
    border: 'border-emerald-500/20',
  },
];

function getGreetingTime(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
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
  const firstName = session?.user?.name?.split(' ')[0] ?? 'there';

  return (
    <motion.div
      className="flex-1 flex flex-col items-center justify-center px-6 pb-8 pt-16 relative overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.35 }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-[#0d1b3e] via-[#0f1a40] to-[#1a0a3a] -z-10" />
      <div className="absolute inset-0 bg-gradient-to-t from-purple-900/40 via-transparent to-transparent -z-10" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full bg-purple-600/15 blur-[80px] pointer-events-none" />

      <motion.div
        className="relative mb-8"
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      >
        <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-primary via-violet-500 to-blue-500 shadow-[0_0_40px_rgba(139,92,246,0.5)] flex items-center justify-center">
          <Brain className="w-7 h-7 text-white" />
        </div>
        <div className="absolute inset-0 rounded-full bg-primary/30 blur-xl animate-pulse" style={{ animationDuration: '3s' }} />
      </motion.div>

      <motion.h1
        className="text-4xl font-extrabold text-white text-center leading-tight mb-2"
        initial={{ y: 16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.4 }}
      >
        Hi, {firstName}.
        <br />
        <span className="text-white/60 font-semibold text-2xl">How can I help you?</span>
      </motion.h1>

      <motion.div
        className="flex flex-wrap justify-center gap-2.5 mt-8 max-w-xs"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.4 }}
      >
        {['Create a task', 'Set a routine', 'Focus mode', 'Plan my day', 'Motivate me'].map((chip) => (
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
        {isVoiceListening ? 'Listening... tap to stop' : 'Or tap to speak'}
      </motion.button>
    </motion.div>
  );
}

// Voice Listening Overlay - PulseChat style full-screen orb
export function VoiceListeningOverlay({ onStop }: { onStop: () => void }) {
  return (
    <motion.div
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[#0a0f1e]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="relative flex items-center justify-center">
        <motion.div
          className="w-48 h-48 rounded-full bg-gradient-to-tr from-emerald-400 via-teal-500 to-cyan-400"
          animate={{ scale: [1, 1.08, 1], opacity: [0.85, 1, 0.85] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          style={{ boxShadow: '0 0 80px rgba(52, 211, 153, 0.45)' }}
        />
        <div className="absolute inset-0 rounded-full bg-emerald-400/20 blur-2xl animate-pulse" />
        <Mic className="absolute w-10 h-10 text-white drop-shadow-lg" />
      </div>

      <motion.p
        className="mt-8 text-white/60 text-sm font-medium tracking-widest uppercase"
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        Listening...
      </motion.p>

      <div className="flex items-center gap-1.5 mt-3 mb-12">
        {[0, 1, 2, 3, 4].map((i) => (
          <motion.div
            key={i}
            className="w-1 rounded-full bg-emerald-400"
            style={{ height: '8px' }}
            animate={{ height: ['8px', `${16 + i * 6}px`, '8px'] }}
            transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.1, ease: 'easeInOut' }}
          />
        ))}
      </div>

      <button
        onClick={onStop}
        className="px-8 py-3 rounded-full bg-white/10 border border-white/15 text-white/80 text-sm font-semibold hover:bg-white/20 active:scale-95 transition-all"
      >
        Stop listening
      </button>
    </motion.div>
  );
}

// Desktop Hero - Copilot style centered layout
export function DesktopHero() {
  const { sendMessage, createConversation } = useChatbot();
  const { data: session } = useSession();
  const firstName = session?.user?.name?.split(' ')[0] ?? 'there';
  const [inputVal, setInputVal] = useState('');

  const handleSend = (text: string) => {
    if (!text.trim()) return;
    createConversation();
    setTimeout(() => sendMessage(text), 80);
  };

  return (
    <motion.div
      className="flex-1 flex flex-col items-center justify-center px-8 py-12 relative overflow-hidden"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8, scale: 0.98 }}
      transition={{ duration: 0.4 }}
    >
      <div className="absolute top-0 left-0 w-96 h-96 bg-primary/5 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-80 h-80 bg-violet-500/5 rounded-full blur-[120px] pointer-events-none" />

      <motion.h1
        className="text-3xl lg:text-4xl font-extrabold text-white text-center tracking-tight mb-1"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
      >
        {getGreetingTime()}, {firstName}
      </motion.h1>
      <motion.p
        className="text-white/40 text-sm font-medium mb-9"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.12 }}
      >
        What can I help you with today?
      </motion.p>

      <motion.div
        className="w-full max-w-2xl"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.18 }}
      >
        <div className="flex items-center gap-3 bg-white/[0.04] border border-white/10 rounded-2xl px-4 py-3.5 focus-within:border-primary/30 focus-within:shadow-[0_0_40px_rgba(var(--primary-rgb),0.06)] transition-all duration-300 backdrop-blur-xl">
          <Sparkles className="w-4 h-4 text-primary/60 flex-shrink-0" />
          <input
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && inputVal.trim()) handleSend(inputVal);
            }}
            placeholder="Ask anything..."
            className="flex-1 bg-transparent text-white/90 placeholder-white/25 text-sm font-sans outline-none border-none focus:ring-0"
            autoFocus
          />
          <button
            onClick={() => handleSend(inputVal)}
            disabled={!inputVal.trim()}
            className="w-8 h-8 rounded-xl bg-primary disabled:bg-white/5 disabled:text-white/15 text-black flex items-center justify-center transition-all duration-200 active:scale-95"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </motion.div>

      <motion.div
        className="flex flex-wrap items-center justify-center gap-2 mt-5"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.28 }}
      >
        {QUICK_CHIPS.map(({ label, icon: Icon }) => (
          <button
            key={label}
            onClick={() => handleSend(label)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.08] text-white/55 text-xs font-medium hover:bg-primary/[0.06] hover:border-primary/20 hover:text-white/90 active:scale-95 transition-all duration-200"
          >
            <Icon className="w-3 h-3" />
            {label}
          </button>
        ))}
      </motion.div>

      <motion.div
        className="grid grid-cols-3 gap-3 mt-10 w-full max-w-2xl"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.38 }}
      >
        {SUGGESTION_CARDS.map(({ icon: Icon, title, subtitle, color, border }, i) => (
          <button
            key={i}
            onClick={() => handleSend(title)}
            className={cn(
              'flex flex-col items-start gap-2.5 p-4 rounded-2xl bg-gradient-to-br border text-left group hover:border-white/20 active:scale-[0.98] transition-all duration-300',
              color,
              border
            )}
          >
            <div className="w-8 h-8 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
              <Icon className="w-4 h-4 text-white/60" />
            </div>
            <div>
              <div className="text-xs font-semibold text-white/80 group-hover:text-white transition-colors leading-snug">{title}</div>
              <div className="text-[10px] text-white/35 mt-0.5">{subtitle}</div>
            </div>
          </button>
        ))}
      </motion.div>
    </motion.div>
  );
}