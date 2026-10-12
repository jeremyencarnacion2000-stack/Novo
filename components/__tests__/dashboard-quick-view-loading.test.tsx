import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import DashboardClient from '../dashboard-client'

const mockLoadQuickView = jest.fn()
let mockMobile = false

jest.mock('@/lib/settings-context', () => ({ useSettings: () => ({ settings: {} }) }))
jest.mock('@/lib/i18n', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
jest.mock('@/lib/cognitive-context', () => ({ useCognitivePhase: () => 'LINEAR_EXECUTION' }))
jest.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => mockMobile }))
jest.mock('@/components/dashboard-metrics', () => ({ DashboardMetrics: () => null }))
jest.mock('@/components/quick-actions', () => ({ QuickActions: () => null }))
jest.mock('@/components/dashboard-habits', () => ({ DashboardHabits: () => null }))
jest.mock('@/components/cognitive/cognitive-engine-widget', () => ({ CognitiveEngineWidget: () => null }))
jest.mock('@/components/dashboard/now-hero', () => ({ NowHero: () => <p>Dashboard ready</p> }))
jest.mock('@/components/ui/scroll-reveal', () => ({ ScrollReveal: ({ children }: any) => <>{children}</> }))
jest.mock('@/components/recent-activity', () => ({
  RecentActivity: ({ onActivityClick }: any) => (
    <button onClick={() => onActivityClick('routine', { id: 'routine-1', name: 'Morning' }, null)}>Select activity</button>
  ),
}))
jest.mock('@/components/dashboard/dashboard-quick-view', () => {
  mockLoadQuickView()
  return {
    DashboardQuickView: ({ open, onClose, data }: any) => (
      <div data-testid="quick-view" data-open={String(open)}>
        {data.name}<button onClick={onClose}>Close details</button>
      </div>
    ),
  }
})

describe('dashboard details loading', () => {
  it.each([false, true])('loads details on selection and keeps the mounted panel after closing (mobile=%s)', async mobile => {
    mockMobile = mobile
    render(<DashboardClient />)
    expect(screen.getByText('Dashboard ready')).toBeInTheDocument()
    expect(screen.queryByTestId('quick-view')).not.toBeInTheDocument()
    // Only the first test starts with an unloaded module; subsequent instances
    // reuse the already loaded dynamic component, as navigation does in the app.
    if (!mobile) expect(mockLoadQuickView).not.toHaveBeenCalled()

    fireEvent.click(screen.getByText('Select activity'))
    expect(await screen.findByTestId('quick-view')).toHaveAttribute('data-open', 'true')
    expect(mockLoadQuickView).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByText('Close details'))
    expect(screen.getByTestId('quick-view')).toHaveAttribute('data-open', 'false')
    fireEvent.click(screen.getByText('Select activity'))
    expect(screen.getByTestId('quick-view')).toHaveAttribute('data-open', 'true')
    expect(mockLoadQuickView).toHaveBeenCalledTimes(1)
  })
})
