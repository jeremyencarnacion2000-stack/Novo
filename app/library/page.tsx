'use client'

import { useState, useEffect } from 'react'
import { DashboardShell } from '@/components/dashboard-shell'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, BookOpen, FileText, Trash2, Minus } from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'

interface Book {
  id: string
  title: string
  author: string
  progress: number
  chapters: number
  currentChapter: number
  notes: number
  status: 'reading' | 'completed' | 'wishlist'
}

export default function LibraryPage() {
  const { toast } = useToast()
  const [books, setBooks] = useState<Book[]>([])
  const [isBookDialogOpen, setIsBookDialogOpen] = useState(false)
  const [newBook, setNewBook] = useState({ title: '', author: '', chapters: 1 })

  useEffect(() => {
    const savedBooks = localStorage.getItem('novo_books')
    if (savedBooks) {
      setBooks(JSON.parse(savedBooks))
    } else {
      setBooks([
        { 
          id: '1', 
          title: 'Atomic Habits', 
          author: 'James Clear', 
          progress: 75, 
          chapters: 20,
          currentChapter: 15,
          notes: 12,
          status: 'reading'
        },
        { 
          id: '2', 
          title: 'Deep Work', 
          author: 'Cal Newport', 
          progress: 100, 
          chapters: 12,
          currentChapter: 12,
          notes: 8,
          status: 'completed'
        },
      ])
    }
  }, [])

  useEffect(() => {
    if (books.length > 0) {
      localStorage.setItem('novo_books', JSON.stringify(books))
    }
  }, [books])

  const handleAddBook = () => {
    if (!newBook.title.trim() || !newBook.author.trim()) {
      toast({ title: 'Error', description: 'Please enter title and author', variant: 'destructive' })
      return
    }
    
    const book: Book = {
      id: Date.now().toString(),
      title: newBook.title,
      author: newBook.author,
      progress: 0,
      chapters: newBook.chapters,
      currentChapter: 0,
      notes: 0,
      status: 'wishlist'
    }
    
    setBooks([...books, book])
    setNewBook({ title: '', author: '', chapters: 1 })
    setIsBookDialogOpen(false)
    toast({ title: 'Success', description: 'Book added successfully' })
  }

  const handleContinueReading = (id: string) => {
    setBooks(books.map(book => {
      if (book.id === id && book.currentChapter < book.chapters) {
        const newChapter = book.currentChapter + 1
        const newProgress = Math.round((newChapter / book.chapters) * 100)
        return {
          ...book,
          currentChapter: newChapter,
          progress: newProgress,
          status: newProgress === 100 ? 'completed' : 'reading'
        }
      }
      return book
    }))
    toast({ title: 'Progress updated!' })
  }

  const handleDeleteBook = (id: string) => {
    setBooks(books.filter(b => b.id !== id))
    toast({ title: 'Book removed' })
  }

  const handleUpdateProgress = (id: string, increment: number) => {
    setBooks(books.map(book => {
      if (book.id === id) {
        const newChapter = Math.max(0, Math.min(book.chapters, book.currentChapter + increment))
        const newProgress = Math.round((newChapter / book.chapters) * 100)
        return {
          ...book,
          currentChapter: newChapter,
          progress: newProgress,
          status: newProgress === 100 ? 'completed' : newProgress > 0 ? 'reading' : 'wishlist'
        }
      }
      return book
    }))
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

        <div className="grid gap-4 md:gap-6 md:grid-cols-2">
          {books.map((book) => (
            <Card key={book.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
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
                      <Button variant="outline" size="sm">Notes</Button>
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
