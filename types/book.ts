export interface Book {
    id: string
    title: string
    author: string
    coverUrl?: string
    status: 'reading' | 'completed' | 'want-to-read'
    progress: number
    totalPage?: number
    rating?: number
    review?: string
    createdAt: Date
    updatedAt: Date
    userId: string
}
