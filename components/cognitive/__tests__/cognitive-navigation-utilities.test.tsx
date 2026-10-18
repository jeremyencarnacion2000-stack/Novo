import React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { CognitiveNavigationUtilities } from '../cognitive-navigation-utilities'
import { MobileOverlayProvider, useMobileOverlay } from '@/components/mobile-overlay-provider'

let mockSettingsOpen = false
jest.mock('@/lib/settings-context', () => ({ useSettings: () => ({ isSettingsOpen: mockSettingsOpen }) }))
jest.mock('next/dynamic', () => (loader: () => unknown) => {
  const path = loader.toString()
  return function LazySurface() {
    return path.includes('command-palette') ? <div>Buscar en Novo</div>
      : path.includes('cognitive-settings-modal') ? <div>Ajustes actuales</div> : <div>Grabador de voz</div>
  }
})

function Controls() {
  const overlay = useMobileOverlay()
  return <><button onClick={() => overlay.openOverlay('voice')}>Abrir voz</button><output>{overlay.activeOverlay}</output></>
}
function Fixture() { return <MobileOverlayProvider><Controls /><CognitiveNavigationUtilities /></MobileOverlayProvider> }

describe('Cognitive navigation utilities', () => {
  beforeEach(() => { mockSettingsOpen = false; document.documentElement.dataset.animations = 'false' })
  afterEach(() => { delete document.documentElement.dataset.animations })
  it('loads search from the existing navigation event', async () => {
    render(<Fixture />)
    expect(screen.queryByText('Buscar en Novo')).not.toBeInTheDocument()
    act(() => window.dispatchEvent(new Event('open-command-palette')))
    expect(await screen.findByText('Buscar en Novo')).toBeInTheDocument()
  })
  it('loads the current settings and keeps their modal available through closing', async () => {
    const view = render(<Fixture />)
    expect(screen.queryByText('Ajustes actuales')).not.toBeInTheDocument()
    mockSettingsOpen = true
    view.rerender(<Fixture />)
    expect(await screen.findByText('Ajustes actuales')).toBeInTheDocument()
    mockSettingsOpen = false
    view.rerender(<Fixture />)
    expect(screen.getByText('Ajustes actuales')).toBeInTheDocument()
  })
  it('gives voice a real dialog and releases the navigation when closed', async () => {
    render(<Fixture />)
    fireEvent.click(screen.getByRole('button', { name: 'Abrir voz' }))
    expect(await screen.findByText('Grabador de voz')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByRole('status')).toHaveTextContent('none')
  })
})
