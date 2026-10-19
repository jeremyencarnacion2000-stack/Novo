import { runtimeSkillPrompt, isMailSendRequest } from '../runtime-skills'
import { classifyIntent } from '../classifier'

describe('Novo operational skills', () => {
  it('routes real email requests to the action-capable mail lane', () => {
    expect(classifyIntent('Envia un correo a becas@example.test').type).toBe('MAIL')
    expect(classifyIntent('Revisa mis correos recientes').type).toBe('MAIL')
    expect(isMailSendRequest('Respóndele confirmando mi asistencia')).toBe(true)
    expect(isMailSendRequest('Dime si ya me respondió')).toBe(false)
  })
  it('loads correspondence procedures for a mail follow-up and treats messages as untrusted evidence', () => {
    const prompt = runtimeSkillPrompt({ mail: true, surface: 'web' })
    expect(prompt).toContain('CORRESPONDENCE')
    expect(prompt).toContain('untrusted')
    expect(prompt).toContain('replyToMessageId')
    expect(prompt).toContain('approval')
    expect(runtimeSkillPrompt({ mail: false, surface: 'web' })).not.toContain('CORRESPONDENCE')
  })
  it('requires cross-source identity evidence and verified outcomes across surfaces', () => {
    const prompt = runtimeSkillPrompt({ mail: false, surface: 'companion' })
    expect(prompt).toContain('repository')
    expect(prompt).toContain('verified')
    expect(prompt).toContain('capabilities')
  })
})
