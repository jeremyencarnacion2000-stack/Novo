'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Edit, Trash2, CheckCircle2, Circle } from 'lucide-react';
import { Tracker } from '@/types/tracker';
import { useNotifications } from '@/lib/notification-context';
import { useNotificationScheduler } from '@/lib/notification-scheduler';
import { motion, AnimatePresence } from 'framer-motion';
import { sileo } from '@/lib/sileo-bell';

interface HabitTrackersProps {
  trackers: Tracker[];
  onEdit: (tracker: Tracker) => void;
  onDelete: (id: string) => void;
  onLogEntry: (id: string, value: number) => void;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  scale: number;
  rotate: number;
}

export function HabitTrackers({ trackers, onEdit, onDelete, onLogEntry }: HabitTrackersProps) {
  const { showNotification, settings: notificationSettings } = useNotifications();
  const { scheduleProgressAchievement } = useNotificationScheduler();

  const getLast7Days = () => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      days.push(date.toISOString().split('T')[0]);
    }
    return days;
  };

  const last7Days = getLast7Days();

  const handleLogEntry = (trackerId: string, value: number) => {
    const tracker = trackers.find(t => t.id === trackerId);
    if (!tracker) return;

    const wasCompletedToday = (Array.isArray(tracker.entries) ? tracker.entries : []).some(
      (e) => e.date === new Date().toISOString().split('T')[0]
    );

    // Log the entry
    onLogEntry(trackerId, value);

    if (value === 1 && !wasCompletedToday) {
      sileo.success({
        title: 'Habit Completed',
        description: `${tracker.name} marked as done for today.`,
        duration: 4000,
      })
    }

    // Check for achievements if this is a new completion
    if (value === 1 && !wasCompletedToday && notificationSettings.progressAchievements) {
      const progress = getWeeklyProgress(tracker);
      const newProgress = { completed: progress.completed + 1, total: progress.total };

      // Check for streak milestones
      if (newProgress.completed === 7) {
        showNotification('¡Racha de Hábito!', {
          body: `¡Felicidades! Has completado ${tracker.name} durante 7 días seguidos.`,
          tag: `habit-streak-${trackerId}`
        });
      } else if (newProgress.completed === 3) {
        showNotification('¡Hito de Hábito!', {
          body: `¡Buen trabajo! Has completado ${tracker.name} 3 días esta semana.`,
          tag: `habit-milestone-${trackerId}`
        });
      }
    }
  };

  const getWeeklyProgress = (tracker: Tracker) => {
    const completed = (Array.isArray(tracker.entries) ? tracker.entries : []).filter((e) =>
      last7Days.includes(e.date)
    ).length;
    return { completed, total: 7 };
  };

  if (trackers.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-14 gap-4 text-center">
          <div
            className="w-14 h-14 rounded-2xl border border-primary/20 flex items-center justify-center"
            style={{ background: 'rgba(99,102,241,0.08)', boxShadow: '0 0 32px rgba(99,102,241,0.12)' }}
          >
            <CheckCircle2 className="w-6 h-6 text-primary/70" />
          </div>
          <div className="max-w-xs space-y-1.5">
            <p className="text-sm font-bold text-foreground/80">Nada que medir todavía</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Crea tu primer hábito y el Twin empieza a ver tu consistencia real, no solo tu intención.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {trackers.map((tracker) => {
        const progress = getWeeklyProgress(tracker);
        const todayEntry = (Array.isArray(tracker.entries) ? tracker.entries : []).find(
          (e) => e.date === new Date().toISOString().split('T')[0]
        );

        return (
          <HabitCard
            key={tracker.id}
            tracker={tracker}
            progress={progress}
            todayEntry={todayEntry}
            last7Days={last7Days}
            onLog={handleLogEntry}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        );
      })}
    </div>
  );
}

/* Subcomponent handling rich visual particle explosions and card state */
function HabitCard({
  tracker,
  progress,
  todayEntry,
  last7Days,
  onLog,
  onEdit,
  onDelete
}: {
  tracker: Tracker;
  progress: { completed: number; total: number };
  todayEntry: any;
  last7Days: string[];
  onLog: (id: string, value: number) => void;
  onEdit: (t: Tracker) => void;
  onDelete: (id: string) => void;
}) {
  const [particles, setParticles] = useState<Particle[]>([]);

  const triggerExplosion = () => {
    // Generate 12 premium glassmorphic crystals expanding outwards
    const newParticles: Particle[] = Array.from({ length: 12 }).map((_, idx) => ({
      id: Date.now() + idx,
      x: (Math.random() - 0.5) * 180,
      y: (Math.random() - 0.5) * 110 - 25,
      scale: Math.random() * 0.7 + 0.35,
      rotate: Math.random() * 360,
    }));
    setParticles(newParticles);
    setTimeout(() => setParticles([]), 900);
  };

  const handleAction = () => {
    const isActivating = !todayEntry;
    if (isActivating) {
      triggerExplosion();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('habit-completed'));
      }
    }
    onLog(tracker.id, todayEntry ? 0 : 1);
  };

  return (
    <Card className="relative overflow-hidden border border-foreground/5 bg-foreground/[0.02] backdrop-blur-2xl transition-all duration-300 hover:border-foreground/10 hover:bg-foreground/[0.03]">
      {/* Dynamic Crystal Particles Container */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-30">
        <AnimatePresence>
          {particles.map((p) => (
            <motion.div
              key={p.id}
              initial={{ x: 0, y: 0, scale: 0.1, opacity: 1, rotate: 0 }}
              animate={{ x: p.x, y: p.y, scale: p.scale, opacity: 0, rotate: p.rotate }}
              exit={{ opacity: 0 }}
              transition={{
                type: 'spring',
                stiffness: 160,
                damping: 14,
                mass: 0.5,
              }}
              className="absolute w-3 h-3 rounded-[3px] bg-gradient-to-tr from-white/30 to-white/10 border border-white/50 backdrop-blur-sm shadow-[0_0_8px_rgba(255,255,255,0.4)]"
              style={{ left: '50%', top: '75%' }}
            />
          ))}
        </AnimatePresence>
      </div>

      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <CardTitle className="text-base font-bold tracking-tight text-foreground/90">
            {tracker.name}
          </CardTitle>

          {/* Elastic progress counter badge */}
          <motion.div
            key={progress.completed}
            initial={{ scale: 0.85, y: 0 }}
            animate={progress.completed > 0 ? { scale: [1, 1.25, 1], y: [-6, 0] } : { scale: 1 }}
            transition={{
              type: 'spring',
              stiffness: 450,
              damping: 15,
            }}
          >
            <Badge className="bg-foreground/5 hover:bg-foreground/10 text-foreground/80 border border-foreground/10 font-mono tracking-wide text-xs">
              {progress.completed}/{progress.total}
            </Badge>
          </motion.div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Weekly Grid with spring scale down/overshoot */}
        <div className="flex gap-1.5">
          {last7Days.map((date) => {
            const hasEntry = (Array.isArray(tracker.entries) ? tracker.entries : []).some(
              (e) => e.date === date
            );
            const isToday = date === new Date().toISOString().split('T')[0];

            return (
        <HabitDaySquare
                key={date}
                date={date}
                hasEntry={hasEntry}
                isToday={isToday}
                onToggle={() => onLog(tracker.id, hasEntry ? 0 : 1)}
              />
            );
          })}
        </div>

        {/* Confirmation Buttons and Actions */}
        <div className="flex gap-2">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleAction}
            className={`
              flex-1 h-9 rounded-xl flex items-center justify-center font-black uppercase text-[10px] tracking-wider transition-all duration-300 select-none cursor-pointer
              ${
                todayEntry
                  ? 'bg-foreground/10 hover:bg-foreground/15 text-foreground/95 border border-foreground/10'
                  : 'bg-primary text-primary-foreground hover:opacity-90'
              }
            `}
          >
            {todayEntry ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 mr-2 text-indigo-400" />
                Completed Today
              </>
            ) : (
              <>
                <Circle className="h-3.5 w-3.5 mr-2 text-foreground/70" />
                Mark Complete
              </>
            )}
          </motion.button>

          <Button
            variant="outline"
            size="sm"
            className="h-9 w-9 rounded-xl border border-foreground/5 bg-foreground/5 p-0 hover:bg-foreground/10"
            data-flip-from={`tracker-${tracker.id}`}
            onClick={() => onEdit(tracker)}
          >
            <Edit className="h-3.5 w-3.5 text-foreground/60" />
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="h-9 w-9 rounded-xl border border-foreground/5 bg-foreground/5 p-0 hover:bg-foreground/10"
            onClick={() => onDelete(tracker.id)}
          >
            <Trash2 className="h-3.5 w-3.5 text-red-400/80" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* Individual grid square subcomponent for perfect spring interactions */
function HabitDaySquare({
  date,
  hasEntry,
  isToday,
  onToggle
}: {
  date: string;
  hasEntry: boolean;
  isToday: boolean;
  onToggle: () => void;
}) {
  const [showRipple, setShowRipple] = useState(false);

  const handlePress = () => {
    if (!hasEntry) {
      setShowRipple(true);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('habit-completed'));
      }
      setTimeout(() => setShowRipple(false), 700);
    }
    onToggle();
  };

  const weekdayLabel = new Date(date).toLocaleDateString('en-US', { weekday: 'narrow' });

  return (
    <div className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
      <motion.button
        type="button"
        whileTap={{ scale: 0.8 }}
        animate={hasEntry ? { scale: [1, 1.22, 1], rotate: [0, 5, -5, 0] } : { scale: 1 }}
        transition={{
          type: 'spring',
          stiffness: 420,
          damping: 13, // Low damping for aggressive bounce overshoot
          mass: 0.45,
        }}
        onClick={handlePress}
        className={`
          w-full aspect-square rounded-lg flex items-center justify-center relative overflow-hidden transition-all duration-300 cursor-pointer select-none outline-none
          ${
            hasEntry
              ? 'bg-primary text-primary-foreground'
              : isToday
              ? 'bg-foreground/[0.03] border border-primary/40 ring-1 ring-primary/30 hover:bg-foreground/[0.08]'
              : 'bg-foreground/[0.03] border border-foreground/[0.04] hover:bg-foreground/[0.08] hover:border-foreground/10'
          }
        `}
      >
        {/* Pulse Ripple overlay */}
        <AnimatePresence>
          {showRipple && (
            <motion.span
              initial={{ scale: 0.4, opacity: 0.9 }}
              animate={{ scale: 2.2, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.55, ease: 'easeOut' }}
              className="absolute inset-0 rounded-full bg-gradient-to-r from-purple-400 to-indigo-400 pointer-events-none"
            />
          )}
        </AnimatePresence>

        {hasEntry ? (
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 14 }}
          >
            <CheckCircle2 className="h-3.5 w-3.5 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.2)]" />
          </motion.div>
        ) : (
          <Circle className="h-3 w-3 text-foreground/20 group-hover:text-foreground/40" />
        )}
      </motion.button>

      <span className="text-[10px] font-bold text-foreground/40 tracking-wider">
        {weekdayLabel}
      </span>
    </div>
  );
}
