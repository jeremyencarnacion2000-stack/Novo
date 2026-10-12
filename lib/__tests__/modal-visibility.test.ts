import fs from 'node:fs'
import path from 'node:path'

const globals = fs.readFileSync(path.join(process.cwd(), 'app', 'globals.css'), 'utf8')
const dialog = fs.readFileSync(path.join(process.cwd(), 'components', 'ui', 'dialog.tsx'), 'utf8')
const flip = fs.readFileSync(path.join(process.cwd(), 'lib', 'modal-flip.ts'), 'utf8')

describe('modal visibility regression guard', () => {
  it('does not globally hide modal surfaces or the Radix overlay', () => {
    expect(globals).toMatch(/\.novo-modal-surface,\s*\.novo-dialog-overlay\s*\{\s*opacity:\s*1;/)
    expect(dialog).not.toMatch(/novo-dialog-overlay[^\n]*opacity-0/)
  })

  it('has an explicit preparing state and visible settle frame', () => {
    expect(globals).toContain('data-modal-motion-state="preparing"')
    expect(flip).toContain("target.style.opacity = '1'")
    expect(flip).toContain("target.dataset.modalMotionState = 'open'")
  })
})
