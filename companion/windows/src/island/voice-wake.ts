import { Bridge } from '../core/bridge'
import { Sound } from '../core/sound'
import { State } from '../core/state'

export const NOVO_WAKE_EVENT = 'novo-start-wake-dictation'

export function registerVoiceWake(openChat: () => void) {
  let pending: string | null = null
  let retry: ReturnType<typeof setTimeout> | undefined
  let stopped = false

  const enabled = () => !stopped && State.settings.voiceWakeEnabled
    && State.settings.voiceInputMode === 'local' && State.settings.chatProvider !== 'codex'
    && !State.paused && State.mode !== 'expanded' && !State.pendingApproval
  function sync() {
    if (!enabled()) {
      clearTimeout(retry)
      retry = undefined
      if (pending) void Bridge.voiceWakeCancel(pending).catch(() => {})
      return
    }
    if (pending || retry) return
    const id = crypto.randomUUID()
    pending = id
    void Bridge.voiceWakeWait(id).then(detected => {
      if (!detected || !enabled() || pending !== id) return
      openChat()
      Sound.play('blip')
      setTimeout(() => {
        if (!stopped && !State.paused && State.mode === 'expanded' && State.view === 'prompt'
          && State.settings.voiceWakeEnabled && State.settings.voiceInputMode === 'local') {
          window.dispatchEvent(new Event(NOVO_WAKE_EVENT))
        }
      }, 300)
    }).catch(() => {
      if (enabled()) retry = setTimeout(() => { retry = undefined; sync() }, 8_000)
    }).finally(() => {
      if (pending === id) pending = null
      if (enabled() && !retry) retry = setTimeout(() => { retry = undefined; sync() }, 250)
    })
  }
  const unsubscribe = State.subscribe(sync)
  window.addEventListener('beforeunload', () => { stopped = true; unsubscribe(); sync() }, { once: true })
  sync()
}
