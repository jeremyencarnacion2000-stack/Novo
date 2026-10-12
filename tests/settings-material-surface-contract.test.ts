import fs from 'node:fs'
import path from 'node:path'

describe('settings-driven material surfaces', () => {
  const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8')

  it('does not freeze prominent app surfaces to a hardcoded blur', () => {
    const sources = [
      read('app/projects/page.tsx'),
      read('app/focus/page.tsx'),
      read('components/routines/routine-stats.tsx'),
      read('components/focus-timer-widget.tsx'),
    ]

    for (const source of sources) {
      expect(source).not.toMatch(/backdropFilter:\s*['\"]blur\(/)
      expect(source).toContain('var(--novo-')
    }
  })
})
