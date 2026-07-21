import { evaluateReadingSignal, ReadingBookSample } from '../books-signal'

const daysAgo = (n: number, from: Date) => new Date(from.getTime() - n * 24 * 60 * 60 * 1000)

describe('evaluateReadingSignal', () => {
  const now = new Date('2026-07-20T12:00:00Z')

  it('returns no signal when nothing is currently being read', () => {
    expect(evaluateReadingSignal([], now)).toEqual([])
  })

  it('returns no signal when progress was made recently', () => {
    const books: ReadingBookSample[] = [{ title: 'Deep Work', updatedAt: daysAgo(1, now) }]
    expect(evaluateReadingSignal(books, now)).toEqual([])
  })

  it('flags a stalled book after the threshold', () => {
    const books: ReadingBookSample[] = [{ title: 'Deep Work', updatedAt: daysAgo(9, now) }]
    const signals = evaluateReadingSignal(books, now)
    expect(signals).toHaveLength(1)
    expect(signals[0].type).toBe('books_reading_stalled')
    expect(signals[0].headline).toContain('Deep Work')
    expect(signals[0].headline).toContain('9')
  })

  it('only considers the most recently-touched book when several are "reading"', () => {
    const books: ReadingBookSample[] = [
      { title: 'Stalled Book', updatedAt: daysAgo(20, now) },
      { title: 'Active Book', updatedAt: daysAgo(1, now) },
    ]
    expect(evaluateReadingSignal(books, now)).toEqual([])
  })
})
