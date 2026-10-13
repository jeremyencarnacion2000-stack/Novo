import React from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { ContextHub } from '@/components/ContextHub'
import { FocusProvider } from '@/lib/focus-context'
import { usePlayerStore } from '@/lib/player-store'

jest.mock('next-auth/react', () => ({ useSession: () => ({ data: { user: { id: 'hub-test' } }, status: 'authenticated' }) }))
jest.mock('@/lib/settings-context', () => ({ useSettings: () => ({ settings: { theme: 'light', backgroundDimness: 0, showAnimations: true }, updateSettings: jest.fn() }) }))
jest.mock('@/lib/scroll-container-context', () => ({ useScrollContainer: () => ({ scrollContainer: null }) }))
jest.mock('@/lib/cognitive-context', () => ({ useCognitiveState: () => ({ bioState: { phase: 'PEAK_FOCUS', attentionScore: 80 } }), useCognitiveDispatch: () => ({ logHabit: jest.fn() }) }))
jest.mock('@/lib/quick-capture-context', () => ({ useQuickCapture: () => ({ onOpen: jest.fn() }) }))
jest.mock('@/components/ui/GlassSurface', () => ({
  GlassSurface: ({ children, style, ...props }: any) => <div style={style} data-hub-glass={props['data-hub-glass']}>{children}</div>,
}))
jest.mock('@/hooks/use-shared-surface-morph', () => {
  const React = require('react')
  const shapes = { idle: { width: 12, height: 72 }, capsule: { width: 46, height: 190 }, expanded: { width: 360, height: 420 }, notification: { width: 352, height: 118 } }
  return {
    SHARED_SURFACE_SHAPES: shapes,
    useSharedSurfaceMorph: ({ surfaceRef, state, enabled }: any) => {
      const shape = shapes[state as keyof typeof shapes]
      React.useLayoutEffect(() => {
        if (enabled && surfaceRef.current) surfaceRef.current.style.clipPath = `inset(0px 0px ${420 - shape.height}px ${360 - shape.width}px round 23px)`
      }, [state, enabled, surfaceRef])
      return { stageSize: { width: 360, height: 420 }, surfaceRadius: 28, shape, contentStyle: shape }
    },
  }
})

describe('ContextHub detached Pomodoro lifecycle', () => {
  let now: number
  let nextFrame: number
  let frames: Map<number, FrameRequestCallback>
  const advance = (duration: number) => act(() => {
    for (let elapsed = 0; elapsed < duration; elapsed += 16) {
      now += 16
      const callbacks = [...frames.values()]
      frames.clear()
      callbacks.forEach(callback => callback(now))
      jest.advanceTimersByTime(16)
    }
  })

  beforeEach(() => {
    jest.useFakeTimers()
    localStorage.clear()
    now = 0; nextFrame = 0; frames = new Map()
    jest.spyOn(performance, 'now').mockImplementation(() => now)
    jest.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => { frames.set(++nextFrame, callback); return nextFrame })
    jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(id => { frames.delete(id) })
    jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.matches('main h1')) {
        return { left: 24, top: 140, right: 351, bottom: 340, width: 327, height: 200, x: 24, y: 140, toJSON: () => ({}) }
      }
      const source = this.hasAttribute('data-pomodoro-source')
      const left = source ? 1060 : 1024, top = source ? 246 : 80
      const width = source ? 300 : 360, height = source ? 122 : 420
      return { left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) }
    })
    global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({}) })) as unknown as typeof fetch
  })
  afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers() })

  it('starts and pauses focus directly from the compact Hub capsule', () => {
    const { container } = render(<FocusProvider><ContextHub /></FocusProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'Abrir Hub' }))
    fireEvent.click(screen.getByRole('button', { name: 'Contraer Hub' }))

    const hub = container.querySelector<HTMLElement>('[data-hub-state]')!
    expect(hub.dataset.hubState).toBe('capsule')
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar temporizador' }))

    expect(hub.dataset.hubState).toBe('capsule')
    expect(screen.getByRole('button', { name: 'Pausar temporizador' })).toHaveAttribute('aria-pressed', 'true')
    expect(container.querySelector<HTMLElement>('[data-pomodoro-surface]')).toHaveAttribute('aria-hidden', 'true')

    fireEvent.click(screen.getByRole('button', { name: 'Pausar temporizador' }))
    expect(screen.getByRole('button', { name: 'Iniciar temporizador' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('moves keyboard focus into the Hub and restores it after the Pomodoro returns as a liquid drop', () => {
    render(<FocusProvider><ContextHub /></FocusProvider>)
    const trigger = screen.getByRole('button', { name: 'Abrir Hub' })
    trigger.focus()
    fireEvent.click(trigger)
    advance(32)

    expect(screen.getByRole('tab', { name: 'Pestaña Foco' })).toHaveFocus()

    const start = screen.getByRole('button', { name: 'Iniciar' })
    start.focus()
    fireEvent.click(start)
    advance(1600)
    expect(screen.getByRole('button', { name: 'Pausar temporizador' })).toHaveFocus()

    fireEvent.keyDown(document, { key: 'Escape' })
    advance(1600)
    expect(screen.getByRole('button', { name: 'Abrir' })).toHaveFocus()
  })

  it('keeps Hub disclosure state and tab controls connected to mounted panels', () => {
    const { container } = render(<FocusProvider><ContextHub /></FocusProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'Abrir Hub' }))

    expect(screen.getByRole('button', { name: 'Contraer Hub' })).toHaveAttribute('aria-expanded', 'true')
    const danglingControls = [...container.querySelectorAll<HTMLElement>('[aria-controls]')]
      .filter(element => !container.querySelector(`#${element.getAttribute('aria-controls')}`))
    expect(danglingControls).toHaveLength(0)
  })

  it('exposes the current attention score as a bounded accessible progress value', () => {
    render(<FocusProvider><ContextHub /></FocusProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'Abrir Hub' }))

    const progress = screen.getByRole('progressbar', { name: 'Nivel de atención' })
    const value = Number(progress.getAttribute('aria-valuenow'))
    expect(value).toBeGreaterThanOrEqual(0)
    expect(value).toBeLessThanOrEqual(100)
  })

  it('places the detached Pomodoro below the primary heading on narrow screens', () => {
    const previousWidth = Object.getOwnPropertyDescriptor(window, 'innerWidth')
    const previousHeight = Object.getOwnPropertyDescriptor(window, 'innerHeight')
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 375 })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 780 })
    const main = document.createElement('main')
    main.innerHTML = '<h1>Dashboard heading</h1>'
    document.body.append(main)

    try {
      const { container } = render(<FocusProvider><ContextHub /></FocusProvider>)
      fireEvent.click(screen.getByRole('button', { name: 'Abrir Hub' }))
      advance(800)
      fireEvent.click(screen.getByRole('button', { name: 'Iniciar' }))

      const widget = container.querySelector<HTMLElement>('[data-pomodoro-surface]')!
      expect(Number.parseFloat(widget.style.top)).toBeGreaterThanOrEqual(352)
    } finally {
      main.remove()
      if (previousWidth) Object.defineProperty(window, 'innerWidth', previousWidth)
      if (previousHeight) Object.defineProperty(window, 'innerHeight', previousHeight)
    }
  })

  it('bounds the filtered liquid layer to the moving Hub and widget surfaces', () => {
    const { container } = render(<FocusProvider><ContextHub /></FocusProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'Abrir Hub' }))
    advance(800)
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar' }))

    const liquidLayer = container.querySelector<HTMLElement>('.pomodoro-liquid-geometry')!
    const renderedWidth = Number.parseFloat(liquidLayer.style.width)
    expect(renderedWidth).toBeGreaterThan(0)
    expect(renderedWidth).toBeLessThan(window.innerWidth)
  })

  it('does not force a Hub layout read on every liquid spring frame', () => {
    const { container } = render(<FocusProvider><ContextHub /></FocusProvider>)
    const hub = container.querySelector<HTMLElement>('[data-hub-state]')!
    const measureHub = jest.spyOn(hub, 'getBoundingClientRect')
    fireEvent.click(screen.getByRole('button', { name: 'Abrir Hub' }))
    advance(800)
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar' }))
    advance(16)
    const readsAfterInitialFrame = measureHub.mock.calls.length

    advance(112)

    expect(measureHub).toHaveBeenCalledTimes(readsAfterInitialFrame)
  })

  it('opens on the first attempt, returns without pausing, survives scroll, and can repeat', async () => {
    const { container } = render(<FocusProvider><ContextHub /></FocusProvider>)
    const hub = () => container.querySelector<HTMLElement>('[data-hub-state]')!
    const widget = () => container.querySelector<HTMLElement>('[data-pomodoro-surface]')!
    for (let cycle = 0; cycle < 3; cycle++) {
      fireEvent.click(screen.getByRole('button', { name: 'Abrir Hub' }))
      advance(800)
      fireEvent.click(screen.getByRole('button', { name: cycle ? 'Abrir' : 'Iniciar' }))
      const liquidLayer = container.querySelector<HTMLElement>('.pomodoro-liquid-geometry')!
      expect(liquidLayer.style.visibility).toBe('visible')
      expect(liquidLayer.querySelectorAll('.pomodoro-liquid-blob')).toHaveLength(3)
      advance(1600)
      expect(hub().dataset.hubState).toBe('capsule')
      expect(widget()).toHaveAttribute('aria-hidden', 'false')
      expect(screen.getByRole('button', { name: 'Pausar temporizador' })).toBeInTheDocument()
      expect(container.querySelector<HTMLElement>('.pomodoro-liquid-geometry')!.style.visibility).toBe('hidden')
      fireEvent.mouseEnter(screen.getByRole('button', { name: 'Volver al Hub' }))
      advance(600)
      expect(hub().dataset.hubState).toBe('capsule')
      fireEvent.keyDown(document, { key: 'Escape' })
      expect(liquidLayer.style.visibility).toBe('visible')
      advance(1600)
      expect(hub().dataset.hubState).toBe('expanded')
      expect(widget()).toHaveAttribute('aria-hidden', 'true')
      expect(screen.getByRole('button', { name: 'Abrir' })).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'Contraer Hub' }))
      advance(800)
      expect(hub().dataset.hubState).toBe('capsule')
      fireEvent.mouseLeave(screen.getByRole('button', { name: 'Abrir Hub' }))
      const clip = hub().style.clipPath
      fireEvent.scroll(window)
      expect(hub().style.clipPath).toBe(clip)
    }
    fireEvent.click(screen.getByRole('button', { name: 'Abrir Hub' }))
    fireEvent.click(screen.getByRole('button', { name: 'Abrir' }))
    advance(80)
    await act(async () => window.dispatchEvent(new CustomEvent('cognitive:play-music')))
    advance(1600)
    expect(hub().dataset.hubState).toBe('expanded')
    expect(widget()).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getByRole('tab', { name: 'Pestaña Audio' })).toHaveAttribute('aria-selected', 'true')
  }, 15000)

  it('preserves a failed task draft and retries the same server intent after collapsing', async () => {
    let fail = true
    const capture = jest.fn(async (url: string) => ({ ok: url !== '/api/tasks' || !fail, json: async () => url === '/api/tasks' ? { id: 'persisted-task' } : {} }))
    global.fetch = capture as unknown as typeof fetch
    render(<FocusProvider><ContextHub /></FocusProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'Abrir Hub' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Nueva tarea' }), { target: { value: 'Mi tarea guardada' } })
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Guardar captura rápida' })))
    expect(screen.getByRole('textbox', { name: 'Nueva tarea' })).toHaveValue('Mi tarea guardada')
    fireEvent.click(screen.getByRole('button', { name: 'Contraer Hub' }))
    fireEvent.click(screen.getByRole('button', { name: 'Abrir Hub' }))
    fail = false
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Guardar captura rápida' })))
    const posts = (capture.mock.calls as unknown as [string, RequestInit][]).filter(([url]) => url === '/api/tasks')
    expect(posts).toHaveLength(2)
    expect(posts[0][1].headers).toEqual(posts[1][1].headers)
    expect(screen.getByRole('combobox', { name: 'Tarea de foco' })).toHaveValue('persisted-task')
    expect(screen.getByRole('textbox', { name: 'Nueva tarea' })).toHaveValue('')
  })

  it('uses the account API fields and plays a list through the existing player', async () => {
    const track = { id: 'video-1', name: 'Canción', artist: 'Artista', image: '' }
    const playPlaylist = jest.fn()
    usePlayerStore.setState({ playPlaylist, currentTrack: null })
    global.fetch = jest.fn(async (url: string) => ({ ok: true, json: async () => url === '/api/youtube/account' ? { playlists: [{ id: 'list-1', name: 'Mi lista', trackCount: 1 }], likedTracks: [track] } : url.startsWith('/api/youtube/playlists/') ? { tracks: [track] } : {} })) as unknown as typeof fetch
    render(<FocusProvider><ContextHub /></FocusProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'Abrir Hub' }))
    await act(async () => fireEvent.click(screen.getByRole('tab', { name: 'Pestaña Audio' })))
    advance(500)
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Reproducir lista Mi lista' })))
    expect(playPlaylist).toHaveBeenCalledWith({ id: 'list-1', name: 'Mi lista', tracks: [{ ...track, uri: 'video-1' }] })
  })
})
