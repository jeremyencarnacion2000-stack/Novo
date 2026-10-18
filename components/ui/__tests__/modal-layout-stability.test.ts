import fs from 'node:fs'
import path from 'node:path'

const readSource = (relativePath: string) =>
  fs.readFileSync(path.join(process.cwd(), ...relativePath.split('/')), 'utf8').replace(/\r\n/g, '\n')

describe('modal layout stability', () => {
  it('ties readable content to the same droplet progress as its chrome', () => {
    const source = readSource('lib/liquid-modal-motion.ts')
    expect(source).toContain('surface.style.opacity = String(g.reveal)')
    expect(readSource('lib/liquid-modal.ts')).toContain('reveal: modalSegment(p, 0.54, 0.9)')
  })

  it('centers large flip dialogs unless a small dialog explicitly opts into anchoring', () => {
    const source = readSource('components/ui/dialog.tsx')

    expect(source).toContain('isFlipModal && flipAnchored === true')
    expect(source).not.toContain('isFlipModal && flipAnchored !== false')
  })

  it('does not reposition an open modal when its content finishes laying out', () => {
    const source = readSource('components/ui/dialog.tsx')

    expect(source).not.toContain('new ResizeObserver(place)')
    expect(source).not.toContain('resizeObserver.observe(surface)')
  })

  it('clamps contextual dialogs using the visual viewport and their CSS bounds', () => {
    const source = readSource('components/ui/dialog.tsx')

    expect(source).toContain('window.visualViewport?.width')
    expect(source).toContain('const maxPanelWidth = Math.min(448')
    expect(source).toContain('const maxPanelHeight = Math.max(0, viewportHeight * 0.9)')
    expect(source).not.toContain('window.innerWidth : 640) - 432')
    expect(source).not.toContain('window.innerHeight : 800) - 180')
  })

  it('keeps the portal box in its natural layout while FLIP animates the presentation transform', () => {
    const source = readSource('lib/modal-flip.ts')

    // The portal already owns the final, clamped layout. Replacing it with a
    // fixed pixel box during the animation makes Radix restore a different
    // layout after the motion completes, which reads as a second jump.
    expect(source).not.toContain("position: 'fixed'")
    expect(source).not.toContain("position:  'fixed'")
    expect(source).toContain('createLiquidModalMotion')
    expect(source).not.toContain('createModalSurfaceProxy')
    expect(source).not.toContain('animateProxyTo')
    expect(source).not.toMatch(/tl\.to\(target,\s*\{[\s\S]{0,220}scaleX:/)
    expect(source).not.toMatch(/tl\.to\(target,\s*\{[\s\S]{0,220}scaleY:/)
  })

  it('shares one interruptible spring between native and shared modal paths', () => {
    const motion = readSource('lib/liquid-modal-motion.ts')
    const flip = readSource('lib/modal-flip.ts')
    const native = readSource('hooks/use-native-dialog-motion.ts')

    expect(motion).toContain('spring.target = next')
    expect(motion).toContain('spring.configure(')
    expect(native).toContain('createLiquidModalMotion')
    expect(flip).toContain('createLiquidModalMotion')
  })

  it('exposes one native motion API instead of per-modal animation classes', () => {
    const source = readSource('components/ui/dialog.tsx')

    expect(source).toContain('motionPreset?: ModalMotionPreset')
    expect(source).toContain('motionId?: string')
    expect(source).toContain('mobilePresentation?: ModalMobilePresentation')
    expect(source).toContain('anchorRef?: React.RefObject<HTMLElement | null>')
    expect(source).toContain('useNativeDialogMotion')
    expect(source).not.toContain("data-[state=open]:animate-in data-[state=closed]:animate-out")
  })
})
