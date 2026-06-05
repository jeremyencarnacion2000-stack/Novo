import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { searchBySubject, searchByAuthor, getCoverUrl, getPrimaryGenre } from '@/lib/open-library'

export async function GET() {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // 1. Get user's books to build taste profile
        const userBooks = await prisma.book.findMany({
            where: { userId: session.user.id },
            select: {
                title: true,
                author: true,
                genre: true,
                categories: true,
                rating: true,
                status: true,
            }
        })

        const existingTitles = new Set(userBooks.map(b => b.title.toLowerCase()))

        // 2. Extract taste profile
        const genreCounts: Record<string, number> = {}
        const authorCounts: Record<string, number> = {}

        for (const book of userBooks) {
            // Weight by rating (highly rated = stronger signal)
            const weight = book.rating && book.rating >= 4 ? 2 : 1

            if (book.genre) {
                genreCounts[book.genre] = (genreCounts[book.genre] || 0) + weight
            }
            if (book.categories) {
                book.categories.split(',').forEach(cat => {
                    const c = cat.trim()
                    if (c) genreCounts[c] = (genreCounts[c] || 0) + weight
                })
            }
            if (book.author) {
                authorCounts[book.author] = (authorCounts[book.author] || 0) + weight
            }
        }

        // 3. Sort by frequency to get top preferences
        const topGenres = Object.entries(genreCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([g]) => g)

        const topAuthors = Object.entries(authorCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 2)
            .map(([a]) => a)

        // 4. Search Open Library for recommendations
        const recommendations: any[] = []

        // If no taste profile, return popular subjects
        const searchGenres = topGenres.length > 0
            ? topGenres
            : ['self-help', 'business', 'psychology']

        // Search by genres
        const genrePromises = searchGenres.map(g => searchBySubject(g, 8))
        const genreResults = await Promise.all(genrePromises)

        for (let i = 0; i < genreResults.length; i++) {
            for (const book of genreResults[i]) {
                if (!existingTitles.has(book.title.toLowerCase()) && book.cover_i) {
                    recommendations.push({
                        key: book.key,
                        title: book.title,
                        author: book.author_name?.[0] || 'Unknown Author',
                        coverUrl: getCoverUrl(book.cover_i, 'M'),
                        totalPages: book.number_of_pages_median || 0,
                        isbn: book.isbn?.[0],
                        genre: getPrimaryGenre(book.subject) || searchGenres[i],
                        year: book.first_publish_year,
                        reason: `Based on your interest in ${searchGenres[i]}`,
                    })
                }
            }
        }

        // Search by favorite authors
        for (const author of topAuthors) {
            const authorBooks = await searchByAuthor(author, 6)
            for (const book of authorBooks) {
                if (!existingTitles.has(book.title.toLowerCase()) && book.cover_i) {
                    recommendations.push({
                        key: book.key,
                        title: book.title,
                        author: book.author_name?.[0] || author,
                        coverUrl: getCoverUrl(book.cover_i, 'M'),
                        totalPages: book.number_of_pages_median || 0,
                        isbn: book.isbn?.[0],
                        genre: getPrimaryGenre(book.subject),
                        year: book.first_publish_year,
                        reason: `More from ${author}`,
                    })
                }
            }
        }

        // 5. Deduplicate by title and return top 12
        const seen = new Set<string>()
        const unique = recommendations.filter(r => {
            const key = r.title.toLowerCase()
            if (seen.has(key)) return false
            seen.add(key)
            return true
        }).slice(0, 12)

        return NextResponse.json({
            recommendations: unique,
            profile: {
                topGenres: searchGenres,
                topAuthors,
                totalBooks: userBooks.length,
            }
        })
    } catch (error) {
        console.error('Error generating recommendations:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
