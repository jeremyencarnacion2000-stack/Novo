'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Keep provider/database diagnostics out of browser logs. The digest is
    // safe to correlate in the platform dashboard without exposing details.
    console.error('[Novo Error Boundary]', error?.digest ? 'with_digest' : 'without_digest')
  }, [error])

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="h-14 w-14 rounded-2xl bg-red-500/10 flex items-center justify-center">
          <span className="text-2xl">!</span>
        </div>
        <h2 className="text-xl font-bold tracking-tight text-foreground">
          Something went wrong
        </h2>
        <p className="text-sm text-muted-foreground max-w-md">
          An unexpected error occurred. Try again or go back to the dashboard.
        </p>
      </div>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          Try again
        </button>
        <a
          href="/"
          className="px-4 py-2 rounded-xl border border-border text-sm font-medium hover:bg-accent transition-colors"
        >
          Go to Dashboard
        </a>
      </div>
    </div>
  )
}
