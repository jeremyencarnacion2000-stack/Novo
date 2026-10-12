import fs from 'node:fs'
import path from 'node:path'
import postcss, { type Root } from 'postcss'

const stylesheet = (): Root => postcss.parse(
  fs.readFileSync(path.join(process.cwd(), 'app', 'globals.css'), 'utf8'),
)

const normalizeSelector = (selector: string) => selector.replace(/\r\n/g, '\n')

const backdropFilterFor = (root: Root, selector: string) => {
  let value: string | undefined

  root.walkRules((rule) => {
    if (normalizeSelector(rule.selector) === normalizeSelector(selector)) {
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
    if (normalizeSelector(rule.selector) === normalizeSelector(selector)) {
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
    if (normalizeSelector(rule.selector) === normalizeSelector(selector) && rule.parent?.type === 'atrule' && rule.parent.name === 'layer') {
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
  it('keeps the shared primary Card on the live Focus material contract', () => {
    const root = stylesheet()
    const selector = ".novo-card-surface[data-variant='primary']"

    expect(declarationFor(root, selector, 'background')).toBe('var(--novo-focus-background)')
    expect(backdropFilterFor(root, selector)).toBe('var(--novo-focus-backdrop-filter)')
    expect(declarationFor(root, selector, '-webkit-backdrop-filter')).toBe('var(--novo-focus-backdrop-filter)')
    expect(declarationFor(root, selector, 'border')).toBe('var(--novo-focus-border)')
    expect(declarationFor(root, selector, 'box-shadow')).toBe('var(--novo-focus-box-shadow)')
  })

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

  it('keeps desktop liquid refraction controlled by Novo rather than an implicit OS media override', () => {
    const root = stylesheet()

    expect(root.toString()).not.toContain('@media (prefers-reduced-transparency: reduce)')
    expect(backdropFilterFor(root, "html[data-accessibility-reduce-glass='true'] [data-glass-refractive]")).toBe('none')
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

describe('mobile navigation panel glass controls', () => {
  it('keeps the selected destination visibly distinct on the shared nav-control material', () => {
    const root = stylesheet()
    expect(
      declarationFor(root, ".novo-mobile-nav-panel .novo-nav-glass-control[data-active='true']", 'background'),
    ).toBe('color-mix(in srgb, var(--novo-context-background) 32%, transparent)')
    expect(
      declarationFor(root, ".novo-mobile-nav-panel .novo-nav-glass-control[data-active='true']", 'isolation'),
    ).toBe('auto')
  })
})

describe('interaction motion contract', () => {
  it('does not let the global interaction rule animate layout metrics', () => {
    const root = stylesheet()
    const transition = declarationFor(root, `a,
  button,
  [role="button"],
  input,
  select,
  textarea,
  [data-slot="tabs-trigger"],
  [data-slot="sidebar-menu-button"]`, 'transition')

    expect(transition).toContain('transform')
    expect(transition).toContain('background-color')
    expect(transition).not.toContain('all ')
  })

  it('honors the in-app animation preference independently of the OS setting', () => {
    const root = stylesheet()
    const rule = root.nodes.find((node) => node.type === 'rule' && node.selector.includes("[data-animations='false']"))

    expect(rule?.toString()).toContain('animation: none !important')
    expect(rule?.toString()).toContain('transition: none !important')
    expect(rule?.toString()).toContain('scroll-behavior: auto !important')
  })

  it('uses a static cognitive field with only a short opacity crossfade in reduced mode', () => {
    const root = stylesheet()
    const selector = ":root[data-novo-motion='reduced'] [data-app-viewport] .novo-motion-context-node"

    expect(declarationFor(root, selector, 'transition-property')).toBe('opacity')
    expect(declarationFor(root, selector, 'transition-duration')).toBe('160ms')
  })
})

describe('bounded ambient motion', () => {
  it('plays the chat confirmation glow once instead of repainting its shadow forever', () => {
    const root = stylesheet()

    expect(declarationFor(root, '.animate-glow-pulse', 'animation')).toBe('glow-pulse 3s ease-in-out 1')
  })
})
