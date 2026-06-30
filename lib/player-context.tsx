'use client'

/**
 * player-context.tsx
 *
 * NOTE: This file is retained for backward compatibility but is effectively
 * a thin re-export of the Zustand player-store.
 * The actual player state is managed by usePlayerStore (lib/player-store.ts).
 *
 * DO NOT add useContext/conditional hook logic here — use usePlayerStore directly.
 */

export { usePlayerStore as usePlayer } from '@/lib/player-store'