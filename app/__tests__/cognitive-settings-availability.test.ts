import fs from 'node:fs'
import path from 'node:path'

describe('Cognitive route settings availability', () => {
  it('keeps the globally controlled settings modal mounted on the Cognitive route', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'app', 'client-layout.tsx'), 'utf8')

    // The same guard is intentionally used by the route-specific quick-capture
    // boundary. Assert the Cognitive shell directly instead of rejecting that
    // valid guard by string coincidence.
    expect(source).toContain('function RouteAppShell')
    expect(source).toContain('<CognitiveRouteShell>{children}</CognitiveRouteShell>')
    expect(source).toContain('{!isCognitiveRoute && <CommandPalette />}')
    expect(source).toContain('<SettingsModal />')
  })
})
