import { pathToFileURL } from 'node:url'
import { config } from 'dotenv'

const disposableMarker = /(?:^|[^a-z0-9])(test|e2e|disposable)(?:$|[^a-z0-9])/i

function parsePostgresIdentity(value, variableName) {
  let url
  try {
    url = new URL(value)
  } catch {
    throw new Error(`SAFE_GATE: ${variableName} must be a valid PostgreSQL URL`)
  }

  if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
    throw new Error(`SAFE_GATE: ${variableName} must be a valid PostgreSQL URL`)
  }

  let pathname
  try {
    pathname = decodeURIComponent(url.pathname).replace(/\/+$/, '')
  } catch {
    throw new Error(`SAFE_GATE: ${variableName} must be a valid PostgreSQL URL`)
  }
  const testDatabase = pathname.replace(/^\/+/, '')
  if (!url.hostname || !testDatabase || testDatabase.includes('/')) {
    throw new Error(`SAFE_GATE: ${variableName} must be a valid PostgreSQL URL`)
  }

  const port = url.port || '5432'
  return {
    testDatabase,
    normalizedTarget: `postgresql://${url.hostname.toLowerCase()}:${port}/${testDatabase}`,
  }
}

export function assertIsolatedE2EEnvironment(env) {
  const testUrl = env.DATABASE_URL_TEST?.trim()
  if (!testUrl) throw new Error('SAFE_GATE: DATABASE_URL_TEST is required')
  if (env.NOVO_ISOLATED_E2E !== 'true') {
    throw new Error('SAFE_GATE: NOVO_ISOLATED_E2E=true is required')
  }

  const test = parsePostgresIdentity(testUrl, 'DATABASE_URL_TEST')
  const testIdentityMarker = env.NOVO_TEST_DB_IDENTITY?.trim() ?? ''
  const testBranchMarker = env.DATABASE_TEST_BRANCH?.trim() ?? ''
  const productionUrl = env.DATABASE_URL?.trim()
  if (!productionUrl) {
    throw new Error('SAFE_GATE: DATABASE_URL is required to certify production isolation')
  }
  const production = parsePostgresIdentity(productionUrl, 'DATABASE_URL')
  if (test.normalizedTarget === production.normalizedTarget) {
    throw new Error('SAFE_GATE: DATABASE_URL_TEST overlaps DATABASE_URL')
  }

  if (!disposableMarker.test(test.testDatabase) && !disposableMarker.test(testBranchMarker) && !disposableMarker.test(testIdentityMarker)) {
    throw new Error('SAFE_GATE: test database name must include a test, e2e, or disposable marker')
  }
  if (!disposableMarker.test(testIdentityMarker) && !disposableMarker.test(testBranchMarker)) {
    throw new Error('SAFE_GATE: NOVO_TEST_DB_IDENTITY must include a test, e2e, or disposable marker')
  }

  return { testDatabase: test.testDatabase, productionOverlap: false }
}

async function probePostgresCredential(connectionString) {
  const pgModule = await import('pg')
  const Client = pgModule.Client ?? pgModule.default?.Client
  const client = new Client({
    connectionString,
    connectionTimeoutMillis: 5_000,
    query_timeout: 5_000,
    statement_timeout: 5_000,
    application_name: 'novo-isolated-e2e-validation',
  })
  try {
    await client.connect()
    await client.query('SELECT 1 AS authenticated')
  } finally {
    await client.end().catch(() => undefined)
  }
}

export async function validateIsolatedE2EEnvironment(env, probeCredential = probePostgresCredential) {
  const certificate = assertIsolatedE2EEnvironment(env)
  try {
    await probeCredential(env.DATABASE_URL_TEST.trim())
  } catch {
    throw new Error('SAFE_GATE: DATABASE_URL_TEST authentication probe failed')
  }
  return certificate
}

function isDirectInvocation() {
  return Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href
}

async function main() {
  config({ quiet: true })
  config({ path: '.env.test.local', override: false, quiet: true })
  const certificate = await validateIsolatedE2EEnvironment(process.env)
  console.log(`SAFE_GATE: accepted database=${certificate.testDatabase} productionOverlap=${certificate.productionOverlap}`)
}

if (isDirectInvocation()) {
  main().catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
}
