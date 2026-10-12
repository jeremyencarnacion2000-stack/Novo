import fs from 'node:fs'
import path from 'node:path'

describe('chat connector capability status', () => {
  it('does not treat a basic Google identity grant as connector access', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'components', 'ai', 'modern-chatbot', 'connectors-modal.tsx'),
      'utf8',
    )

    expect(source).toContain('connected: !!statuses.calendar')
    expect(source).toContain('connected: !!statuses.gmail')
    expect(source).toContain('connected: !!statuses.drive')
    expect(source).not.toContain('connected: !!statuses.calendar || !!statuses.google')
    expect(source).not.toContain('connected: !!statuses.gmail || !!statuses.google')
    expect(source).not.toContain('connected: !!statuses.drive || !!statuses.google')
  })
})
