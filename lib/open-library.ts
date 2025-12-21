export interface OpenLibraryBook {
    key: string
    title: string
    author_name?: string[]
    cover_i?: number
    first_publish_year?: number
    isbn?: string[]
    number_of_pages_median?: number
}

export async function searchBooks(query: string): Promise<OpenLibraryBook[]> {
    if (!query) return []

    try {
        const response = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=20`)
        const data = await response.json()
        return data.docs || []
    } catch (error) {
        console.error('Open Library search error:', error)
        return []
    }
}

export function getCoverUrl(coverId?: number, size: 'S' | 'M' | 'L' = 'M'): string | null {
    if (!coverId) return null
    return `https://covers.openlibrary.org/b/id/${coverId}-${size}.jpg`
}
