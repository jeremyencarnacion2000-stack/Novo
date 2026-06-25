'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
    PenLine, X, Lightbulb, CheckSquare, Bell, FileText,
    Send, Archive, Trash2, ChevronRight, Calendar, Layers, Plus, Check,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';
import { useQuickCapture } from '@/lib/quick-capture-context';
import { cn } from '@/lib/utils';

type NoteType = 'note' | 'idea' | 'task' | 'reminder';
type TabView = 'capture' | 'saved' | 'attributes';

const typeConfig = {
    note: { icon: FileText, color: 'bg-blue-500', label: 'Note' },
    idea: { icon: Lightbulb, color: 'bg-yellow-500', label: 'Idea' },
    task: { icon: CheckSquare, color: 'bg-green-500', label: 'Task' },
    reminder: { icon: Bell, color: 'bg-purple-500', label: 'Reminder' },
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

    // Attributes step state
    const [selectedProject, setSelectedProject] = useState<string | null>(null);
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [projects, setProjects] = useState<any[]>([]);

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const { toast } = useToast();

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

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        className="fixed inset-0 z-[5000] bg-black/60 backdrop-blur-sm"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        onClick={onClose}
                    />

                    {/* Modal (Floating like Raycast/Spotlight) */}
                    <motion.div
                        className="liquid-glass-elevated fixed top-[20%] left-1/2 -translate-x-1/2 w-full max-w-xl z-[5001] bg-[#0A0A0B]/90 border border-white/10 rounded-[32px] glass-blur shadow-[0_30px_100px_-20px_rgba(0,0,0,0.8)] overflow-hidden"
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
                        {/* Header Tabs */}
                        <div className="flex items-center justify-between p-6 pb-2">
                            <div className="flex gap-4">
                                <button
                                    onClick={() => setActiveTab('capture')}
                                    className={cn("text-xs font-black tracking-widest p-1 border-b-2 transition-all", activeTab === 'capture' ? "border-primary text-primary" : "border-transparent text-white/20")}
                                >
                                    CAPTURE
                                </button>
                                <button
                                    onClick={() => setActiveTab('saved')}
                                    className={cn("text-xs font-black tracking-widest p-1 border-b-2 transition-all", activeTab === 'saved' ? "border-primary text-primary" : "border-transparent text-white/20")}
                                >
                                    HISTORY
                                </button>
                            </div>
                            <button onClick={onClose} className="text-white/20 hover:text-white transition-colors">
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        {activeTab === 'capture' && (
                            <div className="p-8 space-y-6">
                                {/* Content Area */}
                                <div className="space-y-4">
                                    <Textarea
                                        ref={textareaRef}
                                        placeholder={type === 'task' ? "Set a task... (e.g. Deploy session system)" : "Spark an idea..."}
                                        value={content}
                                        onChange={(e) => setContent(e.target.value)}
                                        onKeyDown={handleKeyPress}
                                        className="min-h-[120px] text-2xl font-bold bg-transparent border-0 focus-visible:ring-0 p-0 placeholder:text-white/5"
                                    />

                                    {/* Type Strip */}
                                    <div className="flex gap-2 p-1 rounded-2xl bg-white/5 border border-white/5 w-fit">
                                        {(Object.keys(typeConfig) as NoteType[]).map((t) => {
                                            const { icon: Icon, color, label } = typeConfig[t];
                                            const isSelected = type === t;
                                            return (
                                                <button
                                                    key={t}
                                                    onClick={() => setType(t)}
                                                    className={cn(
                                                        "flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-bold tracking-wider transition-all btn-press",
                                                        isSelected ? "bg-white text-black" : "text-white/30 hover:text-white hover:bg-white/5"
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
                                <div className="pt-6 border-t border-white/5 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <label className="flex items-center gap-2 cursor-pointer group">
                                            <div className={cn("h-4 w-4 rounded border transition-all flex items-center justify-center", saveAndContinue ? "bg-primary border-primary" : "border-white/10 group-hover:border-white/30")}>
                                                {saveAndContinue && <Check className="h-3 w-3 text-white" />}
                                            </div>
                                            <input type="checkbox" className="hidden" checked={saveAndContinue} onChange={() => setSaveAndContinue(!saveAndContinue)} />
                                            <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest group-hover:text-white/40 transition-colors">Continue Capturing</span>
                                        </label>
                                    </div>

                                    <Button
                                        onClick={handleNext}
                                        disabled={!content.trim() || saving}
                                        className="rounded-2xl px-6 h-12 bg-white text-black hover:bg-white/90 font-black tracking-tighter italic btn-press"
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
                                className="p-8 space-y-8"
                            >
                                <div className="space-y-4">
                                    <h3 className="text-[10px] font-bold text-white/20 uppercase tracking-[0.3em]">Project Context</h3>
                                    <div className="grid grid-cols-2 gap-3">
                                        {projects.slice(0, 4).map(p => (
                                            <button
                                                key={p.id}
                                                onClick={() => setSelectedProject(p.id)}
                                                className={cn(
                                                    "flex items-center gap-3 p-4 rounded-2xl border transition-all text-left",
                                                    selectedProject === p.id ? "bg-primary/20 border-primary text-primary" : "bg-white/5 border-white/5 text-white/40 hover:border-white/20"
                                                )}
                                            >
                                                <Layers className="h-4 w-4" />
                                                <span className="text-xs font-bold truncate">{p.title}</span>
                                            </button>
                                        ))}
                                        <button className="flex items-center gap-3 p-4 rounded-2xl border border-dashed border-white/10 text-white/20 hover:border-white/40 transition-all">
                                            <Plus className="h-4 w-4" />
                                            <span className="text-xs font-bold">New Project</span>
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h3 className="text-[10px] font-bold text-white/20 uppercase tracking-[0.3em]">Temporal State</h3>
                                    <div className="flex gap-3">
                                        {['Today', 'Tomorrow', 'Next Week'].map(d => (
                                            <button
                                                key={d}
                                                onClick={() => setSelectedDate(d)}
                                                className={cn(
                                                    "px-6 py-3 rounded-xl border text-[10px] font-bold uppercase tracking-wider transition-all",
                                                    selectedDate === d ? "bg-primary border-primary text-white" : "bg-white/5 border-white/5 text-white/20 hover:border-white/20"
                                                )}
                                            >
                                                {d}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="pt-6 border-t border-white/5 flex gap-4">
                                    <Button
                                        variant="ghost"
                                        onClick={() => setActiveTab('capture')}
                                        className="h-12 rounded-2xl text-white/40 hover:text-white"
                                    >
                                        BACK
                                    </Button>
                                    <Button
                                        onClick={handleSave}
                                        className="flex-1 h-12 rounded-2xl bg-primary text-white font-black tracking-tighter italic"
                                    >
                                        LEGALIZE ACTION
                                    </Button>
                                </div>
                            </motion.div>
                        )}

                        {activeTab === 'saved' && (
                            <div className="p-8 max-h-[400px] overflow-y-auto space-y-4 pb-12">
                                {savedNotes.map(note => (
                                    <div key={note.id} className="p-4 rounded-2xl bg-white/5 border border-white/5 flex items-start gap-4 group">
                                        <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center mt-1", typeConfig[note.type]?.color + "/20")}>
                                            <PenLine className="h-4 w-4 text-white/40" />
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-sm font-medium line-clamp-2">{note.content}</p>
                                            <p className="text-[10px] font-bold text-white/10 uppercase mt-2 tracking-widest">{new Date(note.createdAt).toLocaleDateString()}</p>
                                        </div>
                                        <button onClick={() => handleDelete(note.id)} className="opacity-0 group-hover:opacity-100 text-white/20 hover:text-destructive transition-all p-1">
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
