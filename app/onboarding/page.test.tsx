import { render, waitFor } from '@testing-library/react'
import OnboardingPage from './page'

const replace = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace }),
  useSearchParams: () => new URLSearchParams(),
}))
jest.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { id: 'user-1' } }, status: 'authenticated' }),
}))
jest.mock('@/lib/cognitive-twin-context', () => ({
  useCognitiveTwin: () => ({
    twin: { isInitialized: true, onboardingCompletedAt: '2026-07-01T12:00:00.000Z' },
    isLoading: false,
    initializeTwin: jest.fn(),
  }),
}))
jest.mock('@/lib/i18n', () => ({ useTranslation: () => ({ language: 'en' }) }))

describe('Onboarding continuity', () => {
  beforeEach(() => {
    replace.mockClear()
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) }) as jest.Mock
  })

  it('returns an already-onboarded user to Today instead of restarting Day 1', async () => {
    render(<OnboardingPage />)

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/today'))
  })
})
