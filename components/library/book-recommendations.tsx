'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, Plus, RefreshCw, BookOpen, Sparkles, TrendingUp } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface Recommendation {
    key: string
    title: string
    author: string
    coverUrl: string | null
    totalPages: number
    isbn?: string
    genre?: string
    year?: number
    reason: string
}

interface BookRecommendationsProps {
    onAddBook: (book: any) => void
}

export function BookRecommendations({ onAddBook }: BookRecommendationsProps) {
    const [recommendations, setRecommendations] = useState<Recommendation[]>([])
    const [profile, setProfile] = useState<any>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [addingKey, setAddingKey] = useState<string | null>(null)
    const { toast } = useToast()

    const fetchRecommendations = async () => {
        setIsLoading(true)
        try {
            const response = await fetch('/api/books/recommendations')
            if (response.ok) {
                const data = await response.json()
                setRecommendations(data.recommendations)
                setProfile(data.profile)
            }
        } catch (error) {
            console.error('Failed to fetch recommendations:', error)
            toast({
                title: 'Error',
                description: 'Could not load recommendations.',
                variant: 'destructive',
            })
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        fetchRecommendations()
    }, [])

    const handleAdd = async (rec: Recommendation) => {
        setAddingKey(rec.key)
        try {
            await onAddBook({
                title: rec.title,
                author: rec.author,
                coverUrl: rec.coverUrl,
                totalPages: rec.totalPages,
                isbn: rec.isbn,
                genre: rec.genre,
                status: 'to-read',
            })
            // Remove from recommendations after adding
            setRecommendations(prev => prev.filter(r => r.key !== rec.key))
        } finally {
            setAddingKey(null)
        }
    }

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-muted-foreground">Analyzing your reading taste...</p>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Profile Summary */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-violet-500/20">
                        <Sparkles className="h-5 w-5 text-violet-400" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-lg">Recommended for You</h3>
                        <p className="text-sm text-muted-foreground">
                            {profile?.totalBooks > 0
                                ? `Based on ${profile.totalBooks} books in your library`
                                : 'Popular picks to get started'}
                        </p>
                    </div>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchRecommendations}
                    className="rounded-xl border-border/50"
                >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                </Button>
            </div>

            {/* Interest Tags */}
            {profile?.topGenres?.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    <TrendingUp className="h-4 w-4 text-muted-foreground mt-0.5" />
                    {profile.topGenres.map((genre: string) => (
                        <Badge
                            key={genre}
                            variant="secondary"
                            className="rounded-lg bg-primary/10 text-primary border-primary/20 capitalize"
                        >
                            {genre}
                        </Badge>
                    ))}
                </div>
            )}

            {/* Recommendations Grid */}
            {recommendations.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {recommendations.map((rec) => (
                        <Card
                            key={rec.key}
                            className="group flex flex-col bg-card/50 backdrop-blur-md border-border/50 rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 hover:bg-card/80"
                        >
                            <CardContent className="p-3 flex-1">
                                <div className="aspect-[2/3] relative bg-muted/50 rounded-lg overflow-hidden mb-3 shadow-inner">
                                    {rec.coverUrl ? (
                                        <img
                                            src={rec.coverUrl}
                                            alt={rec.title}
                                            className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500"
                                        />
                                    ) : (
                                        <div className="flex items-center justify-center h-full text-muted-foreground">
                                            <BookOpen className="h-10 w-10 opacity-50" />
                                        </div>
                                    )}
                                    {rec.genre && (
                                        <div className="absolute top-2 left-2">
                                            <Badge
                                                variant="secondary"
                                                className="backdrop-blur-md bg-black/60 text-white border-0 text-[10px] capitalize"
                                            >
                                                {rec.genre}
                                            </Badge>
                                        </div>
                                    )}
                                </div>

                                <h4 className="font-semibold text-sm line-clamp-2 mb-1" title={rec.title}>
                                    {rec.title}
                                </h4>
                                <p className="text-xs text-muted-foreground line-clamp-1 mb-1">
                                    {rec.author}
                                </p>
                                <p className="text-[10px] text-muted-foreground/70 line-clamp-1 italic">
                                    {rec.reason}
                                </p>
                                {rec.totalPages > 0 && (
                                    <p className="text-[10px] text-muted-foreground mt-1">
                                        {rec.totalPages} pages {rec.year ? `• ${rec.year}` : ''}
                                    </p>
                                )}
                            </CardContent>
                            <CardFooter className="p-3 pt-0">
                                <Button
                                    className="w-full rounded-lg text-xs h-8"
                                    onClick={() => handleAdd(rec)}
                                    disabled={addingKey === rec.key}
                                    variant="secondary"
                                    size="sm"
                                >
                                    {addingKey === rec.key ? (
                                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                    ) : (
                                        <Plus className="h-3 w-3 mr-1" />
                                    )}
                                    Add to Library
                                </Button>
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            ) : (
                <div className="text-center py-12 text-muted-foreground">
                    <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="font-medium">No recommendations yet</p>
                    <p className="text-sm mt-1">Add some books to your library and we'll suggest more!</p>
                </div>
            )}
        </div>
    )
}
