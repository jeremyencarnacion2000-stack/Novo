"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, Plus, BookOpen, Loader2 } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useToast } from "@/hooks/use-toast"

interface GoogleBook {
    id: string
    title: string
    authors: string[]
    description: string
    thumbnail: string
    pageCount: number
}

interface GoogleBooksSearchProps {
    onAddBook?: (book: { title: string; author: string; coverUrl: string; chapters: number }) => void
}

export function GoogleBooksSearch({ onAddBook }: GoogleBooksSearchProps) {
    const [query, setQuery] = useState("")
    const [results, setResults] = useState<GoogleBook[]>([])
    const [loading, setLoading] = useState(false)
    const [searched, setSearched] = useState(false)
    const { toast } = useToast()

    const handleSearch = async () => {
        if (!query.trim()) return

        setLoading(true)
        setSearched(true)
        try {
            const res = await fetch(`/api/books/search?q=${encodeURIComponent(query)}`)
            if (res.ok) {
                const data = await res.json()
                setResults(data || [])
            } else {
                toast({ title: "Error", description: "Failed to search books", variant: "destructive" })
            }
        } catch (error) {
            console.error("Search failed:", error)
            toast({ title: "Error", description: "Failed to search books", variant: "destructive" })
        } finally {
            setLoading(false)
        }
    }

    const handleAddToLibrary = async (book: GoogleBook) => {
        try {
            const response = await fetch('/api/books', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: book.title,
                    author: book.authors?.join(', ') || 'Unknown',
                    status: 'wishlist',
                    chapters: book.pageCount || 10, // Estimate if not available
                    coverUrl: book.thumbnail || null
                })
            })

            if (!response.ok) throw new Error('Failed to add book')

            toast({ title: 'Success', description: `${book.title} added to your library!` })

            if (onAddBook) {
                onAddBook({
                    title: book.title,
                    author: book.authors?.join(', ') || 'Unknown',
                    coverUrl: book.thumbnail || '',
                    chapters: book.pageCount || 10
                })
            }
        } catch (error) {
            toast({ title: 'Error', description: 'Failed to add book', variant: 'destructive' })
            console.error('Failed to add book:', error)
        }
    }

    return (
        <Card className="col-span-full">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Search className="h-5 w-5 text-blue-500" />
                    Search Google Books
                </CardTitle>
                <CardDescription>Find and add books from Google's vast library</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex gap-2">
                    <Input
                        placeholder="Search for books..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    />
                    <Button onClick={handleSearch} disabled={loading || !query.trim()}>
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    </Button>
                </div>

                <ScrollArea className="h-[400px] pr-4">
                    {loading ? (
                        <div className="flex items-center justify-center h-full">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : results.length > 0 ? (
                        <div className="space-y-4">
                            {results.map((book) => (
                                <div
                                    key={book.id}
                                    className="flex gap-4 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                                >
                                    {book.thumbnail && (
                                        <img
                                            src={book.thumbnail}
                                            alt={book.title}
                                            className="w-16 h-24 object-cover rounded flex-shrink-0"
                                        />
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-semibold text-sm line-clamp-2">{book.title}</h3>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {book.authors?.join(', ') || 'Unknown Author'}
                                        </p>
                                        <p className="text-xs text-muted-foreground line-clamp-2 mt-2">
                                            {book.description || 'No description available'}
                                        </p>
                                        {book.pageCount && (
                                            <p className="text-xs text-muted-foreground mt-1">{book.pageCount} pages</p>
                                        )}
                                    </div>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleAddToLibrary(book)}
                                        className="flex-shrink-0"
                                    >
                                        <Plus className="h-4 w-4 mr-1" />
                                        Add
                                    </Button>
                                </div>
                            ))}
                        </div>
                    ) : searched ? (
                        <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                            <BookOpen className="h-12 w-12 mb-2 opacity-50" />
                            <p>No books found</p>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                            <Search className="h-12 w-12 mb-2 opacity-50" />
                            <p>Search for books to get started</p>
                        </div>
                    )}
                </ScrollArea>
            </CardContent>
        </Card>
    )
}
