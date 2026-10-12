jest.mock('@/lib/google', () => ({
  calendarService: { createEvent: jest.fn(), listEvents: jest.fn() },
  gmailService: { sendEmail: jest.fn(), listUnread: jest.fn() },
  getGoogleAccessToken: jest.fn().mockResolvedValue(null),
}))

import { toSafeActionErrorCode } from '../executor'

describe('toSafeActionErrorCode', () => {
  it('collapses provider and database diagnostics to a stable code', () => {
    expect(toSafeActionErrorCode('PrismaClientKnownRequestError: token=secret connection refused')).toBe('ACTION_FAILED')
    expect(toSafeActionErrorCode(new Error('upstream OAuth response included a private token'))).toBe('ACTION_FAILED')
  })

  it('preserves the stable product codes used by the UI', () => {
    expect(toSafeActionErrorCode('Free plan monthly AI action limit reached')).toBe('Free plan monthly AI action limit reached')
    expect(toSafeActionErrorCode('Gmail not connected')).toBe('Gmail not connected')
  })

  it('maps known validation failures without returning payload details', () => {
    expect(toSafeActionErrorCode('Invalid action: "SEND_EMAIL". Valid actions are: CREATE_TASK')).toBe('Invalid action')
    expect(toSafeActionErrorCode('Database verification failed: Tarea con ID "private-id" no encontrado.')).toBe('Resource not found')
    expect(toSafeActionErrorCode('Recipient, subject, and body are required to send an email')).toBe('Invalid email payload')
  })
})
