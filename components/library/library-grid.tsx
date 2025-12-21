'use client'

import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { BookOpen, Star, Clock, CheckCircle } from 'lucide-react'

interface LibraryGridProps {
    books: any[]
    isLoading: boolean
    onBookClick: (book: any) => void
}

export function LibraryGrid({ books, isLoading, onBookClick }: LibraryGridProps) {
    if (isLoading) {
        return <div className="text-center py-12">Loading library...</div>
    }

    if (books.length === 0) {
        return (
            <div className="text-center py-12 text-muted-foreground">
                Your library is empty. Search for books to add them!
            </div>
        )
    }

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'read': return <CheckCircle className="h-4 w-4 text-green-500" />
            case 'reading': return <BookOpen className="h-4 w-4 text-blue-500" />
            default: return <Clock className="h-4 w-4 text-gray-400" />
        }
    }

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'read': return 'Read'
            case 'reading': return 'Reading'
            default: return 'To Read'
        }
    }

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {books.map((book) => {
                const progress = book.totalPages ? Math.round((book.currentPage / book.totalPages) * 100) : 0

                return (
                    <Card
                        key={book.id}
                        className="group cursor-pointer hover:shadow-lg transition-all duration-300 border-0 bg-card/50 hover:bg-card"
                        onClick={() => onBookClick(book)}
                    >
                        <CardContent className="p-4">
                            <div className="aspect-[2/3] relative rounded-md overflow-hidden mb-3 shadow-md group-hover:shadow-xl transition-all">
                                {book.coverUrl ? (
                                    <img
                                        src={book.coverUrl}
                                        alt={book.title}
                                        className="object-cover w-full h-full"
                                    />
                                ) : (
                                    <div className="flex items-center justify-center h-full bg-muted text-muted-foreground">
                                        <BookOpen className="h-12 w-12" />
                                    </div>
                                )}
                                <div className="absolute top-2 right-2">
                                    <Badge variant="secondary" className="backdrop-blur-md bg-black/50 text-white border-0">
                                        {getStatusIcon(book.status)}
                                        <span className="ml-1 text-xs">{getStatusLabel(book.status)}</span>
                                    </Badge>
                                </div>
                            </div>

                            <h3 className="font-semibold line-clamp-1 mb-1" title={book.title}>
                                {book.title}
                            </h3>
                            <p className="text-sm text-muted-foreground line-clamp-1 mb-2">
                                {book.author}
                            </p>

                            {book.status === 'reading' && (
                                <div className="space-y-1">
                                    <Progress value={progress} className="h-1.5" />
                                    <p className="text-xs text-muted-foreground text-right">{progress}%</p>
                                </div>
                            )}

                            {book.rating > 0 && (
                                <div className="flex items-center gap-1 mt-2">
                                    <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                                    <span className="text-xs font-medium">{book.rating}</span>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )
            })}
        </div>
    )
}
