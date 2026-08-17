import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('Todoist ambient runner no-browser boundary', () => {
  it('has no React or browser runtime dependency', () => {
    const source = readFileSync(resolve(process.cwd(), 'lib/cognitive-reconciliation/todoist-ambient-runner.ts'), 'utf8')
    expect(source).not.toMatch(/from ['\"]react|from ['\"].*client|\b(window|document|localStorage|sessionStorage)\b/)
  })
})
