'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { searchBooks, getCoverUrl, OpenLibraryBook } from '@/lib/open-library'
import { Loader2, Plus, Search, BookOpen } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface BookSearchProps {
    onAddBook: (book: any) => void
}

export function BookSearch({ onAddBook }: BookSearchProps) {
    const [query, setQuery] = useState('')
    const [results, setResults] = useState<OpenLibraryBook[]>([])
    const [isSearching, setIsSearching] = useState(false)
    const [addingBookId, setAddingBookId] = useState<string | null>(null)
    const { toast } = useToast()

    const handleSearch = async () => {
        if (!query.trim()) return

        setIsSearching(true)
        try {
            const books = await searchBooks(query)
            setResults(books)
        } catch (error) {
            console.error('Search failed:', error)
            toast({
                title: 'Search failed',
                description: 'Could not fetch results from Open Library.',
                variant: 'destructive',
            })
        } finally {
            setIsSearching(false)
        }
    }

    const handleAdd = async (book: OpenLibraryBook) => {
        setAddingBookId(book.key)
        try {
            const coverUrl = getCoverUrl(book.cover_i, 'L')

            await onAddBook({
                title: book.title,
                author: book.author_name?.[0] || 'Unknown Author',
                coverUrl,
                totalPages: book.number_of_pages_median || 0,
                isbn: book.isbn?.[0],
                status: 'to-read'
            })
        } finally {
            setAddingBookId(null)
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex gap-2">
                <Input
                    placeholder="Search by title, author, or ISBN..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    className="max-w-md bg-background/50 backdrop-blur-sm border-border/50 rounded-xl focus-visible:ring-primary/50"
                />
                <Button onClick={handleSearch} disabled={isSearching} className="rounded-xl">
                    {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    <span className="ml-2">Search</span>
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {results.map((book) => (
                    <Card key={book.key} className="flex flex-col bg-card/50 backdrop-blur-md border-border/50 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all hover:bg-card/80">
                        <CardHeader className="p-4">
                            <div className="aspect-[2/3] relative bg-muted/50 rounded-lg overflow-hidden mb-3 shadow-inner">
                                {book.cover_i ? (
                                    <img
                                        src={getCoverUrl(book.cover_i, 'M') || ''}
                                        alt={book.title}
                                        className="object-cover w-full h-full hover:scale-105 transition-transform duration-500"
                                    />
                                ) : (
                                    <div className="flex items-center justify-center h-full text-muted-foreground">
                                        <BookOpen className="h-12 w-12 opacity-50" />
                                    </div>
                                )}
                            </div>
                            <CardTitle className="text-lg line-clamp-1 font-semibold tracking-tight" title={book.title}>
                                {book.title}
                            </CardTitle>
                            <p className="text-sm text-muted-foreground line-clamp-1">
                                {book.author_name?.join(', ') || 'Unknown Author'}
                            </p>
                        </CardHeader>
                        <CardContent className="p-4 pt-0 flex-1">
                            <div className="text-xs text-muted-foreground space-y-1">
                                <p>{book.first_publish_year ? `Published: ${book.first_publish_year}` : ''}</p>
                                <p>{book.number_of_pages_median ? `${book.number_of_pages_median} pages` : ''}</p>
                            </div>
                        </CardContent>
                        <CardFooter className="p-4 pt-0">
                            <Button
                                className="w-full rounded-lg"
                                onClick={() => handleAdd(book)}
                                disabled={addingBookId === book.key}
                                variant="secondary"
                            >
                                {addingBookId === book.key ? (
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                ) : (
                                    <Plus className="h-4 w-4 mr-2" />
                                )}
                                Add to Library
                            </Button>
                        </CardFooter>
                    </Card>
                ))}
            </div>

            {results.length === 0 && !isSearching && query && (
                <div className="text-center py-12 text-muted-foreground">
                    No books found. Try a different search term.
                </div>
            )}
        </div>
    )
}
