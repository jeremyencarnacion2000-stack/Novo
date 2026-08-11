/**
 * Resolves the database connection used by an isolated Novo E2E run.
 *
 * Unit tests and normal development keep using DATABASE_URL. The explicit
 * NODE_ENV=test plus the explicit NOVO_ISOLATED_E2E flag are required before
 * DATABASE_URL_TEST can become the effective DATABASE_URL, preventing an
 * accidental production reset.
 */
export function getEffectiveDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const isolated = env.NOVO_ISOLATED_E2E === 'true'
  const testUrl = env.DATABASE_URL_TEST?.trim()
  const databaseUrl = env.DATABASE_URL?.trim()
  const productionUrl = (env.DATABASE_URL_PRODUCTION ?? databaseUrl)?.trim()

  if (isolated) {
    if (env.NODE_ENV !== 'test') {
      throw new Error('NODE_ENV=test is required for isolated E2E operations.')
    }
    if (!testUrl) {
      throw new Error('DATABASE_URL_TEST is required for isolated E2E operations.')
    }
    if (productionUrl && testUrl === productionUrl) {
      throw new Error('DATABASE_URL_TEST must not equal DATABASE_URL.')
    }
    if (productionUrl && targetsSameDatabase(testUrl, productionUrl)) {
      throw new Error('DATABASE_URL_TEST must not target the same database as DATABASE_URL.')
    }
    return testUrl
  }

  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is missing.')
  }
  return databaseUrl
}

function targetsSameDatabase(firstUrl: string, secondUrl: string): boolean {
  try {
    const first = new URL(firstUrl)
    const second = new URL(secondUrl)

    return first.hostname === second.hostname
      && normalizedDatabasePort(first) === normalizedDatabasePort(second)
      && first.pathname === second.pathname
  } catch {
    return false
  }
}

function normalizedDatabasePort(url: URL): string {
  if (url.port) return url.port
  if (url.protocol === 'postgres:' || url.protocol === 'postgresql:') return '5432'
  return ''
}
