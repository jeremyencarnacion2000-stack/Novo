'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
    PenLine,
    X,
    Lightbulb,
    CheckSquare,
    Bell,
    FileText,
    Send,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';

type NoteType = 'note' | 'idea' | 'task' | 'reminder';

const typeConfig = {
    note: { icon: FileText, color: 'bg-blue-500', label: 'Note' },
    idea: { icon: Lightbulb, color: 'bg-yellow-500', label: 'Idea' },
    task: { icon: CheckSquare, color: 'bg-green-500', label: 'Task' },
    reminder: { icon: Bell, color: 'bg-purple-500', label: 'Reminder' },
};

export function QuickCapture() {
    const [isOpen, setIsOpen] = useState(false);
    const [content, setContent] = useState('');
    const [type, setType] = useState<NoteType>('note');
    const [saving, setSaving] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const { toast } = useToast();

    // Keyboard shortcut: CMD/CTRL + Shift + N
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'n') {
                e.preventDefault();
                setIsOpen(prev => !prev);
            }
            if (e.key === 'Escape' && isOpen) {
                setIsOpen(false);
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen]);

    // Focus textarea when opened
    useEffect(() => {
        if (isOpen && textareaRef.current) {
            textareaRef.current.focus();
        }
    }, [isOpen]);

    const handleSave = async () => {
        if (!content.trim()) return;

        setSaving(true);
        try {
            const response = await fetch('/api/notes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content, type }),
            });

            if (response.ok) {
                toast({
                    title: 'Captured!',
                    description: `${typeConfig[type].label} saved successfully.`,
                });
                setContent('');
                setIsOpen(false);
            } else {
                throw new Error('Failed to save');
            }
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to save note',
                variant: 'destructive',
            });
        } finally {
            setSaving(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            handleSave();
        }
    };

    return (
        <>
            {/* Floating Button */}
            <motion.button
                className="fixed bottom-6 left-6 z-40 h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:scale-105 transition-transform"
                onClick={() => setIsOpen(true)}
                whileTap={{ scale: 0.95 }}
                title="Quick Capture (⌘+Shift+N)"
            >
                <PenLine className="h-5 w-5" />
            </motion.button>

            {/* Capture Modal */}
            <AnimatePresence>
                {isOpen && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsOpen(false)}
                        />

                        {/* Modal */}
                        <motion.div
                            className="fixed bottom-20 left-6 z-50 w-80 bg-background border rounded-lg shadow-xl overflow-hidden"
                            initial={{ opacity: 0, y: 20, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 20, scale: 0.95 }}
                            transition={{ duration: 0.2 }}
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/50">
                                <span className="text-sm font-medium">Quick Capture</span>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() => setIsOpen(false)}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>

                            {/* Type Selector */}
                            <div className="flex gap-2 p-3 border-b">
                                {(Object.keys(typeConfig) as NoteType[]).map((t) => {
                                    const { icon: Icon, color, label } = typeConfig[t];
                                    return (
                                        <button
                                            key={t}
                                            onClick={() => setType(t)}
                                            className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors ${type === t
                                                    ? `${color} text-white`
                                                    : 'bg-muted hover:bg-muted/80'
                                                }`}
                                        >
                                            <Icon className="h-3 w-3" />
                                            {label}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Content */}
                            <div className="p-3">
                                <Textarea
                                    ref={textareaRef}
                                    placeholder="What's on your mind?"
                                    value={content}
                                    onChange={(e) => setContent(e.target.value)}
                                    onKeyDown={handleKeyPress}
                                    className="min-h-[100px] resize-none border-0 focus-visible:ring-0 p-0"
                                />
                            </div>

                            {/* Footer */}
                            <div className="flex items-center justify-between px-3 py-2 border-t bg-muted/30">
                                <span className="text-xs text-muted-foreground">
                                    ⌘+Enter to save
                                </span>
                                <Button
                                    size="sm"
                                    onClick={handleSave}
                                    disabled={!content.trim() || saving}
                                >
                                    {saving ? 'Saving...' : (
                                        <>
                                            <Send className="h-3 w-3 mr-1" />
                                            Save
                                        </>
                                    )}
                                </Button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    );
}
