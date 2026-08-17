/**
 * @jest-environment node
 */
import { runAI } from '../lib/ai/runner'
import { executeAIAction, pickResultMessage } from '../lib/ai/executor'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    task: { create: jest.fn().mockResolvedValue({ id: 'task-1', title: 'Estudiar matemáticas' }) },
    user: { findUnique: jest.fn().mockResolvedValue(undefined) },
    aiActionLog: { create: jest.fn(), count: jest.fn() },
  },
}))

describe('Actions', () => {
  // Groq is the only mocked boundary: this still runs Novo's intent
  // classification, context construction and runner logic. A parsed action
  // must remain confirmation-gated before any executor can receive it.
  test('Task creation requires confirmation', async () => {
    const priorKey = process.env.GROQ_API_KEY
    const previousFetch = global.fetch
    process.env.GROQ_API_KEY = 'test-key'
    const fetchMock = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ choices: [{ message: { content: 'Prepararé la tarea.' } }] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ action: { name: 'CREATE_TASK', payload: { title: 'Estudiar matemáticas' } } }) } }] }) })
    global.fetch = fetchMock as typeof global.fetch
    try {
      const res = await runAI('Crea una tarea para estudiar matemáticas mañana')
      expect(res.type).toBe('PROPOSAL')
      if (res.type === 'PROPOSAL') {
        expect(res.action.name).toBe('CREATE_TASK')
        expect(res.requiresConfirmation).toBe(true)
      }
    } finally {
      global.fetch = previousFetch
      if (priorKey === undefined) delete process.env.GROQ_API_KEY
      else process.env.GROQ_API_KEY = priorKey
    }
  })

  test('Confirmed action executes', async () => {
    const confirmed = await executeAIAction({ type: 'CREATE_TASK', payload: { title: 'Estudiar matemáticas', dueDate: '2025-12-19' } }, 'demo-user-id')
    expect(confirmed.success).toBe(true)
  })

  test('pickResultMessage prefers the post-execution result over the model guess', () => {
    expect(pickResultMessage({ message: 'Se ha generado el archivo "documento.txt".' }, 'El archivo "undefined" se ha generado correctamente.')).toBe('Se ha generado el archivo "documento.txt".')
  })

  test('pickResultMessage falls back to the model message without an execution result', () => {
    expect(pickResultMessage({}, 'modelo dice hola')).toBe('modelo dice hola')
  })

  test('pickResultMessage falls back to the provided default', () => {
    expect(pickResultMessage({}, undefined, 'valor por defecto')).toBe('valor por defecto')
  })
})
