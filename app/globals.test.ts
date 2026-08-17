import fs from 'node:fs'
import path from 'node:path'
import postcss, { type Root } from 'postcss'

const stylesheet = (): Root => postcss.parse(
  fs.readFileSync(path.join(process.cwd(), 'app', 'globals.css'), 'utf8'),
)

const backdropFilterFor = (root: Root, selector: string) => {
  let value: string | undefined

  root.walkRules((rule) => {
    if (rule.selector === selector) {
      rule.walkDecls('backdrop-filter', (declaration) => {
        value = declaration.value
      })
    }
  })

  return value
}

const declarationFor = (root: Root, selector: string, property: string) => {
  let value: string | undefined

  root.walkRules((rule) => {
    if (rule.selector === selector) {
      rule.walkDecls(property, (declaration) => {
        value = declaration.value
      })
    }
  })

  return value
}

const layerFor = (root: Root, selector: string) => {
  let layer: string | undefined

  root.walkRules((rule) => {
    if (rule.selector === selector && rule.parent?.type === 'atrule' && rule.parent.name === 'layer') {
      layer = rule.parent.params
    }
  })

  return layer
}

const utilityDeclarationFor = (root: Root, name: string, property: string) => {
  let value: string | undefined

  root.walkAtRules('utility', (rule) => {
    if (rule.params === name) {
      rule.walkDecls(property, (declaration) => {
        value = declaration.value
      })
    }
  })

  return value
}

describe('liquid glass card tiers', () => {
  it('feeds everyday liquid cards from the card Settings controls (Focus)', () => {
    const root = stylesheet()

    // Settings labels these sliders "Dashboard Card Glass Opacity" and
    // "Dashboard Card Refraction Blur" (cardOpacity/cardLiquidIntensity),
    // which the material contract resolves into --novo-focus-*. Cards must
    // therefore read Focus — reading Context (the sidebar glass sliders)
    // made the card sliders change nothing, reported as "se dañó".
    expect(backdropFilterFor(root, '.liquid-glass,\n  .liquid-glass-subtle')).toBe(
      'var(--novo-focus-backdrop-filter)',
    )
    expect(declarationFor(root, '.liquid-glass,\n  .liquid-glass-subtle', 'background')).toBe(
      'var(--novo-focus-background)',
    )
    expect(backdropFilterFor(root, '.liquid-glass-hover')).toBe('var(--novo-focus-backdrop-filter)')
    expect(declarationFor(root, '.liquid-glass-hover', 'background')).toBe('var(--novo-focus-background)')
    expect(backdropFilterFor(root, '.liquid-glass-elevated')).toBe(
      'var(--novo-focus-backdrop-filter)',
    )
    expect(backdropFilterFor(root, '.liquid-glass-premium')).toBe(
      'var(--novo-focus-backdrop-filter)',
    )
  })

  it('keeps the established card hierarchy instead of forcing every tier to Focus', () => {
    const root = stylesheet()

    for (const utility of ['card--hero', 'card--primary', 'glass-surface']) {
      expect(utilityDeclarationFor(root, utility, 'background')).toBe('var(--novo-focus-background)')
      expect(utilityDeclarationFor(root, utility, 'backdrop-filter')).toBe('var(--novo-focus-backdrop-filter)')
    }

    for (const utility of ['card--secondary', 'card--tertiary']) {
      expect(utilityDeclarationFor(root, utility, 'background')).toBe('var(--novo-context-background)')
      expect(utilityDeclarationFor(root, utility, 'backdrop-filter')).toBe('var(--novo-context-backdrop-filter)')
    }
  })

  it('keeps repeated shared glass cards inside Context Glass', () => {
    const root = stylesheet()

    expect(backdropFilterFor(root, '.glass-card')).toBe('var(--novo-context-backdrop-filter)')
    expect(declarationFor(root, '.glass-card', 'isolation')).toBe('isolate')
    expect(backdropFilterFor(root, '.glass-card-list')).toBe('var(--novo-context-backdrop-filter)')
  })

  it('maps retained generic card and navigation utilities to contract roles', () => {
    const root = stylesheet()

    expect(utilityDeclarationFor(root, 'glass', 'backdrop-filter')).toBe('var(--novo-context-backdrop-filter)')
    expect(utilityDeclarationFor(root, 'glass-blur', 'backdrop-filter')).toBe('var(--novo-context-backdrop-filter)')
  })
})

describe('custom wallpaper backdrop', () => {
  it('maps the document body to Canvas without a competing wallpaper pseudo-layer', () => {
    const root = stylesheet()

    expect(declarationFor(root, 'body', 'isolation')).toBe('isolate')
    expect(declarationFor(root, 'body', 'background')).toBe('var(--novo-canvas-background, var(--background))')
    expect(declarationFor(root, 'body', 'border')).toBe('var(--novo-canvas-border, 1px solid transparent)')
    expect(declarationFor(root, 'body', 'box-shadow')).toBe('var(--novo-canvas-box-shadow, none)')
    expect(declarationFor(root, 'body.has-bg-image::before', 'z-index')).toBeUndefined()
    expect(declarationFor(root, 'body.has-bg-image::after', 'z-index')).toBeUndefined()
  })

  it('keeps premium fields moving slowly while preserving reduced-motion support', () => {
    const root = stylesheet()

    expect(declarationFor(root, '.novo-premium-field::after', 'animation')).toContain('novo-premium-drift')
    expect(declarationFor(root, '.novo-premium-field::after', 'animation')).toContain('18s')
  })

  it('maps Focus Surface without wallpaper-only overrides', () => {
    const root = stylesheet()

    expect(declarationFor(root, '.novo-focus-surface', 'background')).toBe('var(--novo-focus-background)')
    expect(backdropFilterFor(root, '.novo-focus-surface')).toBe('var(--novo-focus-backdrop-filter)')
    expect(declarationFor(root, '.novo-focus-surface', 'border')).toBe('var(--novo-focus-border)')
    expect(declarationFor(root, '.novo-focus-surface', 'box-shadow')).toBe('var(--novo-focus-box-shadow)')
  })

  it('routes premium dashboard cards through Focus Surface', () => {
    const root = stylesheet()

    expect(backdropFilterFor(root, '.novo-premium-field')).toBe('var(--novo-focus-backdrop-filter)')
    expect(declarationFor(root, '.novo-premium-field', 'background')).toBe('var(--novo-focus-background)')
  })

  it('mounts the wallpaper inside the app backdrop root', () => {
    const root = stylesheet()

    expect(declarationFor(root, '[data-app-viewport]', 'isolation')).toBe('isolate')
    expect(declarationFor(root, 'body.has-bg-image [data-app-wallpaper]', 'background')).toBe('var(--novo-canvas-background)')
    expect(declarationFor(root, 'body.has-bg-image [data-app-wallpaper]', 'filter')).toBe('var(--novo-canvas-backdrop-filter)')
    expect(declarationFor(root, '[data-app-viewport] > [data-app-wallpaper]', 'z-index')).toBe('0')
  })
})
