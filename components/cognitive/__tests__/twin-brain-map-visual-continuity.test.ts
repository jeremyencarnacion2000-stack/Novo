import fs from 'node:fs'
import path from 'node:path'

const source = () => fs.readFileSync(path.join(process.cwd(), 'components', 'cognitive', 'twin-brain-map.tsx'), 'utf8')

describe('TwinBrainMap visual continuity', () => {
  it('keeps the brain silhouette mounted after WebGL becomes ready', () => {
    const graphSource = source()

    expect(graphSource).toContain('data-testid="twin-brain-silhouette"')
    expect(graphSource).toContain('data-testid="twin-brain-webgl"')
    expect(graphSource).toContain('data-testid="twin-brain-fallback-nodes"')
    expect(graphSource).toContain('aria-hidden="true"')
  })
})
