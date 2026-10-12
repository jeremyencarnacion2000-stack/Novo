import { resolveNovoMotionMode } from '@/hooks/use-novo-motion-policy'

describe('resolveNovoMotionMode', () => {
  it('keeps full Novo motion on desktop even when Windows requests reduced motion', () => {
    expect(resolveNovoMotionMode({
      showAnimations: true,
      isMobile: false,
      systemPrefersReducedMotion: true,
    })).toBe('full')
  })

  it('uses reduced motion on mobile when the operating system requests it', () => {
    expect(resolveNovoMotionMode({
      showAnimations: true,
      isMobile: true,
      systemPrefersReducedMotion: true,
    })).toBe('reduced')
  })

  it('turns motion off everywhere when the Novo setting is disabled', () => {
    expect(resolveNovoMotionMode({
      showAnimations: false,
      isMobile: false,
      systemPrefersReducedMotion: false,
    })).toBe('off')
  })
})
