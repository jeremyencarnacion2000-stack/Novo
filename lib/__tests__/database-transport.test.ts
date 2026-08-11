import { getDatabaseTransport } from '../database-transport'

describe('getDatabaseTransport', () => {
  it.each([
    'postgresql://audit:secret@127.0.0.1:55432/novo_audit',
    'postgresql://audit:secret@localhost:55432/novo_audit',
    'postgresql://audit:secret@[::1]:55432/novo_audit',
  ])('uses TCP pg for loopback PostgreSQL: %s', (databaseUrl) => {
    expect(getDatabaseTransport(databaseUrl)).toBe('pg')
  })

  it.each([
    'postgresql://audit:secret@ep-audit-branch.us-east-2.aws.neon.tech/novo?sslmode=require',
    'postgresql://audit:secret@db.internal.example/novo',
  ])('keeps the Neon adapter for non-loopback hosts: %s', (databaseUrl) => {
    expect(getDatabaseTransport(databaseUrl)).toBe('neon')
  })

  it('fails closed for an invalid database URL', () => {
    expect(() => getDatabaseTransport('not-a-database-url')).toThrow('Invalid DATABASE_URL')
  })
})
