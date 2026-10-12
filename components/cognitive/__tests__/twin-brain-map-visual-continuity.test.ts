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

  it('compares WebGL backing pixels before resizing the renderer', () => {
    const graphSource = source()

    expect(graphSource).toContain('const pixelRatio = renderer.getPixelRatio()')
    expect(graphSource).toContain('const backingWidth = Math.floor(width * pixelRatio)')
    expect(graphSource).toContain('canvas.width !== backingWidth || canvas.height !== backingHeight')
  })

  it('stops the render loop when the app is backgrounded', () => {
    const graphSource = source()

    expect(graphSource).toContain("document.addEventListener('visibilitychange', handleDocumentVisibility)")
    expect(graphSource).toContain("document.visibilityState !== 'hidden'")
    expect(graphSource).toContain('window.cancelAnimationFrame(frame)')
  })
})
