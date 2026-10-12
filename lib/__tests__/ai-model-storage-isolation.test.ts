import { aiModelManager } from '@/lib/ai-models'

describe('AI model storage isolation', () => {
  beforeEach(() => {
    localStorage.clear()
    aiModelManager.setStorageScope(null)
  })

  it('keeps custom model catalogs scoped to the authenticated account', () => {
    aiModelManager.setStorageScope('user:user-a')
    expect(aiModelManager.getModels().some(model => model.id === 'default')).toBe(true)

    aiModelManager.setStorageScope('user:user-b')
    expect(aiModelManager.getModels().some(model => model.id === 'default')).toBe(true)
    expect(localStorage.getItem('novo_ai_models')).toBeNull()
    expect(localStorage.getItem('novo_ai_models:user:user-a')).not.toBeNull()
    expect(localStorage.getItem('novo_ai_models:user:user-b')).not.toBeNull()
  })
})
