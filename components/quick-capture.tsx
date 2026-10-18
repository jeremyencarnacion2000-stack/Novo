'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { GlassSurface } from '@/components/ui/GlassSurface';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import {
    PenLine, X, Lightbulb, CheckSquare, Bell, FileText,
    Send, Archive, Trash2, ChevronRight, Calendar, Layers, Plus, Check,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';
import { useQuickCapture } from '@/lib/quick-capture-context';
import { cn } from '@/lib/utils';
import { createClientIdempotencyKey } from '@/lib/client-idempotency';

type NoteType = 'note' | 'idea' | 'task' | 'reminder';
type TabView = 'capture' | 'saved' | 'attributes';

const typeConfig = {
    note: { icon: FileText, color: 'bg-blue-500', label: 'Note' },
    idea: { icon: Lightbulb, color: 'bg-yellow-500', label: 'Idea' },
    task: { icon: CheckSquare, color: 'bg-green-500', label: 'Task' },
    reminder: { icon: Bell, color: 'bg-amber-500', label: 'Reminder' },
};

interface SavedNote {
    id: string;
    content: string;
    type: NoteType;
    createdAt: string;
    tags?: string[];
}

export function QuickCapture() {
    const { isOpen, onClose, originRef } = useQuickCapture();
    const [content, setContent] = useState('');
    const [type, setType] = useState<NoteType>('note');
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<TabView>('capture');
    const [savedNotes, setSavedNotes] = useState<SavedNote[]>([]);
    const [loadingNotes, setLoadingNotes] = useState(false);
    const [filterType, setFilterType] = useState<NoteType | 'all'>('all');
    const [saveAndContinue, setSaveAndContinue] = useState(false);
    const [revealedNoteId, setRevealedNoteId] = useState<string | null>(null);

    // Attributes step state
    const [selectedProject, setSelectedProject] = useState<string | null>(null);
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [projects, setProjects] = useState<any[]>([]);

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const createIntentKey = useRef<string | null>(null);
    const notesRequestRef = useRef<AbortController | null>(null);
    const { toast } = useToast();

    // Escape closes the on-demand surface; the shell owns the global open
    // shortcut so this heavier module does not need to be loaded for it.
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    // Focus textarea when opened
    useEffect(() => {
        if (isOpen && activeTab === 'capture' && textareaRef.current) {
            textareaRef.current.focus();
        }
    }, [isOpen, activeTab]);

    // Load projects for attribution
    useEffect(() => {
        if (isOpen && type === 'task') {
            const controller = new AbortController();
            fetch('/api/projects', { signal: controller.signal, cache: 'no-store' })
                .then(res => res.ok ? res.json() : [])
                .then(data => {
                    if (!controller.signal.aborted) setProjects(Array.isArray(data) ? data : []);
                })
                .catch((error: unknown) => {
                    if ((error as { name?: string })?.name !== 'AbortError') setProjects([]);
                });
            return () => controller.abort();
        }
        setProjects([]);
    }, [isOpen, type]);

    const loadNotes = useCallback(async () => {
        notesRequestRef.current?.abort();
        const controller = new AbortController();
        notesRequestRef.current = controller;
        setLoadingNotes(true);
        try {
            const res = await fetch('/api/notes', { signal: controller.signal, cache: 'no-store' });
            if (res.ok && !controller.signal.aborted) {
                const data = await res.json();
                if (!controller.signal.aborted) setSavedNotes(Array.isArray(data) ? data : []);
            }
        } catch (error: unknown) {
            if ((error as { name?: string })?.name !== 'AbortError') console.error('Failed to load notes');
        } finally {
            if (notesRequestRef.current === controller) {
                notesRequestRef.current = null;
                setLoadingNotes(false);
            }
        }
    }, []);

    useEffect(() => () => {
        const controller = notesRequestRef.current;
        notesRequestRef.current = null;
        controller?.abort();
    }, []);

    useEffect(() => {
        if (isOpen && activeTab === 'saved') {
            loadNotes();
        }
    }, [isOpen, activeTab, loadNotes]);

    const handleSave = async () => {
        if (!content.trim() || saving) return;
        const intentKey = createIntentKey.current || createClientIdempotencyKey();
        createIntentKey.current = intentKey;
        setSaving(true);
        try {
            const response = await fetch('/api/notes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Idempotency-Key': intentKey },
                body: JSON.stringify({
                    content,
                    type,
                    projectId: selectedProject,
                    dueDate: selectedDate,
                }),
            });
            if (response.ok) {
                createIntentKey.current = null;
                toast({
                    title: 'Saved!',
                    description: `${typeConfig[type].label} captured successfully.`,
                });
                setContent('');
                setSelectedProject(null);
                setSelectedDate(null);
                setActiveTab('capture');

                if (!saveAndContinue) {
                    onClose();
                } else {
                    loadNotes();
                }
            } else {
                throw new Error('Failed to save');
            }
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to capture note',
                variant: 'destructive',
            });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            const res = await fetch(`/api/notes/${id}`, {
                method: 'DELETE',
            });
            if (res.ok) {
                toast({
                    title: 'Deleted',
                    description: 'Note removed successfully.',
                });
                loadNotes();
            }
        } catch (e) {
            console.error('Failed to delete note:', e);
            toast({
                title: 'Error',
                description: 'Failed to delete note',
                variant: 'destructive',
            });
        }
    };

    const handleNext = () => {
        if (type === 'task') {
            setActiveTab('attributes');
        } else {
            handleSave();
        }
    }

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            handleNext();
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent
                motionPreset="command"
                mobilePresentation="sheet"
                showCloseButton={false}
                anchorRef={originRef}
                aria-describedby="quick-capture-description"
                className="relative max-h-[calc(100dvh-2rem)] w-full max-w-xl overflow-y-auto rounded-[30px] border-0 bg-transparent p-0 shadow-none"
            >
                        <GlassSurface
                            preset="panel"
                            refractive
                            radius={30}
                            depth={8}
                            strength={42}
                            chromaticAberration={1.5}
                            refractivePriority="interactive"
                            webComponent
                            backgroundColor="var(--novo-context-background)"
                            elevation="low"
                            aria-hidden
                            className="pointer-events-none"
                            style={{ position: 'absolute', inset: 0, zIndex: 0, borderRadius: 'inherit' }}
                        />
                        <div className="relative z-10 space-y-4 px-6 pt-6 pb-1">
                            <div className="flex items-start justify-between gap-4">
                                <div className="min-w-0">
                                    <DialogTitle className="text-lg font-semibold tracking-tight text-foreground">Quick capture</DialogTitle>
                                    <DialogDescription id="quick-capture-description" className="mt-1 text-sm leading-5 text-muted-foreground">Save a thought before it slips away.</DialogDescription>
                                </div>
                                <button
                                    type="button"
                                    onClick={onClose}
                                    aria-label="Close quick capture"
                                    className="-mr-2 -mt-2 inline-flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/25"
                                >
                                    <X className="size-4" />
                                </button>
                            </div>
                            <div role="group" aria-label="Quick capture view" className="inline-flex w-fit gap-1 rounded-full border border-foreground/[0.09] bg-foreground/[0.035] p-1">
                                <button
                                    type="button"
                                    aria-pressed={activeTab === 'capture'}
                                    onClick={() => setActiveTab('capture')}
                                    className={cn("min-h-9 rounded-full px-3.5 text-xs font-medium transition-colors", activeTab === 'capture' ? "bg-foreground/[0.09] text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
                                >
                                    Capture
                                </button>
                                <button
                                    type="button"
                                    aria-pressed={activeTab === 'saved'}
                                    onClick={() => setActiveTab('saved')}
                                    className={cn("min-h-9 rounded-full px-3.5 text-xs font-medium transition-colors", activeTab === 'saved' ? "bg-foreground/[0.09] text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
                                >
                                    History
                                </button>
                            </div>
                        </div>

                        {activeTab === 'capture' && (
                            <div className="relative z-10 space-y-5 px-6 pt-3 pb-6">
                                {/* Content Area */}
                                <div className="space-y-3">
                                    <Textarea
                                        ref={textareaRef}
                                        placeholder={type === 'task' ? "What needs to be done?" : "Write a thought, idea or reminder…"}
                                        value={content}
                                        onChange={(e) => setContent(e.target.value)}
                                        onKeyDown={handleKeyPress}
                                        className="min-h-[132px] resize-y rounded-2xl border border-foreground/[0.09] bg-foreground/[0.035] p-4 text-base font-medium leading-6 text-foreground placeholder:text-muted-foreground/80 focus-visible:border-foreground/[0.16] focus-visible:ring-2 focus-visible:ring-foreground/[0.12] md:text-lg"
                                    />

                                    {/* Type Strip */}
                                    <div role="group" aria-label="Capture type" className="grid w-full grid-cols-2 gap-1 rounded-2xl border border-foreground/[0.09] bg-foreground/[0.025] p-1 sm:grid-cols-4">
                                        {(Object.keys(typeConfig) as NoteType[]).map((t) => {
                                            const { icon: Icon, label } = typeConfig[t];
                                            const isSelected = type === t;
                                            return (
                                                <button
                                                    type="button"
                                                    key={t}
                                                    aria-pressed={isSelected}
                                                    onClick={() => setType(t)}
                                                    className={cn(
                                                        "flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-xl px-3 text-xs font-medium transition-colors btn-press",
                                                        isSelected ? "bg-foreground/[0.09] text-foreground shadow-sm ring-1 ring-inset ring-foreground/[0.12]" : "text-muted-foreground hover:bg-foreground/[0.045] hover:text-foreground"
                                                    )}
                                                >
                                                    <Icon className="size-3.5 shrink-0" />
                                                    <span className="truncate">{label}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Footer Actions */}
                                <div className="flex flex-col-reverse gap-3 border-t border-foreground/[0.09] pt-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                                    <div className="flex items-center gap-4">
                                        <label className="group inline-flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg pr-2 text-muted-foreground transition-colors hover:text-foreground">
                                            <input type="checkbox" className="peer sr-only" checked={saveAndContinue} onChange={() => setSaveAndContinue(!saveAndContinue)} />
                                            <span aria-hidden="true" className={cn("inline-flex size-[18px] items-center justify-center rounded-[5px] border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-foreground/25", saveAndContinue ? "border-primary/70 bg-primary/80" : "border-foreground/20 group-hover:border-foreground/40")}>
                                                {saveAndContinue && <Check className="h-3 w-3 text-primary-foreground" />}
                                            </span>
                                            <span className="text-xs font-medium">Keep capturing</span>
                                        </label>
                                    </div>

                                    <Button
                                        ripple
                                        onClick={handleNext}
                                        disabled={!content.trim() || saving}
                                        className="h-11 rounded-full bg-primary px-5 text-sm font-semibold tracking-normal text-primary-foreground hover:bg-primary/90 sm:min-w-40 btn-press"
                                    >
                                        {type === 'task' ? 'Set details' : `Save ${type}`}
                                        <ChevronRight className="ml-1.5 size-4" />
                                    </Button>
                                </div>
                            </div>
                        )}

                        {activeTab === 'attributes' && (
                            <motion.div
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="relative z-10 p-8 space-y-8"
                            >
                                <div className="space-y-4">
                                    <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.3em]">Project Context</h3>
                                    <div className="grid grid-cols-2 gap-3">
                                        {projects.slice(0, 4).map(p => (
                                            <button
                                                key={p.id}
                                                onClick={() => setSelectedProject(p.id)}
                                                className={cn(
                                                    "flex items-center gap-3 p-4 rounded-2xl border transition-all text-left",
                                                    selectedProject === p.id ? "bg-primary/20 border-primary text-primary" : "bg-muted/60 border-border/70 text-muted-foreground hover:border-foreground/20"
                                                )}
                                            >
                                                <Layers className="h-4 w-4" />
                                                <span className="text-xs font-bold truncate">{p.title}</span>
                                            </button>
                                        ))}
                                        <button className="flex items-center gap-3 p-4 rounded-2xl border border-dashed border-border text-muted-foreground hover:border-foreground/40 transition-colors">
                                            <Plus className="h-4 w-4" />
                                            <span className="text-xs font-bold">New Project</span>
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.3em]">Temporal State</h3>
                                    <div className="flex gap-3">
                                        {['Today', 'Tomorrow', 'Next Week'].map(d => (
                                            <button
                                                key={d}
                                                onClick={() => setSelectedDate(d)}
                                                className={cn(
                                                    "px-6 py-3 rounded-xl border text-[10px] font-bold uppercase tracking-wider transition-all",
                                                    selectedDate === d ? "bg-primary border-primary text-primary-foreground" : "bg-muted/60 border-border/70 text-muted-foreground hover:border-foreground/20"
                                                )}
                                            >
                                                {d}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="pt-6 border-t border-border/70 flex gap-4">
                                    <Button
                                        variant="ghost"
                                        onClick={() => setActiveTab('capture')}
                                        className="h-12 rounded-2xl text-muted-foreground hover:text-foreground"
                                    >
                                        BACK
                                    </Button>
                                    <Button
                                        ripple
                                        onClick={handleSave}
                                        className="flex-1 h-12 rounded-2xl bg-primary text-primary-foreground font-black tracking-tighter italic"
                                    >
                                        LEGALIZE ACTION
                                    </Button>
                                </div>
                            </motion.div>
                        )}

                        {activeTab === 'saved' && (
                            <div className="p-8 max-h-[400px] overflow-y-auto space-y-4 pb-12 relative z-10">
                                {savedNotes.map(note => (
                                    <SwipeToDeleteNote
                                        key={note.id}
                                        note={note}
                                        revealed={revealedNoteId === note.id}
                                        onReveal={() => setRevealedNoteId(note.id)}
                                        onReset={() => setRevealedNoteId(null)}
                                        onDelete={() => {
                                            setRevealedNoteId(null)
                                            void handleDelete(note.id)
                                        }}
                                    />
                                ))}
                            </div>
                        )}
            </DialogContent>
        </Dialog>
    );
}

/**
 * Mobile-first destructive affordance for saved captures.
 * The row follows the finger, exposes a clear red action and springs back when
 * the gesture does not cross the threshold. The explicit button remains
 * available for mouse, keyboard and assistive technology users.
 */
function SwipeToDeleteNote({
    note,
    revealed,
    onReveal,
    onReset,
    onDelete,
}: {
    note: SavedNote
    revealed: boolean
    onReveal: () => void
    onReset: () => void
    onDelete: () => void
}) {
    const config = typeConfig[note.type] ?? typeConfig.note

    return (
        <div className="relative overflow-hidden rounded-2xl bg-destructive/10">
            <div className="absolute inset-y-0 right-0 flex w-[84px] items-center justify-center bg-destructive text-destructive-foreground">
                <button
                    type="button"
                    aria-label={`Delete ${note.content}`}
                    onClick={onDelete}
                    className="flex h-full w-full flex-col items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-[0.12em] transition-colors hover:bg-destructive/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive-foreground/80"
                >
                    <Trash2 className="h-4 w-4" />
                    Delete
                </button>
            </div>

            <motion.div
                drag="x"
                dragConstraints={{ left: -84, right: 0 }}
                dragElastic={0.08}
                dragMomentum={false}
                animate={{ x: revealed ? -84 : 0 }}
                transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.7 }}
                onDragEnd={(_, info) => {
                    if (info.offset.x < -48 || info.velocity.x < -420) onReveal()
                    else onReset()
                }}
                className="group relative z-10 flex items-start gap-4 rounded-2xl border border-border/70 bg-muted/60 p-4 shadow-sm touch-pan-y"
            >
                <div className={cn("mt-1 flex h-8 w-8 items-center justify-center rounded-lg", config.color + "/20")}>
                    <PenLine className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-medium">{note.content}</p>
                    <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        {new Date(note.createdAt).toLocaleDateString()}
                    </p>
                </div>
                <button
                    type="button"
                    aria-label={`Delete ${note.content}`}
                    onClick={onDelete}
                    className="shrink-0 rounded-lg p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:opacity-0 sm:group-hover:opacity-100"
                >
                    <Trash2 className="h-3.5 w-3.5" />
                </button>
            </motion.div>
        </div>
    )
}
