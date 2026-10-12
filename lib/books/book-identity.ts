export interface BookIdentityInput {
  title: string
  author?: string | null
  isbn?: string | null
  externalId?: string | null
}

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

export function createBookIdentityKey(input: BookIdentityInput) {
  const isbn = input.isbn?.replace(/[^0-9x]/gi, '').toLowerCase()
  if (isbn && (isbn.length === 10 || isbn.length === 13)) {
    return `isbn:${isbn}`
  }

  const externalId = input.externalId?.trim().toLowerCase()
  if (externalId) {
    return `openlibrary:${externalId}`
  }

  return `text:${normalizeText(input.title)}|${normalizeText(input.author || '')}`
}
