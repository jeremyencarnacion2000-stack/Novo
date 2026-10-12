import { createBookIdentityKey } from './book-identity'

describe('createBookIdentityKey', () => {
  it('normalizes formatting differences in ISBNs into one identity', () => {
    expect(createBookIdentityKey({
      title: 'Deep Work',
      author: 'Cal Newport',
      isbn: '978-1-4555-8669-1',
    })).toBe('isbn:9781455586691')
  })

  it('uses the provider identity when no ISBN is available', () => {
    expect(createBookIdentityKey({
      title: 'Deep Work',
      author: 'Cal Newport',
      externalId: '/works/OL17079854W',
    })).toBe('openlibrary:/works/ol17079854w')
  })

  it('falls back to a normalized title and author for manual entries', () => {
    expect(createBookIdentityKey({
      title: '  Cien años de soledad ',
      author: 'GABRIEL García Márquez',
    })).toBe('text:cien anos de soledad|gabriel garcia marquez')
  })
})
