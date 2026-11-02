import { resolveNovoMotionMode } from '@/hooks/use-novo-motion-policy'

describe('resolveNovoMotionMode', () => {
  it('honors the operating system reduced-motion setting on desktop', () => {
    expect(resolveNovoMotionMode({
      showAnimations: true,
      systemPrefersReducedMotion: true,
    })).toBe('reduced')
  })

  it('honors the operating system reduced-motion setting on mobile', () => {
    expect(resolveNovoMotionMode({
      showAnimations: true,
      systemPrefersReducedMotion: true,
    })).toBe('reduced')
  })

  it('keeps normal motion when the operating system allows it', () => {
    expect(resolveNovoMotionMode({
      showAnimations: true,
      systemPrefersReducedMotion: false,
    })).toBe('full')
  })

  it('turns motion off everywhere when the Novo setting is disabled', () => {
    expect(resolveNovoMotionMode({
      showAnimations: false,
      systemPrefersReducedMotion: true,
    })).toBe('off')
  })
})
