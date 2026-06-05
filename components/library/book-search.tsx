'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { searchBooks, getCoverUrl, getPrimaryGenre, OpenLibraryBook } from '@/lib/open-library'
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
    const [hasSearched, setHasSearched] = useState(false)
    const { toast } = useToast()
    const debounceTimer = useRef<NodeJS.Timeout | null>(null)

    // Real-time search with debounce
    const debouncedSearch = useCallback((searchQuery: string) => {
        if (debounceTimer.current) {
            clearTimeout(debounceTimer.current)
        }

        if (!searchQuery.trim()) {
            setResults([])
            setHasSearched(false)
            return
        }

        if (searchQuery.trim().length < 2) return

        debounceTimer.current = setTimeout(async () => {
            setIsSearching(true)
            setHasSearched(true)
            try {
                const books = await searchBooks(searchQuery)
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
        }, 400) // 400ms debounce
    }, [toast])

    useEffect(() => {
        debouncedSearch(query)
        return () => {
            if (debounceTimer.current) clearTimeout(debounceTimer.current)
        }
    }, [query, debouncedSearch])

    const handleAdd = async (book: OpenLibraryBook) => {
        setAddingBookId(book.key)
        try {
            const coverUrl = getCoverUrl(book.cover_i, 'L')
            const genre = getPrimaryGenre(book.subject)

            await onAddBook({
                title: book.title,
                author: book.author_name?.[0] || 'Unknown Author',
                coverUrl,
                totalPages: book.number_of_pages_median || 0,
                isbn: book.isbn?.[0],
                genre,
                status: 'to-read'
            })
        } finally {
            setAddingBookId(null)
        }
    }

    return (
        <div className="space-y-6">
            <div className="relative max-w-lg">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Search by title, author, or ISBN..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="pl-10 bg-background/50 backdrop-blur-sm border-border/50 rounded-xl focus-visible:ring-primary/50 h-11"
                    autoFocus
                />
                {isSearching && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-primary" />
                )}
            </div>

            {!hasSearched && !query && (
                <div className="text-center py-12 text-muted-foreground">
                    <Search className="h-12 w-12 mx-auto mb-4 opacity-30" />
                    <p className="font-medium">Search for books</p>
                    <p className="text-sm mt-1">Start typing to find books from Open Library's catalog</p>
                </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
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
                                {book.subject && book.subject.length > 0 && (
                                    <div className="absolute top-2 left-2">
                                        <Badge
                                            variant="secondary"
                                            className="backdrop-blur-md bg-black/60 text-white border-0 text-[10px] capitalize"
                                        >
                                            {getPrimaryGenre(book.subject)}
                                        </Badge>
                                    </div>
                                )}
                            </div>
                            <CardTitle className="text-base line-clamp-2 font-semibold tracking-tight" title={book.title}>
                                {book.title}
                            </CardTitle>
                            <p className="text-sm text-muted-foreground line-clamp-1">
                                {book.author_name?.join(', ') || 'Unknown Author'}
                            </p>
                        </CardHeader>
                        <CardContent className="p-4 pt-0 flex-1">
                            <div className="text-xs text-muted-foreground space-y-0.5">
                                {book.first_publish_year && <p>Published: {book.first_publish_year}</p>}
                                {book.number_of_pages_median ? <p>{book.number_of_pages_median} pages</p> : null}
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

            {results.length === 0 && hasSearched && !isSearching && (
                <div className="text-center py-12 text-muted-foreground">
                    No books found. Try a different search term.
                </div>
            )}
        </div>
    )
}
