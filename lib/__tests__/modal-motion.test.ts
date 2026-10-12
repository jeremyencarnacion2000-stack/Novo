import {
  createModalChromeBridge,
  MODAL_CUSTOM_EASE,
  MODAL_MOTION,
  resolveModalMotionPreset,
  resolveModalMotionStrategy,
  type ModalMotionPreset,
} from '@/lib/modal-motion'

describe('modal motion contract', () => {
  it('uses the requested native presentation without guessing from geometry', () => {
    const presets: ModalMotionPreset[] = [
      'shared',
      'center',
      'anchored',
      'command',
      'sheet',
      'fullscreen',
      'alert',
    ]

    for (const preset of presets) {
      expect(resolveModalMotionPreset({ preset })).toBe(preset)
    }
  })

  it('keeps legacy flip targets on the shared-element path', () => {
    expect(resolveModalMotionPreset({ legacyMotionId: 'task-42' })).toBe('shared')
    expect(resolveModalMotionPreset({ legacyMotionId: 'task-42', flipAnchored: true })).toBe('anchored')
  })

  it('turns form and detail dialogs into sheets on mobile when requested', () => {
    expect(resolveModalMotionPreset({
      preset: 'shared',
      mobilePresentation: 'sheet',
      isMobile: true,
    })).toBe('sheet')

    expect(resolveModalMotionPreset({
      preset: 'center',
      mobilePresentation: 'fullscreen',
      isMobile: true,
    })).toBe('fullscreen')
  })

  it('uses opacity-only motion for reduced mode and no motion when disabled', () => {
    expect(resolveModalMotionStrategy('shared', 'reduced')).toEqual({
      preset: 'center',
      duration: 0.16,
      opacityOnly: true,
      immediate: false,
    })
    expect(resolveModalMotionStrategy('shared', 'off')).toEqual({
      preset: 'center',
      duration: 0,
      opacityOnly: true,
      immediate: true,
    })
  })

  it('exposes one exact timing table for every modal surface', () => {
    expect(MODAL_CUSTOM_EASE.fluid).toBe(
      'M0,0 C0.10,0.64 0.14,0.91 0.32,0.985 C0.50,1 0.72,1 1,1',
    )
    expect(MODAL_MOTION.shared).toMatchObject({ enter: 0.59, exit: 0.52 })
    expect(MODAL_MOTION.center).toMatchObject({ enter: 0.3, exit: 0.22 })
    expect(MODAL_MOTION.anchored).toMatchObject({ enter: 0.24, exit: 0.18 })
    expect(MODAL_MOTION.command).toMatchObject({ enter: 0.18, exit: 0.14 })
    expect(MODAL_MOTION.sheet).toMatchObject({ enter: 0.38, exit: 0.28 })
    expect(MODAL_MOTION.alert).toMatchObject({ enter: 0.24, exit: 0.18 })
    expect(MODAL_MOTION.shared.subtitleAt).toBe(0.34)
    expect(MODAL_MOTION.shared.contentAt).toBe(0.38)
    expect(MODAL_MOTION.shared.closeAt).toBe(0.43)
    expect(MODAL_MOTION.shared.contentDuration).toBe(0.28)
    expect(MODAL_MOTION.shared.stagger).toBe(0.034)
  })

  it('creates a union-sized chrome bridge with source and destination clips', () => {
    const source = document.createElement('button')
    source.style.borderRadius = '18px'
    source.style.backgroundColor = 'rgb(20, 30, 40)'
    source.style.backgroundImage = 'url(/noise.png)'
    source.style.backdropFilter = 'blur(0.5px) url(#ngfglass) blur(1px)'
    ;(source.style as CSSStyleDeclaration & { webkitBackdropFilter?: string }).webkitBackdropFilter = source.style.backdropFilter
    source.getBoundingClientRect = () => ({
      x: 20,
      y: 30,
      left: 20,
      top: 30,
      right: 140,
      bottom: 74,
      width: 120,
      height: 44,
      toJSON: () => ({}),
    })
    const target = document.createElement('section')
    target.style.borderRadius = '30px'
    target.style.backgroundColor = 'rgb(240, 240, 240)'
    target.getBoundingClientRect = () => ({
      x: 200,
      y: 100,
      left: 200,
      top: 100,
      right: 500,
      bottom: 340,
      width: 300,
      height: 240,
      toJSON: () => ({}),
    })
    document.body.appendChild(source)
    document.body.appendChild(target)

    const bridge = createModalChromeBridge(source, target)

    expect(bridge.root.dataset.modalMotionBridge).toBe('')
    expect(bridge.root.getAttribute('aria-hidden')).toBe('true')
    expect(bridge.root.style.position).toBe('fixed')
    expect(bridge.root.style.pointerEvents).toBe('none')
    expect(bridge.root.style.left).toBe('20px')
    expect(bridge.root.style.top).toBe('30px')
    expect(bridge.root.style.width).toBe('480px')
    expect(bridge.root.style.height).toBe('310px')
    expect(bridge.startClip).toBe('inset(0px 360px 266px 0px round 18px)')
    expect(bridge.endClip).toBe('inset(70px 0px 0px 180px round 30px)')
    expect(bridge.compactSkin.dataset.modalMotionSkin).toBe('compact')
    expect(bridge.expandedSkin.dataset.modalMotionSkin).toBe('expanded')
    expect(bridge.compactSkin.style.backgroundImage).toContain('noise.png')
    expect(bridge.compactSkin.style.backdropFilter).toContain('url(#ngfglass)')
    expect(bridge.expandedSkin.style.opacity).toBe('0')
    expect(document.body.contains(bridge.root)).toBe(true)

    bridge.root.remove()
    source.remove()
    target.remove()
  })
})
