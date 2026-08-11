import { getEffectiveDatabaseUrl } from '../database-url'

describe('getEffectiveDatabaseUrl', () => {
  it('uses the test URL only for an explicit isolated run', () => {
    expect(getEffectiveDatabaseUrl({
      NODE_ENV: 'test',
      NOVO_ISOLATED_E2E: 'true',
      DATABASE_URL: 'postgresql://prod/db',
      DATABASE_URL_TEST: 'postgresql://test/db',
    })).toBe('postgresql://test/db')
  })

  it('requires NODE_ENV=test before resolving the isolated database', () => {
    expect(() => getEffectiveDatabaseUrl({
      NODE_ENV: 'development',
      NOVO_ISOLATED_E2E: 'true',
      DATABASE_URL: 'postgresql://prod/db',
      DATABASE_URL_TEST: 'postgresql://test/db',
    })).toThrow('NODE_ENV=test')
  })

  it('fails closed when the isolated test URL is missing or overlaps production', () => {
    expect(() => getEffectiveDatabaseUrl({ NODE_ENV: 'test', NOVO_ISOLATED_E2E: 'true' })).toThrow('DATABASE_URL_TEST')
    expect(() => getEffectiveDatabaseUrl({
      NODE_ENV: 'test',
      NOVO_ISOLATED_E2E: 'true',
      DATABASE_URL: 'postgresql://same/db',
      DATABASE_URL_TEST: 'postgresql://same/db',
    })).toThrow('must not equal')
  })

  it('rejects isolated URLs that target the production host, port, and database despite query differences', () => {
    expect(() => getEffectiveDatabaseUrl({
      NODE_ENV: 'test',
      NOVO_ISOLATED_E2E: 'true',
      DATABASE_URL: 'postgresql://app_user@db.example.test:5432/novo?sslmode=require',
      DATABASE_URL_TEST: 'postgresql://app_user@db.example.test:5432/novo?schema=test',
    })).toThrow('must not target the same database')
  })

  it('rejects isolated URLs when PostgreSQL uses an implicit versus explicit default port', () => {
    expect(() => getEffectiveDatabaseUrl({
      NODE_ENV: 'test',
      NOVO_ISOLATED_E2E: 'true',
      DATABASE_URL: 'postgresql://app_user@db.example.test/novo',
      DATABASE_URL_TEST: 'postgresql://app_user@db.example.test:5432/novo?schema=test',
    })).toThrow('must not target the same database')
  })

  it('keeps normal unit/development resolution on DATABASE_URL', () => {
    expect(getEffectiveDatabaseUrl({ NODE_ENV: 'development', DATABASE_URL: 'postgresql://prod/db', DATABASE_URL_TEST: 'postgresql://test/db' }))
      .toBe('postgresql://prod/db')
  })

  it('keeps development resolution on DATABASE_URL when an isolated production comparator exists', () => {
    expect(getEffectiveDatabaseUrl({
      NODE_ENV: 'development',
      DATABASE_URL: 'postgresql://development/db',
      DATABASE_URL_PRODUCTION: 'postgresql://production/db',
      DATABASE_URL_TEST: 'postgresql://test/db',
    })).toBe('postgresql://development/db')
  })

  it('requires the isolated opt-in before resolving the test database', () => {
    expect(getEffectiveDatabaseUrl({
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://prod/db',
      DATABASE_URL_TEST: 'postgresql://test/db',
    })).toBe('postgresql://prod/db')
  })
})
