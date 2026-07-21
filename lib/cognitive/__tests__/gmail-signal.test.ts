import { evaluateGmailThresholds } from '../gmail-signal'

describe('evaluateGmailThresholds', () => {
  it('returns no signal when unread count is under the threshold', () => {
    expect(evaluateGmailThresholds(5)).toEqual([])
    expect(evaluateGmailThresholds(30)).toEqual([])
  })

  it('flags inbox overload above the threshold', () => {
    const signals = evaluateGmailThresholds(47)
    expect(signals).toHaveLength(1)
    expect(signals[0].type).toBe('gmail_inbox_overload')
    expect(signals[0].headline).toContain('47')
    expect(signals[0].severity).toBe('warning')
  })
})
