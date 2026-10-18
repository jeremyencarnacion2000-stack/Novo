import fs from 'node:fs'
import path from 'node:path'

const css = fs.readFileSync(path.join(process.cwd(), 'app/globals.css'), 'utf8')
  .split('/* Regular navigation glass:')[1]
const themeBlocks = [css.match(/:root\s*\{([^}]+)\}/)![1], css.match(/\.dark\s*\{([^}]+)\}/)![1]]
const token = (block: string, name: string) => block.match(new RegExp(`--novo-navigation-${name}:\\s*([^;]+);`))![1]

describe('visible navigation glass contract', () => {
  it.each(themeBlocks.map((block, i) => [i ? 'dark' : 'light', block]))(
    'keeps the %s lens transparent and protects foreground locally', (_theme, block) => {
      for (const material of ['tint', 'panel-tint']) {
        const channels = token(block, material).match(/[\d.]+/g)!.map(Number)
        expect(channels[3]).toBeGreaterThan(0)
        expect(channels[3]).toBeLessThanOrEqual(0.2)
      }
      expect(token(block, 'text-shadow')).toContain('rgba(')
      expect(token(block, 'icon-shadow')).toContain('rgba(')
      expect(token(block, 'foreground')).toMatch(/^#[a-f0-9]{6}$/i)
    },
  )

  it('uses the configured sidebar material and never disables lenses for OS transparency hints', () => {
    expect(css).toContain('background: var(--novo-context-background) !important')
    expect(css).not.toContain('@media (prefers-reduced-transparency: reduce)')
    expect(css).not.toContain('@media (prefers-contrast: more), (forced-colors: active)')
  })
})
