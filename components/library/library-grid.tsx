'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { BookOpen, Star, Clock, CheckCircle, BookMarked, Smartphone, Headphones } from 'lucide-react'
import { motion } from 'framer-motion'
import { springConfig } from '@/lib/design-tokens'

interface LibraryGridProps {
    books: any[]
    isLoading: boolean
    onBookClick: (book: any) => void
}

export function LibraryGrid({ books, isLoading, onBookClick }: LibraryGridProps) {
    if (isLoading) {
        return (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
                {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="animate-pulse">
                        <div className="aspect-[2/3] bg-muted/50 rounded-xl mb-3" />
                        <div className="h-4 bg-muted/50 rounded w-3/4 mb-2" />
                        <div className="h-3 bg-muted/50 rounded w-1/2" />
                    </div>
                ))}
            </div>
        )
    }

    if (books.length === 0) {
        return (
            <div className="text-center py-12 text-muted-foreground">
                <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="font-medium">Your library is empty</p>
                <p className="text-sm mt-1">Search for books to add them!</p>
            </div>
        )
    }

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'read': return <CheckCircle className="h-3.5 w-3.5 text-green-500" />
            case 'reading': return <BookOpen className="h-3.5 w-3.5 text-blue-500" />
            default: return <Clock className="h-3.5 w-3.5 text-gray-400" />
        }
    }

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'read': return 'Read'
            case 'reading': return 'Reading'
            default: return 'To Read'
        }
    }

    const getFormatIcon = (format: string) => {
        switch (format) {
            case 'physical': return <BookMarked className="h-3 w-3" />
            case 'audiobook': return <Headphones className="h-3 w-3" />
            default: return <Smartphone className="h-3 w-3" />
        }
    }

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
            {books.map((book, i) => {
                const progress = book.totalPages ? Math.round((book.currentPage / book.totalPages) * 100) : 0

                return (
                    <motion.div
                        key={book.id}
                        initial={{ opacity: 0, y: 18 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ ...springConfig.gentle, delay: Math.min(i, 20) * 0.04 }}
                    >
                    <Card
                        className="group cursor-pointer hover:shadow-lg transition-all duration-300 border-0 bg-card/50 hover:bg-card rounded-xl overflow-hidden"
                        onClick={() => onBookClick(book)}
                    >
                        <CardContent className="p-3 md:p-4">
                            <div className="aspect-[2/3] relative rounded-lg overflow-hidden mb-3 shadow-md group-hover:shadow-xl transition-all">
                                {book.coverUrl ? (
                                    <img
                                        src={book.coverUrl}
                                        alt={book.title}
                                        className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500"
                                    />
                                ) : (
                                    <div className="flex items-center justify-center h-full bg-muted text-muted-foreground">
                                        <BookOpen className="h-10 w-10 opacity-50" />
                                    </div>
                                )}
                                {/* Status Badge */}
                                <div className="absolute top-2 right-2">
                                    <Badge variant="secondary" className="bg-black/60 text-white border-0 text-[10px]" style={{ backdropFilter: 'blur(var(--glass-blur))', WebkitBackdropFilter: 'blur(var(--glass-blur))' }}>
                                        {getStatusIcon(book.status)}
                                        <span className="ml-1">{getStatusLabel(book.status)}</span>
                                    </Badge>
                                </div>
                                {/* Format Badge */}
                                <div className="absolute top-2 left-2">
                                    <Badge variant="secondary" className="bg-black/60 text-white border-0 px-1.5 py-0.5" style={{ backdropFilter: 'blur(var(--glass-blur))', WebkitBackdropFilter: 'blur(var(--glass-blur))' }}>
                                        {getFormatIcon(book.format)}
                                    </Badge>
                                </div>
                                {/* Genre Badge */}
                                {book.genre && (
                                    <div className="absolute bottom-2 left-2">
                                        <Badge variant="secondary" className="bg-primary/80 text-white border-0 text-[9px] capitalize" style={{ backdropFilter: 'blur(var(--glass-blur))', WebkitBackdropFilter: 'blur(var(--glass-blur))' }}>
                                            {book.genre}
                                        </Badge>
                                    </div>
                                )}
                            </div>

                            <h3 className="font-semibold text-sm line-clamp-1 mb-0.5" title={book.title}>
                                {book.title}
                            </h3>
                            <p className="text-xs text-muted-foreground line-clamp-1 mb-2">
                                {book.author}
                            </p>

                            {book.status === 'reading' && (
                                <div className="space-y-1">
                                    <Progress value={progress} className="h-1.5" />
                                    <div className="flex justify-between items-center">
                                        <p className="text-[10px] text-muted-foreground">
                                            p.{book.currentPage}/{book.totalPages || '?'}
                                        </p>
                                        <p className="text-[10px] text-muted-foreground font-medium">{progress}%</p>
                                    </div>
                                </div>
                            )}

                            {book.rating > 0 && (
                                <div className="flex items-center gap-1 mt-1.5">
                                    {Array.from({ length: 5 }).map((_, i) => (
                                        <Star
                                            key={i}
                                            className={`h-3 w-3 ${i < book.rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/20'}`}
                                        />
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                    </motion.div>
                )
            })}
        </div>
    )
}
