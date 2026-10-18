import fs from 'node:fs'
import path from 'node:path'
const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8')

it('routes all modal primitives through the liquid driver with retained content and composed focus', () => {
  for (const file of ['components/ui/dialog.tsx', 'components/ui/sheet.tsx', 'components/ui/alert-dialog.tsx']) {
    const source = read(file)
    expect(source).toContain('retainedChildren.current')
    expect(source).toContain('restoreModalOriginFocus')
    expect(source).toContain('useNativeDialogMotion')
    expect(source).toContain('surfaceElement,')
  }
  expect(read('lib/modal-flip.ts')).toContain('createLiquidModalMotion')
  expect(read('hooks/use-drag-to-dismiss.ts')).toContain('getLiquidModalOverlay(surface)')
})

it('migrates the custom windows and retains document viewers through close', () => {
  expect(read('components/companion/developer-context-panel.tsx')).toContain('<Dialog open={previewOpen}')
  expect(read('components/companion/developer-context-panel.tsx')).not.toContain('role="dialog"')
  expect(read('components/ai/modern-chatbot/welcome-hero.tsx')).toContain('<Dialog open={open}')
  for (const file of ['components/ai/modern-chatbot/message.tsx', 'components/ai/modern-chatbot/blocks/result-block.tsx']) {
    expect(read(file)).toContain('open={showPreview}')
    expect(read(file)).not.toContain('{showPreview &&')
  }
  expect(read('app/trackers/page.tsx')).not.toContain('modalFlip.untoggle')
})

it('has no native confirmations bypassing Novo approval', () => {
  const walk = (directory: string): string[] => fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === '__tests__' || entry.name === 'node_modules') return []
    const file = path.join(directory, entry.name)
    return entry.isDirectory() ? walk(file) : /\.[jt]sx?$/.test(file) ? [file] : []
  })
  for (const file of [...walk(path.join(process.cwd(), 'app')), ...walk(path.join(process.cwd(), 'components'))]) {
    expect(fs.readFileSync(file, 'utf8').match(/\b(?:window\.)?confirm\s*\(/)).toBeNull()
  }
})
