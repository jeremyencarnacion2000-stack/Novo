import { render, screen } from '@testing-library/react'
import { CommandPalette } from '../command-palette'

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}))
jest.mock('@/lib/settings-context', () => ({
  useSettings: () => ({ settings: { showAnimations: true } }),
}))

beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as typeof ResizeObserver
  Element.prototype.scrollIntoView = jest.fn()
})

it('opens when the first shortcut arrived before its module mounted', () => {
  render(<CommandPalette initialOpen />)
  expect(screen.getByRole('dialog')).toBeVisible()
})
