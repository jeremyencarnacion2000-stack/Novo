import { spawnSync } from 'node:child_process'
import { config } from 'dotenv'
import { assertIsolatedE2EEnvironment } from './validate-isolated-e2e-environment.mjs'

config({ quiet: true })
config({ path: '.env.local', override: false, quiet: true })
config({ path: '.env.test.local', override: false, quiet: true })

const [, , command, ...args] = process.argv
if (!command) throw new Error('Usage: run-isolated-db-command <command> [...args]')
assertIsolatedE2EEnvironment(process.env)

const result = spawnSync(command, args, {
  // Make the test URL the actual DATABASE_URL seen by Prisma/Next process
  // children. The explicit assignment prevents Prisma schema env() loading
  // from silently selecting the production .env value.
  env: { ...process.env, DATABASE_URL_PRODUCTION: process.env.DATABASE_URL, DATABASE_URL: process.env.DATABASE_URL_TEST, NODE_ENV: 'test', NOVO_ISOLATED_E2E: 'true' },
  stdio: 'inherit',
  shell: process.platform === 'win32',
})

if (result.error) throw result.error
process.exit(result.status ?? 1)
