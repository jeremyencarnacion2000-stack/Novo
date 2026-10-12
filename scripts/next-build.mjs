import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const args = process.argv.slice(2)
const capacitor = args[0] === '--capacitor'
if (capacitor) args.shift()

const nextBin = fileURLToPath(new URL('../node_modules/next/dist/bin/next', import.meta.url))
const existingNodeOptions = process.env.NODE_OPTIONS?.trim()
const nodeOptions = [existingNodeOptions, '--max-old-space-size=4096']
  .filter(Boolean)
  .join(' ')

const child = spawn(process.execPath, [nextBin, ...args], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    // `--capacitor` is a compatibility label for the native verification
    // command. The native shell loads the deployed `/app` surface via
    // capacitor.config.ts, so this command must stay server-backed instead
    // of turning on Next's incompatible static export.
    // Next's type-check worker reads NODE_OPTIONS, not the parent process'
    // --max-old-space-size execArgv. Propagating it avoids a Windows-only OOM
    // while preserving strict type checking.
    NODE_OPTIONS: nodeOptions,
  },
  stdio: 'inherit',
})

child.on('error', (error) => {
  console.error('Unable to start Next build:', error)
  process.exitCode = 1
})

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }
  process.exitCode = code ?? 1
})
