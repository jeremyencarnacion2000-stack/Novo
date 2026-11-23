import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { once } from 'node:events'
import { fileURLToPath } from 'node:url'
import { setTimeout } from 'node:timers/promises'
import { openJarvisConfig, projectContinuationPrompt, requestOpenJarvis } from '../../lib/ai/openjarvis.ts'

// Requires the isolated Python environment and the pinned checkout.
const python = process.env.NOVO_OPENJARVIS_PYTHON
const root = process.env.NOVO_OPENJARVIS_CHECKOUT
assert.ok(python && root, 'Set the isolated Python and checkout paths')
const port = process.env.NOVO_OPENJARVIS_PORT || '18764'
const token = randomBytes(32).toString('hex')
process.env.NOVO_OPENJARVIS_TOKEN = token
process.env.NOVO_OPENJARVIS_URL = `http://127.0.0.1:${port}`
const config = openJarvisConfig()
assert.ok(config, 'Set NOVO_OPENJARVIS_MODEL')
const env = Object.fromEntries(
  ['PATH', 'SystemRoot', 'WINDIR', 'TEMP', 'TMP', 'USERPROFILE', 'HOME'].flatMap(
    key => process.env[key] ? [[key, process.env[key]]] : [],
  ),
)
const worker = spawn(python, ['-I', '-B', fileURLToPath(new URL('./runtime.py', import.meta.url))], {
  env: {
    ...env,
    NOVO_OPENJARVIS_CHECKOUT: root,
    NOVO_OPENJARVIS_PORT: port,
    NOVO_OPENJARVIS_TOKEN: token,
    NOVO_OPENJARVIS_MODEL: config.model,
    NOVO_OPENJARVIS_ENGINE: process.env.NOVO_OPENJARVIS_ENGINE,
    GROQ_API_KEY: process.env.GROQ_API_KEY,
  },
  stdio: ['ignore', 'ignore', 'inherit'],
  windowsHide: true,
})

try {
  let started = false
  for (let attempt = 0; attempt < 40 && worker.exitCode === null; attempt++) {
    const response = await fetch(config.url, { method: 'POST' }).catch(() => null)
    if (response?.status === 401) {
      started = true
      break
    }
    await setTimeout(250)
  }
  assert.ok(started, 'The runtime denies unauthenticated requests')
  const rejected = await fetch(config.url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.token}` },
    body: JSON.stringify({ system: 'test', message: 'test', evidence: '{}', model: 'unapproved' }),
  })
  assert.equal(rejected.status, 400)
  const confirmed = { source: 'novo', records: [{ title: 'Revisar checkout', status: 'todo' }] }
  for (const openTasks of [confirmed, null]) {
    const evidence = JSON.stringify({
      identities: [{ source: 'folder', name: 'Proyecto de prueba' }],
      openTasks,
      unavailable: ['Vercel: no se pudo consultar ahora'],
    })
    const response = await requestOpenJarvis(config, projectContinuationPrompt, 'Continuemos con el proyecto de prueba.', evidence, AbortSignal.timeout(15_000))
    assert.ok(response, 'The upstream agent returned a valid result')
    const stream = await response.text()
    assert.match(stream, /vercel/i)
    assert.match(stream, /\[DONE\]/)
    assert.match(stream, /\?/)
    if (openTasks) {
      assert.match(stream, /Revisar checkout/i)
      assert.match(stream, /novo/i)
    } else {
      assert.match(stream, /confirm|registrad|tarea/i)
      assert.doesNotMatch(stream, /checkout/i)
    }
  }
  console.log('Novo project inference passed two synthetic cases through OpenJarvis and MCP')
} finally {
  if (worker.exitCode === null && worker.signalCode === null) {
    const ended = once(worker, 'exit')
    worker.kill()
    await ended
  }
}
