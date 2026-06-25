'use client'

import { useState, useEffect, useMemo } from 'react'
import { BookSearch } from '@/components/library/book-search'
import { LibraryGrid } from '@/components/library/library-grid'
import { BookDetailsDialog } from '@/components/library/book-details-dialog'
import { BookRecommendations } from '@/components/library/book-recommendations'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Library as LibraryIcon, Search, ArrowUpDown, Sparkles, X } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'

export default function LibraryPage() {
  const [books, setBooks] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedBook, setSelectedBook] = useState<any>(null)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [view, setView] = useState<'library' | 'search' | 'discover'>('library')
  const [sortBy, setSortBy] = useState<'recent' | 'title' | 'author' | 'rating'>('recent')
  const [filterQuery, setFilterQuery] = useState('')
  const { toast } = useToast()

  const fetchBooks = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/books')
      if (response.ok) {
        const data = await response.json()
        setBooks(data)
      }
    } catch (error) {
      console.error('Failed to fetch books:', error)
      toast({
        title: 'Error',
        description: 'Failed to load your library.',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchBooks()
  }, [])

  const handleBookClick = (book: any) => {
    setSelectedBook(book)
    setIsDetailsOpen(true)
  }

  const handleBookUpdate = async () => {
    await fetchBooks()
    setIsDetailsOpen(false)
  }

  const handleAddBook = async (bookData: any) => {
    try {
      const response = await fetch('/api/books', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bookData),
      })

      if (response.ok) {
        toast({
          title: 'Book added',
          description: 'Book added to your library successfully.',
        })
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
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 flex-shrink-0">
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
              className={`rounded-lg transition-all text-xs ${view === 'search' ? 'bg-background shadow-sm' : 'hover:bg-background/50'}`}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add Book
            </Button>
            <Button
              variant={view === 'discover' ? 'secondary' : 'ghost'}
              onClick={() => setView('discover')}
              size="sm"
              className={`rounded-lg transition-all text-xs ${view === 'discover' ? 'bg-background shadow-sm' : 'hover:bg-background/50'}`}
            >
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              Discover
            </Button>
          </div>
        </div>

        {/* Filter bar for My Books */}
        {view === 'library' && (
          <div className="flex flex-col sm:flex-row gap-2 px-1 flex-shrink-0">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Filter by title, author, or genre..."
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                className="pl-9 pr-8 h-9 bg-background/50 backdrop-blur-sm border-border/50 rounded-xl focus-visible:ring-primary/50 text-sm"
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
