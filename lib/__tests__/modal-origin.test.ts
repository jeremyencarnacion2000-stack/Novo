import { readModalOrigin, restoreModalOriginFocus, trackModalOrigins } from '@/lib/modal-origin'

afterEach(() => { document.body.innerHTML = '' })
it('captures activation before a portal can move focus and clears unrelated keyboard origins', () => {
  const stop = trackModalOrigins()
  const button = document.createElement('button'); document.body.append(button)
  button.click()
  expect(readModalOrigin().element).toBe(button)
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
  expect(readModalOrigin().element).toBeNull()
  stop()
})
it('restores focus only to a connected interactive source and respects consumer handling', () => {
  const button = document.createElement('button'); document.body.append(button)
  const event = new Event('closeAutoFocus', { cancelable: true })
  restoreModalOriginFocus(event, button)
  expect(event.defaultPrevented).toBe(true)
  expect(document.activeElement).toBe(button)
  const other = document.createElement('button'); document.body.append(other); other.focus()
  const handled = new Event('closeAutoFocus', { cancelable: true }); handled.preventDefault()
  restoreModalOriginFocus(handled, button)
  expect(document.activeElement).toBe(other)
})
