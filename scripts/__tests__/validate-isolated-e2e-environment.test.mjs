import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { assertIsolatedE2EEnvironment } from '../validate-isolated-e2e-environment.mjs'

const validatorPath = fileURLToPath(new URL('../validate-isolated-e2e-environment.mjs', import.meta.url))
const runnerPath = fileURLToPath(new URL('../run-isolated-db-command.mjs', import.meta.url))
const repositoryPath = fileURLToPath(new URL('../..', import.meta.url))

test('requires DATABASE_URL_TEST before isolated E2E work', () => {
  assert.throws(
    () => assertIsolatedE2EEnvironment({ DATABASE_URL_TEST: '', NOVO_ISOLATED_E2E: 'true' }),
    /DATABASE_URL_TEST is required/,
  )
})

test('rejects a test database that overlaps DATABASE_URL', () => {
  assert.throws(
    () => assertIsolatedE2EEnvironment({
      DATABASE_URL_TEST: 'postgresql://x/novo_prod',
      DATABASE_URL: 'postgresql://x/novo_prod',
      NOVO_ISOLATED_E2E: 'true',
      NOVO_TEST_DB_IDENTITY: 'novo-test',
    }),
    /overlaps DATABASE_URL/,
  )
})

test('requires the literal isolated E2E opt-in', () => {
  assert.throws(
    () => assertIsolatedE2EEnvironment({
      DATABASE_URL_TEST: 'postgresql://x/novo_test_branch',
      DATABASE_URL: 'postgresql://x/novo_prod',
      NOVO_ISOLATED_E2E: 'false',
      NOVO_TEST_DB_IDENTITY: 'novo-test',
    }),
    /NOVO_ISOLATED_E2E=true is required/,
  )
})

test('returns the accepted test database with a negative production-overlap certificate', () => {
  assert.equal(assertIsolatedE2EEnvironment({
    DATABASE_URL_TEST: 'postgresql://x/novo_test_branch',
    DATABASE_URL: 'postgresql://x/novo_prod',
    NOVO_ISOLATED_E2E: 'true',
    NOVO_TEST_DB_IDENTITY: 'novo-test',
  }).productionOverlap, false)
})

test('requires a disposable marker in both the database name and declared identity', () => {
  assert.throws(
    () => assertIsolatedE2EEnvironment({
      DATABASE_URL_TEST: 'postgresql://x/novo_branch',
      DATABASE_URL: 'postgresql://x/novo_prod',
      NOVO_ISOLATED_E2E: 'true',
      NOVO_TEST_DB_IDENTITY: 'novo-test',
    }),
    /test database name must include a test, e2e, or disposable marker/,
  )
  assert.throws(
    () => assertIsolatedE2EEnvironment({
      DATABASE_URL_TEST: 'postgresql://x/novo_test_branch',
      DATABASE_URL: 'postgresql://x/novo_prod',
      NOVO_ISOLATED_E2E: 'true',
      NOVO_TEST_DB_IDENTITY: 'novo-branch',
    }),
    /NOVO_TEST_DB_IDENTITY must include a test, e2e, or disposable marker/,
  )
})

test('detects normalized database overlap despite credentials, case, port, and query differences', () => {
  const secretTestUrl = 'postgresql://test-user:test-secret@DB.EXAMPLE.TEST/novo_test_branch?sslmode=require'
  assert.throws(
    () => assertIsolatedE2EEnvironment({
      DATABASE_URL_TEST: secretTestUrl,
      DATABASE_URL: 'postgres://prod-user:prod-secret@db.example.test:5432/novo_test_branch?schema=public',
      NOVO_ISOLATED_E2E: 'true',
      NOVO_TEST_DB_IDENTITY: 'novo-test',
    }),
    (error) => {
      assert.match(error.message, /overlaps DATABASE_URL/)
      assert.equal(error.message.includes(secretTestUrl), false)
      assert.equal(error.message.includes('test-secret'), false)
      return true
    },
  )
})

test('rejects malformed or non-PostgreSQL test URLs without echoing them', () => {
  assert.throws(
    () => assertIsolatedE2EEnvironment({
      DATABASE_URL_TEST: 'not-a-url-with-secret',
      DATABASE_URL: 'postgresql://x/novo_prod',
      NOVO_ISOLATED_E2E: 'true',
      NOVO_TEST_DB_IDENTITY: 'novo-test',
    }),
    (error) => {
      assert.match(error.message, /DATABASE_URL_TEST must be a valid PostgreSQL URL/)
      assert.equal(error.message.includes('not-a-url-with-secret'), false)
      return true
    },
  )
})

test('isolated runner accepts only the shared guard interface and maps the test URL to its child', () => {
  const result = spawnSync(process.execPath, [runnerPath, 'node', '-p', 'process.env.DATABASE_URL===process.env.DATABASE_URL_TEST'], {
    cwd: repositoryPath,
    env: {
      ...process.env,
      DATABASE_URL_TEST: 'postgresql://test-user:test-pass@test.local:5432/novo_test_branch',
      DATABASE_URL: 'postgresql://prod-user:prod-pass@prod.local:5432/novo_prod',
      NOVO_ISOLATED_E2E: 'true',
      NOVO_TEST_DB_IDENTITY: 'novo-test',
      DATABASE_TEST_BRANCH: '',
    },
    encoding: 'utf8',
  })

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
  assert.equal(result.stdout.trim(), 'true')
})

test('isolated runner stops before spawning when the shared guard rejects the identity', () => {
  const result = spawnSync(process.execPath, [runnerPath, 'node', '-e', 'process.exit(42)'], {
    cwd: repositoryPath,
    env: {
      ...process.env,
      DATABASE_URL_TEST: 'postgresql://test-user:test-pass@test.local:5432/novo_test_branch',
      DATABASE_URL: 'postgresql://prod-user:prod-pass@prod.local:5432/novo_prod',
      NOVO_ISOLATED_E2E: 'true',
      NOVO_TEST_DB_IDENTITY: 'novo-production',
      DATABASE_TEST_BRANCH: 'novo-e2e-test',
    },
    encoding: 'utf8',
  })

  assert.equal(result.status, 1)
  assert.match(result.stderr, /NOVO_TEST_DB_IDENTITY must include a test, e2e, or disposable marker/)
})

test('credential certificate is withheld when the isolated database cannot authenticate', () => {
  const result = spawnSync(process.execPath, [validatorPath], {
    cwd: repositoryPath,
    env: {
      ...process.env,
      DATABASE_URL_TEST: 'postgresql://test-user:test-secret@127.0.0.1:1/novo_test_branch',
      DATABASE_URL: 'postgresql://prod-user:prod-secret@prod.invalid:5432/novo_prod',
      NOVO_ISOLATED_E2E: 'true',
      NOVO_TEST_DB_IDENTITY: 'novo-test',
    },
    encoding: 'utf8',
    timeout: 10_000,
  })

  assert.equal(result.status, 1)
  assert.doesNotMatch(result.stdout, /SAFE_GATE: accepted/)
  assert.match(result.stderr, /DATABASE_URL_TEST authentication probe failed/)
  assert.equal(result.stderr.includes('test-secret'), false)
  assert.equal(result.stderr.includes('127.0.0.1'), false)
})
