'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Star, Trash2, Save, BookOpen } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface BookDetailsDialogProps {
    book: any
    isOpen: boolean
    onClose: () => void
    onUpdate: () => void
}

export function BookDetailsDialog({ book, isOpen, onClose, onUpdate }: BookDetailsDialogProps) {
    const [currentPage, setCurrentPage] = useState(0)
    const [status, setStatus] = useState('to-read')
    const [rating, setRating] = useState(0)
    const [review, setReview] = useState('')
    const [notes, setNotes] = useState('')
    const [pageNotes, setPageNotes] = useState<any[]>([])
    const [isSaving, setIsSaving] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)
    const { toast } = useToast()

    useEffect(() => {
        if (book) {
            setCurrentPage(book.currentPage || 0)
            setStatus(book.status || 'to-read')
            setRating(book.rating || 0)
            setReview(book.review || '')
            setNotes(book.notes || '')
            setPageNotes(Array.isArray(book.pageNotes) ? book.pageNotes : [])
        }
    }, [book])

    if (!book) return null

    const handleSave = async () => {
        setIsSaving(true)
        try {
            const response = await fetch(`/api/books/${book.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    currentPage,
                    status,
                    rating,
                    review,
                    notes,
                    pageNotes,
                    // Auto-update dates based on status
                    startedAt: status === 'reading' && !book.startedAt ? new Date() : undefined,
                    finishedAt: status === 'read' && !book.finishedAt ? new Date() : undefined,
                }),
            })

            if (response.ok) {
                toast({
                    title: 'Book updated',
                    description: 'Your changes have been saved.',
                })
                onUpdate()
            } else {
                throw new Error('Failed to update book')
            }
        } catch (error) {
            console.error('Error updating book:', error)
            toast({
                title: 'Error',
                description: 'Failed to save changes.',
                variant: 'destructive',
            })
        } finally {
            setIsSaving(false)
        }
    }

    const handleDelete = async () => {
        if (!confirm('Are you sure you want to delete this book from your library?')) return

        setIsDeleting(true)
        try {
            const response = await fetch(`/api/books/${book.id}`, {
                method: 'DELETE',
            })

            if (response.ok) {
                toast({
                    title: 'Book deleted',
                    description: 'The book has been removed from your library.',
                })
                onUpdate()
            } else {
                throw new Error('Failed to delete book')
            }
        } catch (error) {
            console.error('Error deleting book:', error)
            toast({
                title: 'Error',
                description: 'Failed to delete book.',
                variant: 'destructive',
            })
        } finally {
            setIsDeleting(false)
        }
    }

    const progress = book.totalPages ? Math.round((currentPage / book.totalPages) * 100) : 0

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col bg-background/90 backdrop-blur-xl border-border/50 rounded-3xl shadow-2xl">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold tracking-tight">Book Details</DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-hidden flex flex-col md:flex-row gap-6 p-1">
                    {/* Left Column: Cover & Key Info */}
                    <div className="w-full md:w-1/3 flex flex-col gap-4">
                        <div className="aspect-[2/3] relative bg-muted/50 rounded-xl overflow-hidden shadow-lg border border-border/50">
                            {book.coverUrl ? (
                                <img
                                    src={book.coverUrl}
                                    alt={book.title}
                                    className="object-cover w-full h-full"
                                />
                            ) : (
                                <div className="flex items-center justify-center h-full text-muted-foreground">
                                    <BookOpen className="h-16 w-16 opacity-50" />
                                </div>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label>Status</Label>
                            <Select value={status} onValueChange={setStatus}>
                                <SelectTrigger className="rounded-xl bg-background/50 border-border/50">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl bg-background/90 backdrop-blur-xl border-border/50">
                                    <SelectItem value="to-read">To Read</SelectItem>
                                    <SelectItem value="reading">Reading</SelectItem>
                                    <SelectItem value="read">Read</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Rating</Label>
                            <div className="flex gap-1 justify-center bg-background/50 p-2 rounded-xl border border-border/50">
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <Button
                                        key={star}
                                        variant="ghost"
                                        size="icon"
                                        className={`h-8 w-8 hover:bg-transparent ${star <= rating ? 'text-yellow-400' : 'text-muted-foreground/30'}`}
                                        onClick={() => setRating(star)}
                                    >
                                        <Star className={`h-6 w-6 ${star <= rating ? 'fill-current' : ''}`} />
                                    </Button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Details & Tabs */}
                    <div className="flex-1 flex flex-col overflow-hidden">
                        <div className="mb-6">
                            <h2 className="text-2xl font-bold mb-1 tracking-tight">{book.title}</h2>
                            <p className="text-lg text-muted-foreground">{book.author}</p>
                            {book.totalPages && (
                                <p className="text-sm text-muted-foreground mt-1">
                                    {book.totalPages} pages • ISBN: {book.isbn || 'N/A'}
                                </p>
                            )}
                        </div>

                        <div className="space-y-4 mb-6 bg-secondary/30 p-4 rounded-xl border border-border/50">
                            <div className="flex justify-between text-sm font-medium">
                                <span>Progress</span>
                                <span>{currentPage} / {book.totalPages || '?'} pages ({progress}%)</span>
                            </div>
                            <Slider
                                value={[currentPage]}
                                max={book.totalPages || 1000}
                                step={1}
                                onValueChange={(vals) => setCurrentPage(vals[0])}
                                className="w-full"
                            />
                        </div>

                        <Tabs defaultValue="notes" className="flex-1 flex flex-col overflow-hidden">
                            <TabsList className="w-full justify-start bg-secondary/50 rounded-xl p-1">
                                <TabsTrigger value="notes" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">General Notes</TabsTrigger>
                                <TabsTrigger value="page-notes" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">Page Notes</TabsTrigger>
                                <TabsTrigger value="review" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">Review</TabsTrigger>
                            </TabsList>

                            <TabsContent value="notes" className="flex-1 mt-4">
                                <Textarea
                                    placeholder="Add your personal notes here..."
                                    className="h-full min-h-[200px] resize-none bg-background/50 border-border/50 rounded-xl focus-visible:ring-primary/50"
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                />
                            </TabsContent>

                            <TabsContent value="page-notes" className="flex-1 mt-4 flex flex-col gap-4">
                                <div className="flex gap-2">
                                    <Input
                                        type="number"
                                        placeholder="Page"
                                        className="w-24 bg-background/50 border-border/50 rounded-xl"
                                        id="page-input"
                                    />
                                    <Input
                                        placeholder="Note for this page..."
                                        className="flex-1 bg-background/50 border-border/50 rounded-xl"
                                        id="note-input"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                const pageInput = document.getElementById('page-input') as HTMLInputElement
                                                const noteInput = document.getElementById('note-input') as HTMLInputElement
                                                if (pageInput.value && noteInput.value) {
                                                    const newNote = {
                                                        page: parseInt(pageInput.value),
                                                        note: noteInput.value,
                                                        date: new Date().toISOString()
                                                    }
                                                    const currentNotes = Array.isArray(pageNotes) ? pageNotes : []
                                                    setPageNotes([...currentNotes, newNote].sort((a: any, b: any) => a.page - b.page))
                                                    noteInput.value = ''
                                                    pageInput.focus()
                                                }
                                            }
                                        }}
                                    />
                                    <Button onClick={() => {
                                        const pageInput = document.getElementById('page-input') as HTMLInputElement
                                        const noteInput = document.getElementById('note-input') as HTMLInputElement
                                        if (pageInput.value && noteInput.value) {
                                            const newNote = {
                                                page: parseInt(pageInput.value),
                                                note: noteInput.value,
                                                date: new Date().toISOString()
                                            }
                                            const currentNotes = Array.isArray(pageNotes) ? pageNotes : []
                                            setPageNotes([...currentNotes, newNote].sort((a: any, b: any) => a.page - b.page))
                                            noteInput.value = ''
                                        }
                                    }} className="rounded-xl">Add</Button>
                                </div>
                                <ScrollArea className="flex-1 border border-border/50 rounded-xl p-4 bg-background/30">
                                    {Array.isArray(pageNotes) && pageNotes.length > 0 ? (
                                        <div className="space-y-4">
                                            {pageNotes.map((note: any, index: number) => (
                                                <div key={index} className="flex gap-4 text-sm group bg-card/50 p-3 rounded-lg border border-border/30">
                                                    <div className="font-mono text-muted-foreground w-12 shrink-0 pt-0.5">
                                                        p.{note.page}
                                                    </div>
                                                    <div className="flex-1">
                                                        <p>{note.note}</p>
                                                        <p className="text-xs text-muted-foreground mt-1">
                                                            {new Date(note.date).toLocaleDateString()}
                                                        </p>
                                                    </div>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                                        onClick={() => {
                                                            const newNotes = pageNotes.filter((_, i) => i !== index)
                                                            setPageNotes(newNotes)
                                                        }}
                                                    >
                                                        <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center text-muted-foreground py-8">
                                            No page notes yet. Add one above!
                                        </div>
                                    )}
                                </ScrollArea>
                            </TabsContent>

                            <TabsContent value="review" className="flex-1 mt-4">
                                <Textarea
                                    placeholder="Write your review..."
                                    className="h-full min-h-[200px] resize-none bg-background/50 border-border/50 rounded-xl focus-visible:ring-primary/50"
                                    value={review}
                                    onChange={(e) => setReview(e.target.value)}
                                />
                            </TabsContent>
                        </Tabs>
                    </div>
                </div>

                <DialogFooter className="mt-6 flex justify-between items-center">
                    <Button
                        variant="destructive"
                        onClick={handleDelete}
                        disabled={isDeleting}
                        className="rounded-xl"
                    >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                    </Button>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={onClose} className="rounded-xl">Cancel</Button>
                        <Button onClick={handleSave} disabled={isSaving} className="rounded-xl">
                            <Save className="h-4 w-4 mr-2" />
                            Save Changes
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
