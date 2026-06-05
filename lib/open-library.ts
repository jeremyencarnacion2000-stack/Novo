export interface OpenLibraryBook {
    key: string
    title: string
    author_name?: string[]
    cover_i?: number
    first_publish_year?: number
    isbn?: string[]
    number_of_pages_median?: number
    subject?: string[]
}

export async function searchBooks(query: string): Promise<OpenLibraryBook[]> {
    if (!query) return []

    try {
        const response = await fetch(
            `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=20&fields=key,title,author_name,cover_i,first_publish_year,isbn,number_of_pages_median,subject`
        )
        const data = await response.json()
        return data.docs || []
    } catch (error) {
        console.error('Open Library search error:', error)
        return []
    }
}

export async function searchBySubject(subject: string, limit = 12): Promise<OpenLibraryBook[]> {
    if (!subject) return []

    try {
        const response = await fetch(
            `https://openlibrary.org/search.json?subject=${encodeURIComponent(subject)}&limit=${limit}&fields=key,title,author_name,cover_i,first_publish_year,isbn,number_of_pages_median,subject&sort=rating`
        )
        const data = await response.json()
        return data.docs || []
    } catch (error) {
        console.error('Open Library subject search error:', error)
        return []
    }
}

export async function searchByAuthor(author: string, limit = 8): Promise<OpenLibraryBook[]> {
    if (!author) return []

    try {
        const response = await fetch(
            `https://openlibrary.org/search.json?author=${encodeURIComponent(author)}&limit=${limit}&fields=key,title,author_name,cover_i,first_publish_year,isbn,number_of_pages_median,subject&sort=rating`
        )
        const data = await response.json()
        return data.docs || []
    } catch (error) {
        console.error('Open Library author search error:', error)
        return []
    }
}

export function getCoverUrl(coverId?: number, size: 'S' | 'M' | 'L' = 'M'): string | null {
    if (!coverId) return null
    return `https://covers.openlibrary.org/b/id/${coverId}-${size}.jpg`
}

export function getPrimaryGenre(subjects?: string[]): string | null {
    if (!subjects || subjects.length === 0) return null
    // Filter out overly generic subjects
    const skip = ['accessible book', 'protected daisy', 'in library', 'lending library', 'large type books', 'fiction', 'nonfiction']
    const filtered = subjects.filter(s => !skip.includes(s.toLowerCase()))
    return filtered[0] || subjects[0] || null
}
