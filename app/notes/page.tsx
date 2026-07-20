'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { QuickCapture } from '@/components/quick-notes/quick-capture'
import { NoteCard } from '@/components/quick-notes/note-card'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Search, Loader2, Archive, Pin, FileText, Sparkles, ChevronRight } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface Note {
    id: string
    content: string
    isPinned: boolean
    isArchived: boolean
    color: string | null
    tags: string[]
    updatedAt: string
}

export default function NotesPage() {
    const [notes, setNotes] = useState<Note[]>([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const { toast } = useToast()

    const fetchNotes = async () => {
        try {
            const response = await fetch('/api/notes')
            if (!response.ok) throw new Error('Failed to fetch notes')
            const data = await response.json()
            setNotes(data)
        } catch (error) {
            console.error('Error fetching notes:', error)
            toast({
                title: 'Error',
                description: 'Failed to load notes',
                variant: 'destructive'
            })
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchNotes()
    }, [])

    const filteredNotes = notes.filter(note =>
        note.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        note.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
    )

    const activeNotes = filteredNotes.filter(n => !n.isArchived)
    const archivedNotes = filteredNotes.filter(n => n.isArchived)
    const pinnedNotes = activeNotes.filter(n => n.isPinned)
    const otherNotes = activeNotes.filter(n => !n.isPinned)

    return (
        <div className="flex flex-col gap-6 md:gap-8 max-w-5xl mx-auto w-full">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black tracking-tight text-foreground/90">Quick Notes</h1>
                    <p className="text-xs text-foreground/30 font-medium mt-0.5">Capture ideas and thoughts instantly</p>
                </div>
                <QuickCapture onCreated={fetchNotes} />
            </div>

            <div className="flex items-center gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-foreground/30" />
                    <Input
                        placeholder="Search notes..."
                        className="pl-9 bg-foreground/[0.03] border-foreground/[0.08] text-foreground/80 placeholder:text-foreground/25 rounded-2xl h-10 focus:border-foreground/20 focus:bg-foreground/[0.05] transition-all"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            <Tabs defaultValue="active" className="flex-1">
                <TabsList>
                    <TabsTrigger value="active">Active ({activeNotes.length})</TabsTrigger>
                    <TabsTrigger value="archived">Archived ({archivedNotes.length})</TabsTrigger>
                </TabsList>

                <TabsContent value="active" className="mt-6 space-y-8">
                    {pinnedNotes.length > 0 && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-2">
                                <Pin className="h-3 w-3 text-amber-400/70" />
                                <span className="text-[10px] font-black tracking-[0.25em] uppercase text-foreground/35">Pinned</span>
                            </div>
                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                {pinnedNotes.map(note => (
                                    <NoteCard key={note.id} note={note} onChange={fetchNotes} />
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="space-y-4">
                        {pinnedNotes.length > 0 && otherNotes.length > 0 && (
                            <span className="text-[10px] font-black tracking-[0.25em] uppercase text-foreground/25">Others</span>
                        )}
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                            {otherNotes.map(note => (
                                <NoteCard key={note.id} note={note} onChange={fetchNotes} />
                            ))}
                        </div>
                        {activeNotes.length === 0 && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.96 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ duration: 0.4 }}
                                className="flex flex-col items-center justify-center py-20 gap-5 text-center"
                            >
                                {/* Glow icon */}
                                <div
                                    className="w-16 h-16 rounded-3xl border border-indigo-500/20 flex items-center justify-center relative"
                                    style={{ background: 'rgba(99,102,241,0.06)', boxShadow: '0 0 32px rgba(99,102,241,0.10)' }}
                                >
                                    <FileText className="w-7 h-7 text-indigo-400/70" />
                                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
                                        <Sparkles className="w-2.5 h-2.5 text-indigo-300" />
                                    </span>
                                </div>

                                <div className="max-w-xs space-y-2">
                                    <p className="text-base font-bold text-foreground/80">Your thought space is clear</p>
                                    <p className="text-sm text-foreground/35 leading-relaxed">
                                        Novo captures your ideas instantly and surfaces them at the right moment.
                                        Start with a single thought — no structure required.
                                    </p>
                                </div>

                                {/* CTA pill */}
                                <div
                                    className="flex items-center gap-2 px-4 py-2.5 rounded-full border border-foreground/[0.08] text-xs font-semibold text-foreground/40"
                                    style={{ background: 'rgba(255,255,255,0.025)' }}
                                >
                                    <ChevronRight className="w-3.5 h-3.5 text-indigo-400/60" />
                                    Use <span className="text-indigo-300/80 font-black">Quick Capture</span> above or press <kbd className="ml-1 text-[9px] bg-foreground/5 border border-foreground/10 rounded px-1 py-0.5 font-bold text-foreground/30">⌘ K</kbd>
                                </div>
                            </motion.div>
                        )}
                    </div>
                </TabsContent>

                <TabsContent value="archived" className="mt-6">
                    {archivedNotes.length > 0 ? (
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                            {archivedNotes.map(note => (
                                <NoteCard key={note.id} note={note} onChange={fetchNotes} />
                            ))}
                        </div>
                    ) : (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.96 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.4 }}
                            className="flex flex-col items-center justify-center py-20 gap-5 text-center"
                        >
                            <div
                                className="w-16 h-16 rounded-3xl border border-foreground/10 flex items-center justify-center"
                                style={{ background: 'rgba(255,255,255,0.025)', boxShadow: '0 0 24px rgba(255,255,255,0.03)' }}
                            >
                                <Archive className="w-7 h-7 text-foreground/20" />
                            </div>
                            <div className="max-w-xs space-y-2">
                                <p className="text-base font-bold text-foreground/50">No archived notes</p>
                                <p className="text-sm text-foreground/25 leading-relaxed">
                                    Notes you archive will appear here. Use archiving to declutter without losing your captures.
                                </p>
                            </div>
                        </motion.div>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    )
}
