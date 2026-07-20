import { detectAbandonmentPattern, FocusSessionSample } from '../focus-abandonment'

const session = (duration: number, actualDuration: number | null): FocusSessionSample => ({ duration, actualDuration })

describe('detectAbandonmentPattern', () => {
  it('returns null with fewer than 5 early-stopped sessions', () => {
    const sessions = [session(90, 68), session(90, 71), session(90, 69), session(90, 70)]
    expect(detectAbandonmentPattern(sessions)).toBeNull()
  })

  it('detects a consistent early-stop pattern clustered around ~70 minutes', () => {
    const sessions = [
      session(90, 68), session(90, 71), session(90, 69), session(90, 73), session(90, 67), session(90, 70),
    ]
    expect(detectAbandonmentPattern(sessions)).toBe(70)
  })

  it('returns null when early stops are scattered with no real cluster', () => {
    const sessions = [
      session(90, 20), session(90, 85), session(90, 45), session(90, 60), session(90, 15), session(90, 88),
    ]
    expect(detectAbandonmentPattern(sessions)).toBeNull()
  })

  it('ignores sessions completed on time or run over (not "abandoned")', () => {
    const sessions = [
      session(90, 90), session(90, 95), session(90, 90), session(90, 90), session(90, 90), session(90, 90),
    ]
    expect(detectAbandonmentPattern(sessions)).toBeNull()
  })

  it('ignores sessions with no recorded actualDuration', () => {
    const sessions = [
      session(90, null), session(90, null), session(90, null), session(90, 70), session(90, 70),
    ]
    expect(detectAbandonmentPattern(sessions)).toBeNull()
  })

  it('detects the pattern even mixed with completed and null sessions', () => {
    const sessions = [
      session(90, 90), session(90, null), session(90, 68), session(90, 71), session(90, 69), session(90, 73), session(90, 67),
    ]
    expect(detectAbandonmentPattern(sessions)).toBe(69)
  })
})
