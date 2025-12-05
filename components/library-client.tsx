'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { DashboardShell } from '@/components/dashboard-shell'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, BookOpen, FileText, Trash2, Minus, Loader2 } from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { GoogleBooksSearch } from '@/components/books/google-books-search'

interface Book {
  id: string
  title: string
  author: string
  progress: number
  chapters: number
  currentChapter: number
  notes: number
  coverUrl: string | null
  status: 'reading' | 'completed' | 'wishlist'
}

export default function LibraryClient() {
  const { data: session } = useSession()
  const [isClient, setIsClient] = useState(false)
  const { toast } = useToast()
  const [books, setBooks] = useState<Book[]>([])
  const [isBookDialogOpen, setIsBookDialogOpen] = useState(false)
  const [newBook, setNewBook] = useState({ title: '', author: '', chapters: 1 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    if (!session?.user?.id || !isClient) return

    const fetchBooks = async () => {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch('/api/books')
        const booksData = await response.json()
        const books = response.ok && Array.isArray(booksData) ? booksData : []
        setBooks(books)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
        console.error('Failed to fetch books:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchBooks()
  }, [session?.user?.id, isClient])


  const handleAddBook = async () => {
    if (!newBook.title.trim() || !newBook.author.trim()) {
      toast({ title: 'Error', description: 'Please enter title and author', variant: 'destructive' })
      return
    }

    try {
      const response = await fetch('/api/books', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newBook.title,
          author: newBook.author,
          status: 'wishlist',
          chapters: newBook.chapters
        })
      })

      if (!response.ok) throw new Error('Failed to add book')

      const newBookItem = await response.json()
      setBooks([...books, newBookItem])
      setNewBook({ title: '', author: '', chapters: 1 })
      setIsBookDialogOpen(false)
      toast({ title: 'Success', description: 'Book added successfully' })
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to add book', variant: 'destructive' })
      console.error('Failed to add book:', error)
    }
  }

  const handleContinueReading = async (id: string) => {
    const book = books.find(b => b.id === id)
    if (!book || book.currentChapter >= book.chapters) return

    const newChapter = book.currentChapter + 1
    const newProgress = Math.round((newChapter / book.chapters) * 100)
    const newStatus = newProgress === 100 ? 'completed' : 'reading'

    try {
      const response = await fetch(`/api/books/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentChapter: newChapter,
          progress: newProgress,
          status: newStatus
        })
      })

      if (!response.ok) throw new Error('Failed to update progress')

      setBooks(books.map(b => b.id === id ? {
        ...b,
        currentChapter: newChapter,
        progress: newProgress,
        status: newStatus
      } : b))
      toast({ title: 'Progress updated!' })
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to update progress', variant: 'destructive' })
      console.error('Failed to update progress:', error)
    }
  }

  const handleDeleteBook = async (id: string) => {
    try {
      const response = await fetch(`/api/books/${id}`, {
        method: 'DELETE'
      })

      if (!response.ok) throw new Error('Failed to delete book')

      setBooks(books.filter(b => b.id !== id))
      toast({ title: 'Book removed' })
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to delete book', variant: 'destructive' })
      console.error('Failed to delete book:', error)
    }
  }

  const handleUpdateProgress = async (id: string, increment: number) => {
    const book = books.find(b => b.id === id)
    if (!book) return

    const newChapter = Math.max(0, Math.min(book.chapters, book.currentChapter + increment))
    const newProgress = Math.round((newChapter / book.chapters) * 100)
    const newStatus = newProgress === 100 ? 'completed' : newProgress > 0 ? 'reading' : 'wishlist'

    try {
      const response = await fetch(`/api/books/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentChapter: newChapter,
          progress: newProgress,
          status: newStatus
        })
      })

      if (!response.ok) throw new Error('Failed to update progress')

      setBooks(books.map(b => b.id === id ? {
        ...b,
        currentChapter: newChapter,
        progress: newProgress,
        status: newStatus
      } : b))
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to update progress', variant: 'destructive' })
      console.error('Failed to update progress:', error)
    }
  }

  if (loading) {
    return (
      <DashboardShell>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading...</span>
        </div>
      </DashboardShell>
    )
  }

  if (error) {
    return (
      <DashboardShell>
        <div className="flex items-center justify-center h-64">
          <p className="text-destructive">Error: {error}</p>
        </div>
      </DashboardShell>
    )
  }

  return (
    <DashboardShell>
      <div className="flex flex-col gap-6 md:gap-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Reading Library</h1>
            <p className="text-muted-foreground mt-1 text-sm md:text-base">
              Track books, notes, and AI-generated summaries
            </p>
          </div>
          <Dialog open={isBookDialogOpen} onOpenChange={setIsBookDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto">
                <Plus className="h-4 w-4 mr-2" />
                Add Book
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Book</DialogTitle>
                <DialogDescription>Add a book to your reading library</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="book-title">Title</Label>
                  <Input
                    id="book-title"
                    value={newBook.title}
                    onChange={(e) => setNewBook({ ...newBook, title: e.target.value })}
                    placeholder="Book title"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="book-author">Author</Label>
                  <Input
                    id="book-author"
                    value={newBook.author}
                    onChange={(e) => setNewBook({ ...newBook, author: e.target.value })}
                    placeholder="Author name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="book-chapters">Number of Chapters</Label>
                  <Input
                    id="book-chapters"
                    type="number"
                    min="1"
                    value={newBook.chapters}
                    onChange={(e) => setNewBook({ ...newBook, chapters: parseInt(e.target.value) || 1 })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleAddBook}>Add Book</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4 md:gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardDescription>Total Books</CardDescription>
              <CardTitle className="text-3xl">{books.length}</CardTitle>
            </CardHeader>
            <CardContent>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Currently Reading</CardDescription>
              <CardTitle className="text-3xl">{books.filter(b => b.status === 'reading').length}</CardTitle>
            </CardHeader>
            <CardContent>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Total Notes</CardDescription>
              <CardTitle className="text-3xl">{books.reduce((sum, b) => sum + b.notes, 0)}</CardTitle>
            </CardHeader>
            <CardContent>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </div>

        <GoogleBooksSearch onAddBook={(book) => {
          // Refresh books list after adding
          fetch('/api/books')
            .then(res => res.json())
            .then(data => setBooks(Array.isArray(data) ? data : []))
            .catch(console.error)
        }} />

        <div className="grid gap-4 md:gap-6 md:grid-cols-2">
          {books.map((book) => (
            <Card key={book.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  {book.coverUrl && (
                    <img
                      src={book.coverUrl}
                      alt={`${book.title} cover`}
                      className="w-12 h-16 object-cover rounded mr-3 flex-shrink-0"
                    />
                  )}
                  <div className="flex-1">
                    <CardTitle className="text-lg">{book.title}</CardTitle>
                    <CardDescription className="mt-1">{book.author}</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={book.status === 'reading' ? 'default' : book.status === 'completed' ? 'secondary' : 'outline'}>
                      {book.status}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteBook(book.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-muted-foreground">Chapter {book.currentChapter} of {book.chapters}</span>
                      <span className="font-medium">{book.progress}%</span>
                    </div>
                    <Progress value={book.progress} className="h-2" />
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t">
                    <span className="text-sm text-muted-foreground">{book.notes} notes</span>
                    <div className="flex gap-2 items-center">
                      <div className="flex items-center gap-1 mr-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleUpdateProgress(book.id, -1)}
                          disabled={book.currentChapter === 0}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleUpdateProgress(book.id, 1)}
                          disabled={book.currentChapter === book.chapters}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toast({ title: 'Coming Soon', description: 'Notes feature is currently under development.' })}
                      >
                        Notes
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardShell>
  )
}