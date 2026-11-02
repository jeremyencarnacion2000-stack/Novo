import { classifyIntent, executeVoiceCommand } from '../voice-executor'
import type { BioState } from '../cognitive-engine'

it.each(['hola Novo, ¿me puedes ayudar?', 'necesito que revises mis correos', 'tengo que pensar en eso', 'What can you help me with?'])(
  'does not interpret ordinary speech as a task: %s', async (text) => {
    const fetchSpy = jest.spyOn(global, 'fetch')
    try {
      expect(classifyIntent(text).action).toBe('unknown')
      expect((await executeVoiceCommand(text, {} as BioState)).success).toBe(false)
      expect(fetchSpy).not.toHaveBeenCalled()
    } finally { fetchSpy.mockRestore() }
  },
)

it.each(['crea tarea revisar presupuesto', 'create task review budget'])(
  'keeps explicit task commands: %s', (text) => {
    expect(classifyIntent(text).action).toBe('create_task')
  },
)
