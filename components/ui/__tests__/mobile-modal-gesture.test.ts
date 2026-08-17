import fs from 'node:fs'
import path from 'node:path'

const dialogSource = () => fs.readFileSync(path.join(process.cwd(), 'components', 'ui', 'dialog.tsx'), 'utf8')

describe('mobile dialog dismissal gesture', () => {
  it('exposes a touch-only drag handle so dialog scrolling cannot cancel dismissal', () => {
    const source = dialogSource()

    expect(source).toContain('data-modal-drag-handle')
    expect(source).toContain('touch-none')
    expect(source).not.toContain('pt-3 pb-2 -mt-3 -mx-4 select-none pointer-events-none')
  })
})
