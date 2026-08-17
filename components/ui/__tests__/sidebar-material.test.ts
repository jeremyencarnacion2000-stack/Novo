import fs from 'node:fs'
import path from 'node:path'
import postcss from 'postcss'

describe('sidebar material', () => {
  it('maps the shared desktop and mobile sidebar class to Context Glass', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'app', 'globals.css'), 'utf8')
    const root = postcss.parse(source)
    const declarations = new Map<string, string>()

    root.walkRules('.novo-sidebar-material', (rule) => {
      rule.walkDecls((declaration) => {
        declarations.set(declaration.prop, declaration.value)
      })
    })

    expect(declarations.get('background')).toBe('var(--novo-context-background)')
    expect(declarations.get('backdrop-filter')).toBe('var(--novo-context-backdrop-filter)')
    expect(declarations.get('border')).toBe('var(--novo-context-border)')
    expect(declarations.get('box-shadow')).toBe('var(--novo-context-box-shadow)')
  })
})
