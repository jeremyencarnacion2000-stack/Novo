import React from 'react'
import { act, fireEvent, render, waitFor } from '@testing-library/react'
import { VoiceCommandHub } from './VoiceCommandHub'
import { whisperAPI } from '@/lib/whisper'
import { executeVoiceCommand } from '@/lib/voice-executor'

jest.mock('@/lib/cognitive-context', () => ({ useCognitiveEngine: () => ({ bioState: { phase: 'LINEAR_EXECUTION', attentionScore: 80 } }) }))
jest.mock('@/lib/whisper', () => ({ whisperAPI: { transcribeAudio: jest.fn() } }))
jest.mock('@/lib/voice-executor', () => ({ executeVoiceCommand: jest.fn() }))
jest.mock('@/lib/events/event-bus', () => ({ eventBus: { dispatch: jest.fn() } }))
jest.mock('@/lib/sileo-bell', () => ({ sileo: { success: jest.fn(), warning: jest.fn(), error: jest.fn() } }))

let recorders: Recorder[] = []
class Recorder {
  state = 'inactive'
  onstop: (() => void) | null = null
  ondataavailable: ((event: { data: Blob }) => void) | null = null
  constructor() { recorders.push(this) }
  start() { this.state = 'recording' }
  stop() {
    this.state = 'inactive'
    this.ondataavailable?.({ data: new Blob(['a'.repeat(2000)]) })
    this.onstop?.()
  }
}

describe('voice panel cancellation', () => {
  const stopTrack = jest.fn()
  const stream = { getTracks: () => [{ stop: stopTrack }] }
  const getUserMedia = jest.fn()
  beforeEach(() => {
    jest.clearAllMocks()
    recorders = []
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } })
    Object.defineProperty(globalThis, 'MediaRecorder', { configurable: true, value: Recorder })
    getUserMedia.mockResolvedValue(stream)
  })
  const toggle = () => act(() => window.dispatchEvent(new Event('toggle-gemini-live')))

  it('stops tracks on unmount and never transcribes a cancelled recording', async () => {
    const view = render(<VoiceCommandHub headless />)
    toggle()
    await waitFor(() => expect(recorders).toHaveLength(1))
    view.unmount()
    expect(stopTrack).toHaveBeenCalled()
    expect(recorders[0].state).toBe('inactive')
    expect(whisperAPI.transcribeAudio).not.toHaveBeenCalled()
    expect(executeVoiceCommand).not.toHaveBeenCalled()
  })

  it('stops a late microphone permission result after its panel has closed', async () => {
    let grant!: (value: typeof stream) => void
    getUserMedia.mockReturnValue(new Promise(resolve => { grant = resolve }))
    render(<VoiceCommandHub headless />)
    toggle()
    act(() => window.dispatchEvent(new Event('novo:voice-cancel')))
    await act(async () => grant(stream))
    expect(stopTrack).toHaveBeenCalled()
    expect(recorders).toHaveLength(0)
    expect(executeVoiceCommand).not.toHaveBeenCalled()
  })

  it('cancels a pending permission when the global Space gesture is released', async () => {
    let grant!: (value: typeof stream) => void
    getUserMedia.mockReturnValue(new Promise(resolve => { grant = resolve }))
    render(<VoiceCommandHub headless />)
    fireEvent.keyDown(document.body, { code: 'Space', key: ' ' })
    fireEvent.keyUp(document.body, { code: 'Space', key: ' ' })
    await act(async () => grant(stream))
    expect(stopTrack).toHaveBeenCalled()
    expect(recorders).toHaveLength(0)
  })

  it('ignores a transcription that resolves after closing instead of executing it', async () => {
    let transcribe!: (value: string) => void
    ;(whisperAPI.transcribeAudio as jest.Mock).mockReturnValue(new Promise(resolve => { transcribe = resolve }))
    const view = render(<VoiceCommandHub headless />)
    toggle()
    await waitFor(() => expect(recorders).toHaveLength(1))
    toggle()
    await waitFor(() => expect(whisperAPI.transcribeAudio).toHaveBeenCalled())
    view.unmount()
    await act(async () => transcribe('crea una tarea'))
    expect(executeVoiceCommand).not.toHaveBeenCalled()
  })
})
