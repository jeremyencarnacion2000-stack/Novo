import fs from 'node:fs'
import path from 'node:path'

describe('Cognitive route settings availability', () => {
  it('keeps the globally controlled settings modal mounted on the Cognitive route', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'components/cognitive/cognitive-route-shell.tsx'), 'utf8')
    const utilities = fs.readFileSync(path.join(process.cwd(), 'components/cognitive/cognitive-navigation-utilities.tsx'), 'utf8')

    // The same guard is intentionally used by the route-specific quick-capture
    // boundary. Assert the Cognitive shell directly instead of rejecting that
    // valid guard by string coincidence.
    expect(source).toContain('<CognitiveNavigationUtilities />')
    expect(utilities).toContain('<SettingsModal />')
  })

  it('routes the in-app animation preference into Framer Motion', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'components/app-motion-settings.tsx'), 'utf8')

    expect(source).toContain('function AppMotionSettings')
    expect(source).toContain('useNovoMotionPolicy(settings.showAnimations)')
    expect(source).toContain("reducedMotion={mode === 'full' ? 'never' : 'always'}")
    const cognitive = fs.readFileSync(path.join(process.cwd(), 'app/cognitive/cognitive-client-layout.tsx'), 'utf8')
    expect(cognitive).toContain('<AppMotionSettings>')
    expect(source).not.toContain('<MotionConfig reducedMotion="user">')
  })
})
