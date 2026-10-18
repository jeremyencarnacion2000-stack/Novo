'use client'

import { readModalOrigin } from '@/lib/modal-origin'
type Confirmation = { id: number; message: string; origin: ReturnType<typeof readModalOrigin>; resolve: (approved: boolean) => void }
const queue: Confirmation[] = []
const listeners = new Set<() => void>()
let serial = 0
const notify = () => listeners.forEach((listener) => listener())
export const getNovoConfirmation = () => queue[0] ?? null
export function cancelNovoConfirmations() { queue.splice(0).forEach((request) => request.resolve(false)); notify() }
export function subscribeNovoConfirmations(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener); if (!listeners.size) cancelNovoConfirmations() }
}
export function confirmNovo(message: string): Promise<boolean> {
  if (!listeners.size) return Promise.resolve(false)
  return new Promise((resolve) => { queue.push({ id: ++serial, message, origin: readModalOrigin(), resolve }); notify() })
}
export function finishNovoConfirmation(id: number, approved: boolean) {
  if (queue[0]?.id !== id) return
  queue.shift()!.resolve(approved); notify()
}
