'use client'

import { useRef } from 'react'

/** Keep the last selected record available while its controlled root returns. */
export function useLastModalValue<T>(value: T | null | undefined): T | null {
  const last = useRef<T | null>(value ?? null)
  if (value != null) last.current = value
  return value ?? last.current
}
