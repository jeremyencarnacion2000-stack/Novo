import type { BookStatus } from '@/lib/books/status'

export interface Book {
    id: string
    title: string
    author?: string | null
    coverUrl?: string
    status: BookStatus
    progress: number
    totalPage?: number
    rating?: number
    review?: string
    createdAt: Date
    updatedAt: Date
    userId: string
}
