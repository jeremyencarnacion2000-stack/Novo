'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Sun, AlertTriangle, CheckCircle2, Circle, Clock,
    ListChecks, FolderKanban, GraduationCap, Pencil,
    ChevronRight, Flame, Target, Zap, Link2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────
interface IntegratedTask {
    id: string;
    text: string;
    completed: boolean;
    priority: 'low' | 'medium' | 'high';
    source: 'routine' | 'project' | 'manual' | 'school' | 'notion';
    sourceId: string;
    dueDate?: string;
    timeOfDay?: string;
    metadata?: {
        projectTitle?: string;
        routineName?: string;
        courseCode?: string;
        category?: string;
    };
}

interface UrgentItem {
    id: string;
    title: string;
    dueDate: string;
    type: string;
    courseName: string;
    courseCode: string;
    urgencyLevel: 'critical' | 'high' | 'medium';
    weight?: number;
}

// ─── Skeleton ────────────────────────────────────────────────────────────────
function TodaySkeleton() {
    return (
        <div className="flex flex-col gap-6 animate-pulse">
            {/* Header skeleton */}
            <div className="flex items-center justify-between">
                <div className="space-y-2">
                    <div className="h-8 w-32 bg-white/5 rounded-2xl" />
                    <div className="h-4 w-48 bg-white/[0.03] rounded-xl" />
                </div>
                <div className="h-16 w-16 bg-white/5 rounded-2xl" />
            </div>
            {/* Progress skeleton */}
            <div className="h-2 w-full bg-white/5 rounded-full" />
            {/* Card skeletons */}
            {[1, 2, 3].map(i => (
                <div key={i} className="h-40 bg-white/[0.03] rounded-3xl border border-white/5" />
            ))}
        </div>
    );
}

// ─── Progress Ring ────────────────────────────────────────────────────────────
function ProgressRing({ progress, completed, total }: { progress: number; completed: number; total: number }) {
    const r = 28;
    const circ = 2 * Math.PI * r;
    const offset = circ - (progress / 100) * circ;
    return (
        <div className="relative flex items-center justify-center w-16 h-16">
            <svg width="64" height="64" className="-rotate-90">
                <circle cx="32" cy="32" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="4" />
                <circle
                    cx="32" cy="32" r={r} fill="none"
                    stroke="var(--primary)" strokeWidth="4"
                    strokeDasharray={circ} strokeDashoffset={offset}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 0.6s ease' }}
                />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-sm font-black text-foreground leading-none">{completed}</span>
                <span className="text-[9px] text-muted-foreground font-medium">/{total}</span>
            </div>
        </div>
    );
}

// ─── Priority pill ───────────────────────────────────────────────────────────
function PriorityPill({ priority }: { priority: string }) {
    const map: Record<string, string> = {
        high: 'bg-red-500/10 text-red-400 border-red-500/20',
        medium: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
        low: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    };
    return (
        <span className={cn('text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full border', map[priority] ?? map.low)}>
            {priority}
        </span>
    );
}

// ─── Source icon ─────────────────────────────────────────────────────────────
function SourceIcon({ source }: { source: string }) {
    const map: Record<string, React.ReactNode> = {
        routine: <ListChecks className="w-3 h-3" />,
        project: <FolderKanban className="w-3 h-3" />,
        school:  <GraduationCap className="w-3 h-3" />,
        manual:  <Pencil className="w-3 h-3" />,
        notion:  <Link2 className="w-3 h-3" />,
    };
    return <span className="text-foreground/30">{map[source] ?? map.manual}</span>;
}

// ─── Task Row ────────────────────────────────────────────────────────────────
function TaskRow({ task, onToggle }: { task: IntegratedTask; onToggle: (t: IntegratedTask) => void }) {
    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-2xl transition-colors duration-200 group cursor-pointer select-none',
                task.completed
                    ? 'bg-white/[0.01] opacity-50'
                    : 'hover:bg-white/[0.04] active:bg-white/[0.06]'
            )}
            onClick={() => onToggle(task)}
        >
            {/* Checkbox */}
            <div className={cn(
                'flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-200',
                task.completed
                    ? 'bg-primary border-primary'
                    : 'border-white/20 group-hover:border-primary/60'
            )}>
                <AnimatePresence>
                    {task.completed && (
                        <motion.div
                            initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                            transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                        >
                            <CheckCircle2 className="w-3.5 h-3.5 text-white fill-white" />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <p className={cn(
                    'text-sm font-medium truncate transition-all duration-200',
                    task.completed ? 'line-through text-foreground/20' : 'text-foreground/80'
                )}>
                    {task.text}
                </p>
                {task.metadata && (
                    <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                        <SourceIcon source={task.source} />
                        {task.metadata.routineName || task.metadata.projectTitle || task.metadata.courseCode}
                    </p>
                )}
            </div>

            {/* Priority */}
            <PriorityPill priority={task.priority} />
        </motion.div>
    );
}

// ─── Section Card ─────────────────────────────────────────────────────────────
const sectionMeta: Record<string, { label: string; icon: React.ReactNode; accent: string }> = {
    morning:   { label: 'Mañana',    icon: <Sun className="w-4 h-4" />,           accent: 'text-amber-400' },
    afternoon: { label: 'Tarde',     icon: <Zap className="w-4 h-4" />,           accent: 'text-orange-400' },
    evening:   { label: 'Noche',     icon: <Circle className="w-4 h-4" />,        accent: 'text-indigo-400' },
    anytime:   { label: 'Cuando sea',icon: <Clock className="w-4 h-4" />,         accent: 'text-foreground/40' },
    project:   { label: 'Proyectos', icon: <FolderKanban className="w-4 h-4" />, accent: 'text-blue-400' },
    school:    { label: 'Escuela',   icon: <GraduationCap className="w-4 h-4" />,accent: 'text-violet-400' },
    manual:    { label: 'Manual',    icon: <Pencil className="w-4 h-4" />,        accent: 'text-foreground/50' },
    notion:    { label: 'Notion',    icon: <Link2 className="w-4 h-4" />,        accent: 'text-teal-400' },
};

function SectionCard({
    sectionKey, tasks, onToggle,
}: {
    sectionKey: string;
    tasks: IntegratedTask[];
    onToggle: (t: IntegratedTask) => void;
}) {
    const [open, setOpen] = useState(true);
    const meta = sectionMeta[sectionKey] ?? { label: sectionKey, icon: <ListChecks className="w-4 h-4" />, accent: 'text-foreground/50' };
    const done = tasks.filter(t => t.completed).length;

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="liquid-glass rounded-3xl overflow-hidden"
        >
            {/* Section header */}
            <button
                onClick={() => setOpen(o => !o)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/[0.02] transition-colors"
            >
                <div className="flex items-center gap-2.5">
                    <span className={meta.accent}>{meta.icon}</span>
                    <span className="text-xs font-black tracking-widest uppercase text-foreground/60">{meta.label}</span>
                    <span className="text-[10px] text-muted-foreground font-medium">{done}/{tasks.length}</span>
                </div>
                <ChevronRight className={cn('w-4 h-4 text-muted-foreground transition-transform duration-300', open && 'rotate-90')} />
            </button>

            {/* Tasks */}
            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: 'easeInOut' }}
                        className="overflow-hidden"
                    >
                        <div className="px-2 pb-3 flex flex-col gap-0.5">
                            {tasks.map(task => (
                                <TaskRow key={task.id} task={task} onToggle={onToggle} />
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

// ─── Urgent Banner ────────────────────────────────────────────────────────────
function UrgentBanner({ items }: { items: UrgentItem[] }) {
    const urgencyStyle: Record<string, string> = {
        critical: 'bg-red-500/8 border-red-500/20 text-red-400',
        high:     'bg-orange-500/8 border-orange-500/20 text-orange-400',
        medium:   'bg-amber-500/8 border-amber-500/20 text-amber-400',
    };
    return (
        <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl border border-red-500/15 overflow-hidden"
            style={{ background: 'rgba(239,68,68,0.04)', backdropFilter: 'blur(12px)' }}
        >
            <div className="flex items-center gap-2.5 px-5 py-4 border-b border-red-500/10">
                <Flame className="w-4 h-4 text-red-400 animate-pulse" />
                <span className="text-xs font-black tracking-widest uppercase text-red-400/80">Urgente</span>
                <span className="text-[10px] text-red-400/40">{items.length} pendiente{items.length > 1 ? 's' : ''}</span>
            </div>
            <div className="px-4 py-3 flex flex-col gap-2">
                {items.map(item => (
                    <div key={item.id} className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground/75 truncate">
                                {item.courseCode}: {item.title}
                            </p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                                Vence: {new Date(item.dueDate).toLocaleDateString('es', { weekday: 'short', month: 'short', day: 'numeric' })}
                            </p>
                        </div>
                        <span className={cn('text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full border flex-shrink-0', urgencyStyle[item.urgencyLevel] ?? urgencyStyle.medium)}>
                            {item.urgencyLevel}
                        </span>
                    </div>
                ))}
            </div>
        </motion.div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function TodayPage() {
    const { toast } = useToast();
    const [tasks, setTasks] = useState<IntegratedTask[]>([]);
    const [urgentItems, setUrgentItems] = useState<UrgentItem[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        try {
            const [todayRes, urgentRes] = await Promise.all([
                fetch('/api/integration/today'),
                fetch('/api/integration/urgent'),
            ]);
            if (todayRes.ok) {
                const { tasks: t } = await todayRes.json();
                setTasks(t ?? []);
            }
            if (urgentRes.ok) {
                const { urgentItems: u } = await urgentRes.json();
                setUrgentItems(u ?? []);
            }
        } catch {
            toast({
                title: 'No se pudo cargar tus tareas',
                description: 'Revisa tu conexión e intenta de nuevo.',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const handleToggle = async (task: IntegratedTask) => {
        setTasks(prev => prev.map(t => t.id === task.id ? { ...t, completed: !t.completed } : t));
        try {
            const res = await fetch('/api/integration/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ taskId: task.id, completed: !task.completed }),
            });
            if (!res.ok) throw new Error();
        } catch {
            setTasks(prev => prev.map(t => t.id === task.id ? { ...t, completed: task.completed } : t));
            toast({ title: 'No se pudo actualizar la tarea', description: 'Intenta de nuevo.', variant: 'destructive' });
        }
    };

    const completed = tasks.filter(t => t.completed).length;
    const total = tasks.length;
    const progress = total > 0 ? (completed / total) * 100 : 0;

    // Group tasks
    const routines = tasks.filter(t => t.source === 'routine');
    const groups: Array<{ key: string; tasks: IntegratedTask[] }> = [
        { key: 'morning',   tasks: routines.filter(t => t.timeOfDay === 'morning') },
        { key: 'afternoon', tasks: routines.filter(t => t.timeOfDay === 'afternoon') },
        { key: 'evening',   tasks: routines.filter(t => t.timeOfDay === 'evening') },
        { key: 'anytime',   tasks: routines.filter(t => t.timeOfDay === 'anytime') },
        { key: 'project',   tasks: tasks.filter(t => t.source === 'project') },
        { key: 'school',    tasks: tasks.filter(t => t.source === 'school') },
        { key: 'manual',    tasks: tasks.filter(t => t.source === 'manual') },
        { key: 'notion',    tasks: tasks.filter(t => t.source === 'notion') },
    ].filter(g => g.tasks.length > 0);

    const dayLabel = new Date().toLocaleDateString('es', { weekday: 'long', month: 'long', day: 'numeric' });

    return (
        <div className="flex flex-col gap-5 max-w-2xl mx-auto">

            {/* ── Header ─────────────────────────────────────────────────── */}
            <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start justify-between gap-4"
            >
                <div>
                    <h1 className="text-2xl font-black tracking-tight text-foreground/90">Hoy</h1>
                    <p className="text-xs text-muted-foreground font-medium mt-0.5 capitalize">{dayLabel}</p>
                </div>

                {loading ? (
                    <div className="w-16 h-16 rounded-2xl bg-white/5 animate-pulse" />
                ) : (
                    <ProgressRing progress={progress} completed={completed} total={total} />
                )}
            </motion.div>

            {/* ── Progress bar ────────────────────────────────────────────── */}
            {!loading && total > 0 && (
                <motion.div
                    initial={{ opacity: 0, scaleX: 0 }}
                    animate={{ opacity: 1, scaleX: 1 }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                    className="relative h-1.5 w-full rounded-full overflow-hidden bg-white/[0.05]"
                    style={{ transformOrigin: 'left' }}
                >
                    <motion.div
                        className="absolute inset-y-0 left-0 rounded-full bg-primary"
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.6, ease: 'easeOut', delay: 0.2 }}
                        style={{ boxShadow: '0 0 8px var(--primary)' }}
                    />
                </motion.div>
            )}

            {/* ── Stats strip ─────────────────────────────────────────────── */}
            {!loading && total > 0 && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.15 }}
                    className="grid grid-cols-1 sm:grid-cols-3 gap-2"
                >
                    {[
                        { label: 'Total', value: total, icon: <Target className="w-3.5 h-3.5" /> },
                        { label: 'Completadas', value: completed, icon: <CheckCircle2 className="w-3.5 h-3.5 text-primary" /> },
                        { label: 'Restantes', value: total - completed, icon: <Circle className="w-3.5 h-3.5 text-muted-foreground" /> },
                    ].map(stat => (
                        <div
                            key={stat.label}
                            className="liquid-glass flex flex-col gap-1 px-4 py-3 rounded-2xl border border-white/[0.06]"
                            style={{ background: 'rgba(255,255,255,0.015)' }}
                        >
                            <span className="text-muted-foreground flex items-center gap-1">{stat.icon}
                                <span className="text-[9px] font-black tracking-widest uppercase">{stat.label}</span>
                            </span>
                            <span className="text-xl font-black text-foreground/80 tabular-nums">{stat.value}</span>
                        </div>
                    ))}
                </motion.div>
            )}

            {/* ── Loading skeleton ─────────────────────────────────────────── */}
            {loading && <TodaySkeleton />}

            {/* ── Urgent banner ────────────────────────────────────────────── */}
            {!loading && urgentItems.length > 0 && (
                <UrgentBanner items={urgentItems} />
            )}

            {/* ── Task sections ────────────────────────────────────────────── */}
            {!loading && groups.map((g, i) => (
                <motion.div
                    key={g.key}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 * i }}
                >
                    <SectionCard sectionKey={g.key} tasks={g.tasks} onToggle={handleToggle} />
                </motion.div>
            ))}

            {/* ── Empty state ──────────────────────────────────────────────── */}
            {!loading && total === 0 && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center justify-center py-20 gap-5 text-center"
                >
                    <div className="w-16 h-16 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center"
                        style={{ boxShadow: '0 0 32px rgba(99,102,241,0.12)' }}>
                        <CheckCircle2 className="w-7 h-7 text-primary" />
                    </div>
                    <div className="max-w-sm space-y-2">
                        <p className="text-base font-bold text-foreground/80">You have a clear day</p>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            No tasks are scheduled. This is a good moment to build structure —
                            Novo will automatically surface tomorrow's priorities once you set up routines.
                        </p>
                    </div>
                    {/* Forward action */}
                    <div
                        className="flex items-center gap-2 px-4 py-2.5 rounded-full border border-white/[0.08] text-xs font-semibold text-foreground/40 cursor-default"
                        style={{ background: 'rgba(255,255,255,0.025)' }}
                    >
                        <ChevronRight className="w-3.5 h-3.5 text-primary/60" />
                        Go to <span className="text-primary/80 font-black">Routines</span> to build your consistency layer
                    </div>
                </motion.div>
            )}

            {/* Bottom padding for mobile nav */}
            <div className="h-4" />
        </div>
    );
}
