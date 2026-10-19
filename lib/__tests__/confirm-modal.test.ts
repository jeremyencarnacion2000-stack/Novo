import { cancelNovoConfirmations, confirmNovo, finishNovoConfirmation, getNovoConfirmation, subscribeNovoConfirmations } from '@/lib/confirm-modal'

afterEach(cancelNovoConfirmations)
it('denies without a mounted confirmation UI', async () => { expect(await confirmNovo('Delete?')).toBe(false) })
it('waits for explicit approval and queues separate intents', async () => {
  const stop = subscribeNovoConfirmations(() => undefined)
  let resolved = false
  const first = confirmNovo('First').then((value) => { resolved = true; return value })
  const second = confirmNovo('Second')
  await Promise.resolve()
  expect(resolved).toBe(false)
  const id = getNovoConfirmation()!.id
  finishNovoConfirmation(id + 100, true)
  expect(getNovoConfirmation()!.message).toBe('First')
  finishNovoConfirmation(id, true)
  expect(await first).toBe(true)
  expect(getNovoConfirmation()!.message).toBe('Second')
  stop()
  expect(await second).toBe(false)
})
