'use client'

import { useState, useEffect } from 'react'
import { BookSearch } from '@/components/library/book-search'
import { LibraryGrid } from '@/components/library/library-grid'
import { BookDetailsDialog } from '@/components/library/book-details-dialog'
import { Button } from '@/components/ui/button'
import { Plus, Library as LibraryIcon, Search, ArrowUpDown } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'

export default function LibraryPage() {
  const [books, setBooks] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedBook, setSelectedBook] = useState<any>(null)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [view, setView] = useState<'library' | 'search'>('library')
  const [sortBy, setSortBy] = useState<'recent' | 'title' | 'author' | 'rating'>('recent')
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
        setView('library')
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

  return (
    <div className="flex-1 h-full p-4 md:p-8 pt-6 overflow-hidden">
      <div className="h-full flex flex-col space-y-4 bg-background/80 backdrop-blur-xl rounded-3xl border border-border/50 shadow-2xl p-6 overflow-hidden">
        <div className="flex items-center justify-between space-y-2 flex-shrink-0">
          <h2 className="text-3xl font-bold tracking-tight">Library</h2>
          <div className="flex items-center space-x-2 bg-secondary/50 p-1 rounded-xl backdrop-blur-md">
            <Button
              variant={view === 'library' ? 'secondary' : 'ghost'}
              onClick={() => setView('library')}
              className={`rounded-lg transition-all ${view === 'library' ? 'bg-background shadow-sm' : 'hover:bg-background/50'}`}
            >
              <LibraryIcon className="mr-2 h-4 w-4" />
              My Books
            </Button>
            <Button
              variant={view === 'search' ? 'secondary' : 'ghost'}
              onClick={() => setView('search')}
              className={`rounded-lg transition-all ${view === 'search' ? 'bg-background shadow-sm' : 'hover:bg-background/50'}`}
            >
              <Search className="mr-2 h-4 w-4" />
              Add Book
            </Button>
          </div>
        </div>

        {view === 'library' && (
          <div className="flex justify-end px-2">
            <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
              <SelectTrigger className="w-[180px] bg-background/50 backdrop-blur-sm border-border/50 rounded-xl">
                <ArrowUpDown className="w-4 h-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Recently Updated</SelectItem>
                <SelectItem value="title">Title</SelectItem>
                <SelectItem value="author">Author</SelectItem>
                <SelectItem value="rating">Rating</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}


        <div className="flex-1 overflow-y-auto min-h-0 custom-scrollbar rounded-xl bg-background/40 border border-border/50 p-4">
          {view === 'library' ? (
            <LibraryGrid
              books={[...books].sort((a, b) => {
                switch (sortBy) {
                  case 'title':
                    return a.title.localeCompare(b.title)
                  case 'author':
                    return a.author.localeCompare(b.author)
                  case 'rating':
                    return (b.rating || 0) - (a.rating || 0)
                  case 'recent':
                  default:
                    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
                }
              })}
              isLoading={isLoading}
              onBookClick={handleBookClick}
            />
          ) : (
            <BookSearch onAddBook={handleAddBook} />
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
