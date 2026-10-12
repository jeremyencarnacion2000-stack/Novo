'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { BookSearch } from '@/components/library/book-search'
import { LibraryGrid } from '@/components/library/library-grid'
import { BookDetailsDialog } from '@/components/library/book-details-dialog'
import { BookRecommendations } from '@/components/library/book-recommendations'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Library as LibraryIcon, Search, ArrowUpDown, Sparkles, X } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { ScrollReveal } from '@/components/ui/scroll-reveal'
import { createClientIdempotencyKey } from '@/lib/client-idempotency'

export default function LibraryPage() {
  const [books, setBooks] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedBook, setSelectedBook] = useState<any>(null)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [view, setView] = useState<'library' | 'search' | 'discover'>('library')
  const [sortBy, setSortBy] = useState<'recent' | 'title' | 'author' | 'rating'>('recent')
  const [filterQuery, setFilterQuery] = useState('')
  const bookIntentKeys = useRef(new Map<string, { fingerprint: string; key: string }>())
  const { toast } = useToast()

  const fetchBooks = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/books', { cache: 'no-store', signal })
      if (!response.ok) throw new Error(`Library request failed: ${response.status}`)
      const data = await response.json()
      if (!signal?.aborted) setBooks(Array.isArray(data) ? data : [])
    } catch (error: unknown) {
      if ((error as { name?: string })?.name === 'AbortError' || signal?.aborted) return
      console.error('Failed to fetch books:', error)
      toast({
        title: 'Error',
        description: 'Failed to load your library.',
        variant: 'destructive',
      })
    } finally {
      if (!signal?.aborted) setIsLoading(false)
    }
  }, [toast])

  useEffect(() => {
    const controller = new AbortController()
    void fetchBooks(controller.signal)
    return () => controller.abort()
  }, [fetchBooks])

  const handleBookClick = (book: any) => {
    setSelectedBook(book)
    setIsDetailsOpen(true)
  }

  const handleBookUpdate = async () => {
    await fetchBooks()
    setIsDetailsOpen(false)
  }

  const handleAddBook = async (bookData: any) => {
    // Keep the same intent key when a response is lost. The server can then
    // replay the original book instead of inserting a second copy; changing
    // the payload starts a new intent while repeated adds remain harmless.
    const identity = String(bookData.externalId || bookData.isbn || `${bookData.title}:${bookData.author}`).trim().toLowerCase()
    const fingerprint = JSON.stringify(bookData)
    const previous = bookIntentKeys.current.get(identity)
    const intent = previous?.fingerprint === fingerprint
      ? previous
      : { fingerprint, key: createClientIdempotencyKey() }
    bookIntentKeys.current.set(identity, intent)
    try {
      const response = await fetch('/api/books', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': intent.key },
        body: JSON.stringify(bookData),
      })

      if (response.ok) {
        const replayed = response.headers.get('X-Idempotent-Replay') === 'true'
        toast({
          title: replayed ? 'Already in your library' : 'Book added',
          description: replayed
            ? 'Novo kept the existing copy instead of adding a duplicate.'
            : 'Book added to your library successfully.',
        })
        bookIntentKeys.current.delete(identity)
        await fetchBooks()
        if (view === 'search') {
          // Stay on search so user can add more
        }
      } else {
        throw new Error('Failed to add book')
      }
    } catch (error) {
      console.error('Error adding book:', error)
      toast({
        title: 'Error',
        description: 'Failed to add book to library.',
        variant: 'destructive',
      })
    }
  }

  // Real-time filtering of user's books
  const filteredBooks = useMemo(() => {
    let filtered = [...books]

    // Apply text filter
    if (filterQuery.trim()) {
      const q = filterQuery.toLowerCase()
      filtered = filtered.filter(book =>
        book.title?.toLowerCase().includes(q) ||
        book.author?.toLowerCase().includes(q) ||
        book.genre?.toLowerCase().includes(q)
      )
    }

    // Apply sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'title':
          return (a.title || '').localeCompare(b.title || '')
        case 'author':
          return (a.author || '').localeCompare(b.author || '')
        case 'rating':
          return (b.rating || 0) - (a.rating || 0)
        case 'recent':
        default:
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      }
    })

    return filtered
  }, [books, filterQuery, sortBy])

  return (
    <div className="flex-1 h-full p-4 md:p-8 pt-6 overflow-hidden">
      <div className="liquid-glass h-full flex flex-col space-y-4 bg-background/80 backdrop-blur-xl rounded-3xl border border-border/50 shadow-2xl p-4 md:p-6 overflow-hidden">
        {/* Header */}
        <ScrollReveal className="flex-shrink-0">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Library</h2>
          <div className="flex items-center space-x-1 bg-secondary/50 p-1 rounded-xl backdrop-blur-md">
            <Button
              variant={view === 'library' ? 'secondary' : 'ghost'}
              onClick={() => setView('library')}
              size="sm"
              className={`rounded-lg transition-all text-xs ${view === 'library' ? 'bg-background shadow-sm' : 'hover:bg-background/50'}`}
            >
              <LibraryIcon className="mr-1.5 h-3.5 w-3.5" />
              My Books
            </Button>
            <Button
              variant={view === 'search' ? 'secondary' : 'ghost'}
              onClick={() => setView('search')}
              size="sm"
              className={`group rounded-lg transition-all text-xs ${view === 'search' ? 'bg-background shadow-sm' : 'hover:bg-background/50'}`}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5 transition-transform duration-300 group-hover:rotate-90" />
              Add Book
            </Button>
            <Button
              variant={view === 'discover' ? 'secondary' : 'ghost'}
              onClick={() => setView('discover')}
              size="sm"
              className={`group rounded-lg transition-all text-xs ${view === 'discover' ? 'bg-background shadow-sm' : 'hover:bg-background/50'}`}
            >
              <Sparkles className="mr-1.5 h-3.5 w-3.5 transition-transform duration-300 group-hover:scale-125" />
              Discover
            </Button>
          </div>
        </div>
        </ScrollReveal>

        {/* Filter bar for My Books */}
        {view === 'library' && (
          <div className="flex flex-col sm:flex-row gap-2 px-1 flex-shrink-0">
            <div className="relative w-64 focus-within:w-80 max-w-full transition-all duration-300 ease-out">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Filter by title, author, or genre..."
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                className="pl-9 pr-8 h-9 bg-background/50 backdrop-blur-sm border-border/50 rounded-xl focus-visible:ring-primary/50 focus:bg-foreground/10 text-sm w-full"
              />
              {filterQuery && (
                <button
                  onClick={() => setFilterQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
              <SelectTrigger className="w-full sm:w-[160px] h-9 bg-background/50 backdrop-blur-sm border-border/50 rounded-xl text-sm">
                <ArrowUpDown className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="recent">Recently Updated</SelectItem>
                <SelectItem value="title">Title</SelectItem>
                <SelectItem value="author">Author</SelectItem>
                <SelectItem value="rating">Rating</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto min-h-0 custom-scrollbar rounded-xl bg-background/40 border border-border/50 p-4">
          {view === 'library' && (
            <LibraryGrid
              books={filteredBooks}
              isLoading={isLoading}
              onBookClick={handleBookClick}
            />
          )}
          {view === 'search' && (
            <BookSearch onAddBook={handleAddBook} />
          )}
          {view === 'discover' && (
            <BookRecommendations onAddBook={handleAddBook} />
          )}
        </div>
      </div>

      <BookDetailsDialog
        book={selectedBook}
        isOpen={isDetailsOpen}
        onClose={() => setIsDetailsOpen(false)}
        onUpdate={handleBookUpdate}
      />
    </div>
  )
}
