import fs from 'node:fs'
import path from 'node:path'

describe('desktop sidebar compositing', () => {
  it("does not render the legacy edge rail inside Novo's floating sidebar", () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'components', 'app-sidebar.tsx'), 'utf8')

    expect(source).not.toContain('<SidebarRail')
  })

  it('keeps the backdrop layer in its own stable paint boundary', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'app', 'globals.css'), 'utf8')

    expect(source).toContain("[data-slot='sidebar-inner']")
    expect(source).toContain('contain: paint')
  })
})
