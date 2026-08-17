import { createHash } from 'node:crypto'
import { config } from 'dotenv'

config()
config({ path: '.env.test.local', override: false })

function identity(raw) {
  const url = new URL(raw)
  return {
    host: url.hostname,
    port: url.port || '5432',
    database: decodeURIComponent(url.pathname.replace(/^\//, '')),
    fingerprint: createHash('sha256').update(raw).digest('hex').slice(0, 12),
  }
}

const testRaw = process.env.DATABASE_URL_TEST
const prodRaw = process.env.DATABASE_URL
const branchEvidence = process.env.DATABASE_TEST_BRANCH ?? ''
if (!testRaw) throw new Error('SAFE_GATE: DATABASE_URL_TEST missing')
if (!prodRaw) throw new Error('SAFE_GATE: DATABASE_URL missing')

const test = identity(testRaw)
const production = identity(prodRaw)
const sameFingerprint = test.fingerprint === production.fingerprint
const branchIsIsolated = /(novo-e2e-test|test|e2e)/i.test(branchEvidence)
const overlap = sameFingerprint || (!branchIsIsolated && test.host === production.host && test.database === production.database)
if (overlap) throw new Error('SAFE_GATE: test identity overlaps production')
if (!branchIsIsolated && !/(novo-e2e-test|test|e2e)/i.test(test.database)) throw new Error('SAFE_GATE: test identity lacks required branch/database marker')

console.log(`SAFE_GATE: accepted branch=${branchEvidence || 'database-marker'} host=${test.host} port=${test.port} database=${test.database} fingerprint=${test.fingerprint} productionOverlap=false`)
