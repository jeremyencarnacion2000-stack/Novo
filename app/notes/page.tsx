'use client'

import { useState, useEffect } from 'react'

import { QuickCapture } from '@/components/quick-notes/quick-capture'
import { NoteCard } from '@/components/quick-notes/note-card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Search, Loader2, Archive, Pin } from 'lucide-react'
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
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Quick Notes</h1>
                    <p className="text-muted-foreground mt-1">Capture ideas and thoughts instantly</p>
                </div >
                <QuickCapture />
            </div >

            <div className="flex items-center gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search notes..."
                        className="pl-9"
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
                            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                                <Pin className="h-4 w-4" />
                                Pinned
                            </div>
                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                {pinnedNotes.map(note => (
                                    <NoteCard key={note.id} note={note} />
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="space-y-4">
                        {pinnedNotes.length > 0 && otherNotes.length > 0 && (
                            <div className="text-sm font-medium text-muted-foreground">Others</div>
                        )}
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                            {otherNotes.map(note => (
                                <NoteCard key={note.id} note={note} />
                            ))}
                        </div>
                        {activeNotes.length === 0 && (
                            <div className="text-center py-12 text-muted-foreground">
                                No notes found. Create one to get started!
                            </div>
                        )}
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    )
}
