export const BOOK_STATUSES = ['to-read', 'reading', 'read', 'dropped'] as const

export type BookStatus = (typeof BOOK_STATUSES)[number]

/**
 * Book status was stored as a free-form string before the library UI settled
 * on its current vocabulary. Keep the old values readable, but only emit one
 * canonical value to new writes so cards, filters and the API agree.
 */
export function normalizeBookStatus(status?: string | null): BookStatus {
  switch (status) {
    case 'reading':
      return 'reading'
    case 'read':
    case 'completed':
      return 'read'
    case 'dropped':
      return 'dropped'
    case 'to-read':
    case 'want-to-read':
    default:
      return 'to-read'
  }
}
