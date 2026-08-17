'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { GlassSurface } from '@/components/ui/GlassSurface';
import {
    PenLine, X, Lightbulb, CheckSquare, Bell, FileText,
    Send, Archive, Trash2, ChevronRight, Calendar, Layers, Plus, Check,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';
import { useQuickCapture } from '@/lib/quick-capture-context';
import { cn } from '@/lib/utils';
import { useDragToDismiss } from '@/hooks/use-drag-to-dismiss';

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
    const { isOpen, onClose, onOpen } = useQuickCapture();
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
    const { toast } = useToast();
    const dragSurfaceRef = useDragToDismiss<HTMLDivElement>({
        onDismiss: onClose,
        enabled: isOpen,
    });

    // Keyboard shortcut: CMD/CTRL + Shift + N
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'n') {
                e.preventDefault();
                if (isOpen) onClose();
                else onOpen();
            }
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose, onOpen]);

    // Focus textarea when opened
    useEffect(() => {
        if (isOpen && activeTab === 'capture' && textareaRef.current) {
            textareaRef.current.focus();
        }
    }, [isOpen, activeTab]);

    // Load projects for attribution
    useEffect(() => {
        if (isOpen && type === 'task') {
            fetch('/api/projects').then(res => res.json()).then(data => {
                setProjects(Array.isArray(data) ? data : []);
            });
        }
    }, [isOpen, type]);

    const loadNotes = useCallback(async () => {
        setLoadingNotes(true);
        try {
            const res = await fetch('/api/notes');
            if (res.ok) {
                const data = await res.json();
                setSavedNotes(Array.isArray(data) ? data : []);
            }
        } catch (e) {
            console.error('Failed to load notes:', e);
        }
        setLoadingNotes(false);
    }, []);

    useEffect(() => {
        if (isOpen && activeTab === 'saved') {
            loadNotes();
        }
    }, [isOpen, activeTab, loadNotes]);

    const handleSave = async () => {
        if (!content.trim()) return;
        setSaving(true);
        try {
            const response = await fetch('/api/notes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content,
                    type,
                    projectId: selectedProject,
                    dueDate: selectedDate
                }),
            });
            if (response.ok) {
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

    if (typeof document === 'undefined') return null;

    return createPortal((
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        data-modal-drag-overlay
                        className="fixed inset-0 z-[5000] bg-black/60 backdrop-blur-sm"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        onClick={onClose}
                    />

                    {/* Modal (Floating like Raycast/Spotlight) */}
                    <div className="fixed inset-0 z-[5001] flex items-center justify-center p-4 pointer-events-none">
                    <motion.div
                        ref={dragSurfaceRef}
                        className="relative pointer-events-auto w-full max-w-xl max-h-[calc(100dvh-2rem)] overflow-y-auto bg-popover/90 border border-transparent rounded-[32px] shadow-[0_30px_100px_-20px_rgba(0,0,0,0.32)]"
                        initial={{ opacity: 0, y: -20, scale: 0.94, filter: 'blur(4px)' }}
                        animate={{
                            opacity: 1,
                            y: 0,
                            scale: 1,
                            filter: 'blur(0px)',
                            transition: {
                                type: 'spring',
                                stiffness: 380,
                                damping: 30,
                            }
                        }}
                        exit={{
                            opacity: 0,
                            y: -12,
                            scale: 0.96,
                            filter: 'blur(3px)',
                            transition: {
                                duration: 0.2,
                                ease: 'easeOut'
                            }
                        }}
                    >
                        <GlassSurface
                            radius={32}
                            depth={12}
                            blur={1}
                            strength={50}
                            chromaticAberration={8}
                            backgroundColor="transparent"
                            elevation="medium"
                            aria-hidden
                            className="pointer-events-none"
                            style={{ position: 'absolute', inset: '-3px', zIndex: 0, borderRadius: 'inherit' }}
                        />
                        {/* Header Tabs */}
                        <div className="flex items-center justify-between p-6 pb-2 relative z-10">
                            <div className="flex gap-4">
                                <button
                                    onClick={() => setActiveTab('capture')}
                                    className={cn("text-xs font-black tracking-widest p-1 border-b-2 transition-colors", activeTab === 'capture' ? "border-primary text-primary" : "border-transparent text-muted-foreground")}
                                >
                                    CAPTURE
                                </button>
                                <button
                                    onClick={() => setActiveTab('saved')}
                                    className={cn("text-xs font-black tracking-widest p-1 border-b-2 transition-colors", activeTab === 'saved' ? "border-primary text-primary" : "border-transparent text-muted-foreground")}
                                >
                                    HISTORY
                                </button>
                            </div>
                            <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        {activeTab === 'capture' && (
                            <div className="p-8 space-y-6 relative z-10">
                                {/* Content Area */}
                                <div className="space-y-4">
                                    <Textarea
                                        ref={textareaRef}
                                        placeholder={type === 'task' ? "Set a task... (e.g. Deploy session system)" : "Spark an idea..."}
                                        value={content}
                                        onChange={(e) => setContent(e.target.value)}
                                        onKeyDown={handleKeyPress}
                                        className="min-h-[120px] text-2xl font-bold bg-transparent border-0 text-foreground focus-visible:ring-0 p-0 placeholder:text-muted-foreground/50"
                                    />

                                    {/* Type Strip */}
                                    <div className="flex gap-2 p-1 rounded-2xl bg-muted/65 border border-border/70 w-fit">
                                        {(Object.keys(typeConfig) as NoteType[]).map((t) => {
                                            const { icon: Icon, color, label } = typeConfig[t];
                                            const isSelected = type === t;
                                            return (
                                                <button
                                                    key={t}
                                                    onClick={() => setType(t)}
                                                    className={cn(
                                                        "flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-bold tracking-wider transition-all btn-press",
                                                        isSelected ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground hover:bg-muted"
                                                    )}
                                                >
                                                    <Icon className="h-3 w-3" />
                                                    <span className="uppercase">{label}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Footer Actions */}
                                <div className="pt-6 border-t border-border/70 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <label className="flex items-center gap-2 cursor-pointer group">
                                            <div className={cn("h-4 w-4 rounded border transition-colors flex items-center justify-center", saveAndContinue ? "bg-primary border-primary" : "border-border group-hover:border-foreground/30")}>
                                                {saveAndContinue && <Check className="h-3 w-3 text-primary-foreground" />}
                                            </div>
                                            <input type="checkbox" className="hidden" checked={saveAndContinue} onChange={() => setSaveAndContinue(!saveAndContinue)} />
                                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest group-hover:text-foreground transition-colors">Continue Capturing</span>
                                        </label>
                                    </div>

                                    <Button
                                        onClick={handleNext}
                                        disabled={!content.trim() || saving}
                                        className="rounded-2xl px-6 h-12 bg-primary text-primary-foreground hover:bg-primary/90 font-black tracking-tighter italic btn-press"
                                    >
                                        {type === 'task' ? 'CONFIGURE' : 'CAPTURE'}
                                        <ChevronRight className="h-4 w-4 ml-2" />
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
                    </motion.div>
                    </div>
                </>
            )}
        </AnimatePresence>
    ), document.body);
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
