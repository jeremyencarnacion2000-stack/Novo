import { mergeConversationMessages, recoverInterruptedMailReviews } from '../conversation-messages'
import type { Message } from '@/components/ai/modern-chatbot/types'

const card: Message = { id: 'assistant', role: 'assistant', content: 'Borrador preparado', timestamp: '2026-10-19T00:00:00Z', blocks: [{ id: 'review', type: 'confirmation', status: 'executing', content: { type: 'SEND_EMAIL', payload: { to: 'a@b.test', subject: 'Hola', body: 'Hola' } } }] }
describe('shared mail review continuity', () => {
  it('recovers an interrupted delivery review using the same message/card identity', () => {
    const recovered = recoverInterruptedMailReviews([card])[0]
    expect(recovered.id).toBe(card.id)
    expect(recovered.blocks?.[0]).toMatchObject({ id: 'review', status: 'waiting', content: { deliveryRecovery: true } })
    expect(recovered.blocks?.[0].content.payload).toEqual(card.blocks?.[0].content.payload)
  })
  it('keeps server-only Companion cards while preserving completed local review progress', () => {
    const remote: Message = { ...card, id: 'companion-new' }
    const complete: Message = { ...card, blocks: [{ ...card.blocks![0], status: 'confirmed' }] }
    const merged = mergeConversationMessages([card, remote], [complete])
    expect(merged.map(item => item.id)).toEqual(['assistant', 'companion-new'])
    expect(merged[0].blocks?.[0].status).toBe('confirmed')
  })
  it('never resets an already completed delivery after reload', () => {
    const complete: Message = { ...card, blocks: [{ ...card.blocks![0], status: 'confirmed' }] }
    expect(recoverInterruptedMailReviews([complete])[0].blocks?.[0].status).toBe('confirmed')
  })
  it('preserves a recoverable uncertain delivery when a stale executing save collides', () => {
    const recovered = recoverInterruptedMailReviews([card])
    expect(mergeConversationMessages([card], recovered)[0].blocks?.[0]).toMatchObject({ id: 'review', status: 'waiting', content: { deliveryRecovery: true } })
    expect(mergeConversationMessages(recovered, [card])[0].blocks?.[0].status).toBe('waiting')
    const complete: Message = { ...card, blocks: [{ ...card.blocks![0], status: 'confirmed' }] }
    expect(mergeConversationMessages([complete], recovered)[0].blocks?.[0].status).toBe('confirmed')
  })
})
