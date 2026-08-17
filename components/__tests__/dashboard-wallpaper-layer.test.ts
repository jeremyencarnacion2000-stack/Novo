import fs from 'node:fs'
import path from 'node:path'

describe('dashboard wallpaper composition', () => {
  it('mounts the wallpaper inside the same compositor as cards and sidebar', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'components', 'dashboard-shell.tsx'), 'utf8')

    expect(source).toContain('<div data-app-wallpaper aria-hidden />')
  })
})
