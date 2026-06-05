'use client'

import { useState, useEffect, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Star, Trash2, Save, BookOpen, ExternalLink, Smartphone, BookMarked, Headphones } from 'lucide-react'
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
    const [format, setFormat] = useState('digital')
    const [genre, setGenre] = useState('')
    const [isSaving, setIsSaving] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)
    const { toast } = useToast()

    const pageInputRef = useRef<HTMLInputElement>(null)
    const noteInputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (book) {
            setCurrentPage(book.currentPage || 0)
            setStatus(book.status || 'to-read')
            setRating(book.rating || 0)
            setReview(book.review || '')
            setNotes(book.notes || '')
            setPageNotes(Array.isArray(book.pageNotes) ? book.pageNotes : [])
            setFormat(book.format || 'digital')
            setGenre(book.genre || '')
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
                    format,
                    genre,
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

    const handleAddPageNote = () => {
        if (pageInputRef.current?.value && noteInputRef.current?.value) {
            const newNote = {
                page: parseInt(pageInputRef.current.value),
                note: noteInputRef.current.value,
                date: new Date().toISOString()
            }
            const currentNotes = Array.isArray(pageNotes) ? pageNotes : []
            setPageNotes([...currentNotes, newNote].sort((a: any, b: any) => a.page - b.page))
            noteInputRef.current.value = ''
            pageInputRef.current.value = ''
            pageInputRef.current.focus()
        }
    }

    const handleFindPDF = () => {
        const searchQuery = `${book.title} ${book.author || ''} PDF`
        window.open(`https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`, '_blank')
    }

    const progress = book.totalPages ? Math.round((currentPage / book.totalPages) * 100) : 0

    const FormatIcon = format === 'physical' ? BookMarked : format === 'audiobook' ? Headphones : Smartphone

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

                        {/* Format Selector */}
                        <div className="space-y-2">
                            <Label>Format</Label>
                            <Select value={format} onValueChange={setFormat}>
                                <SelectTrigger className="rounded-xl bg-background/50 border-border/50">
                                    <FormatIcon className="h-4 w-4 mr-2" />
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl bg-background/90 backdrop-blur-xl border-border/50">
                                    <SelectItem value="digital">
                                        <span className="flex items-center gap-2">
                                            <Smartphone className="h-3.5 w-3.5" /> Digital
                                        </span>
                                    </SelectItem>
                                    <SelectItem value="physical">
                                        <span className="flex items-center gap-2">
                                            <BookMarked className="h-3.5 w-3.5" /> Physical
                                        </span>
                                    </SelectItem>
                                    <SelectItem value="audiobook">
                                        <span className="flex items-center gap-2">
                                            <Headphones className="h-3.5 w-3.5" /> Audiobook
                                        </span>
                                    </SelectItem>
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
                        <div className="mb-4">
                            <h2 className="text-2xl font-bold mb-1 tracking-tight">{book.title}</h2>
                            <p className="text-lg text-muted-foreground">{book.author}</p>
                            <div className="flex flex-wrap items-center gap-2 mt-2">
                                {book.totalPages && (
                                    <span className="text-sm text-muted-foreground">
                                        {book.totalPages} pages
                                    </span>
                                )}
                                {book.isbn && (
                                    <span className="text-sm text-muted-foreground">
                                        • ISBN: {book.isbn}
                                    </span>
                                )}
                                {genre && (
                                    <Badge variant="secondary" className="rounded-lg bg-primary/10 text-primary border-primary/20 capitalize text-xs">
                                        {genre}
                                    </Badge>
                                )}
                                <Badge variant="outline" className="rounded-lg text-xs capitalize gap-1">
                                    <FormatIcon className="h-3 w-3" />
                                    {format}
                                </Badge>
                            </div>
                        </div>

                        {/* Description */}
                        {book.description && (
                            <p className="text-sm text-muted-foreground mb-4 line-clamp-3 bg-secondary/30 p-3 rounded-xl border border-border/50">
                                {book.description}
                            </p>
                        )}

                        {/* Progress */}
                        <div className="space-y-3 mb-4 bg-secondary/30 p-4 rounded-xl border border-border/50">
                            <div className="flex justify-between text-sm font-medium">
                                <span>Progress</span>
                                <span>{currentPage} / {book.totalPages || '?'} pages ({progress}%)</span>
                            </div>
                            <Slider
                                value={[currentPage]}
                                max={book.totalPages > 0 ? book.totalPages : 500}
                                step={1}
                                onValueChange={(vals) => {
                                    const max = book.totalPages > 0 ? book.totalPages : 99999
                                    setCurrentPage(Math.min(vals[0], max))
                                }}
                                className="w-full"
                            />
                            {/* Quick page input */}
                            <div className="flex items-center gap-2">
                                <Label className="text-xs text-muted-foreground whitespace-nowrap">Go to page:</Label>
                                <Input
                                    type="number"
                                    min={0}
                                    max={book.totalPages > 0 ? book.totalPages : 99999}
                                    value={currentPage}
                                    onChange={(e) => {
                                        const val = parseInt(e.target.value) || 0
                                        const max = book.totalPages > 0 ? book.totalPages : 99999
                                        setCurrentPage(Math.max(0, Math.min(val, max)))
                                    }}
                                    className="w-24 h-7 text-xs bg-background/50 border-border/50 rounded-lg"
                                />
                                {book.totalPages > 0 && (
                                    <span className="text-[10px] text-muted-foreground">/ {book.totalPages}</span>
                                )}
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-2 mb-4">
                            <Button
                                variant="outline"
                                size="sm"
                                className="rounded-xl border-border/50 text-xs"
                                onClick={handleFindPDF}
                            >
                                <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                                Find PDF
                            </Button>
                        </div>

                        <Tabs defaultValue="notes" className="flex-1 flex flex-col overflow-hidden">
                            <TabsList className="w-full justify-start bg-secondary/50 rounded-xl p-1">
                                <TabsTrigger value="notes" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm text-xs">General Notes</TabsTrigger>
                                <TabsTrigger value="page-notes" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm text-xs">Page Notes</TabsTrigger>
                                <TabsTrigger value="review" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm text-xs">Review</TabsTrigger>
                            </TabsList>

                            <TabsContent value="notes" className="flex-1 mt-3">
                                <Textarea
                                    placeholder="Add your personal notes here..."
                                    className="h-full min-h-[150px] resize-none bg-background/50 border-border/50 rounded-xl focus-visible:ring-primary/50"
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                />
                            </TabsContent>

                            <TabsContent value="page-notes" className="flex-1 mt-3 flex flex-col gap-3">
                                <div className="flex gap-2">
                                    <Input
                                        type="number"
                                        placeholder="Page"
                                        min={1}
                                        max={book.totalPages > 0 ? book.totalPages : 99999}
                                        className="w-20 bg-background/50 border-border/50 rounded-xl text-sm"
                                        ref={pageInputRef}
                                    />
                                    <Input
                                        placeholder="Note for this page..."
                                        className="flex-1 bg-background/50 border-border/50 rounded-xl text-sm"
                                        ref={noteInputRef}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleAddPageNote()
                                        }}
                                    />
                                    <Button onClick={handleAddPageNote} className="rounded-xl" size="sm">Add</Button>
                                </div>
                                <ScrollArea className="flex-1 border border-border/50 rounded-xl p-3 bg-background/30 max-h-[200px]">
                                    {Array.isArray(pageNotes) && pageNotes.length > 0 ? (
                                        <div className="space-y-3">
                                            {pageNotes.map((note: any, index: number) => (
                                                <div key={index} className="flex gap-3 text-sm group bg-card/50 p-3 rounded-lg border border-border/30">
                                                    <div className="font-mono text-muted-foreground w-10 shrink-0 pt-0.5 text-xs">
                                                        p.{note.page}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm">{note.note}</p>
                                                        <p className="text-xs text-muted-foreground mt-1">
                                                            {new Date(note.date).toLocaleDateString()}
                                                        </p>
                                                    </div>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
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
                                        <div className="text-center text-muted-foreground py-6 text-sm">
                                            No page notes yet. Add one above!
                                        </div>
                                    )}
                                </ScrollArea>
                            </TabsContent>

                            <TabsContent value="review" className="flex-1 mt-3">
                                <Textarea
                                    placeholder="Write your review..."
                                    className="h-full min-h-[150px] resize-none bg-background/50 border-border/50 rounded-xl focus-visible:ring-primary/50"
                                    value={review}
                                    onChange={(e) => setReview(e.target.value)}
                                />
                            </TabsContent>
                        </Tabs>
                    </div>
                </div>

                <DialogFooter className="mt-4 flex justify-between items-center">
                    <Button
                        variant="destructive"
                        onClick={handleDelete}
                        disabled={isDeleting}
                        className="rounded-xl"
                        size="sm"
                    >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                    </Button>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={onClose} className="rounded-xl" size="sm">Cancel</Button>
                        <Button onClick={handleSave} disabled={isSaving} className="rounded-xl" size="sm">
                            <Save className="h-4 w-4 mr-2" />
                            Save Changes
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
