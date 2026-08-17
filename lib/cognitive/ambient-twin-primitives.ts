import { createHash } from 'node:crypto'

export const asRecord = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
export const fingerprint = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
export const isActiveRecommendation = (status: string) => ['proposed', 'accepted', 'modified', 'started'].includes(status)
