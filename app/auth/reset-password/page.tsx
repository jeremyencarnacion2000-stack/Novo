'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { FormEvent, Suspense, useState } from 'react'
import { Loader2, ArrowLeft, CheckCircle2 } from 'lucide-react'
import { AuthEditorialPanel } from '@/components/auth/auth-editorial-panel'

function ResetPasswordForm() {
  const searchParams = useSearchParams()
  const token = searchParams?.get('token') || ''
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'sent' | 'reset'>('idle')
  const [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setStatus('loading')
    if (!token) {
      try {
        const response = await fetch('/api/auth/password/forgot', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        })
        if (!response.ok) throw new Error('request_failed')
        setStatus('sent')
      } catch {
        setStatus('idle')
        setError('We could not send the reset link. Try again in a moment.')
      }
      return
    }

    if (password !== confirmation) {
      setStatus('idle')
      setError('Passwords do not match.')
      return
    }
    try {
      const response = await fetch('/api/auth/password/reset', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'reset_failed')
      setStatus('reset')
    } catch (requestError) {
      setStatus('idle')
      setError(requestError instanceof Error && requestError.message !== 'reset_failed' ? requestError.message : 'This reset link is invalid or expired.')
    }
  }

  const isReset = Boolean(token)
  return (
    <div className="min-h-dvh w-full flex bg-background text-foreground overflow-hidden">
      <AuthEditorialPanel mode="signin" />
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 lg:p-16 relative">
        <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/5 to-transparent pointer-events-none" />
        <div className="w-full max-w-sm space-y-8 relative z-10">
          <div className="flex items-center gap-2.5 mb-6 lg:hidden">
            <span className="grid size-9 place-items-center overflow-hidden rounded-full border border-foreground/10 bg-foreground/[0.04]"><Image src="/icon.svg" alt="" width={24} height={24} className="size-6 object-contain" priority /></span>
            <span className="text-[11px] font-bold uppercase tracking-[0.28em] text-foreground/55">Novo</span>
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-black tracking-tight">{status === 'reset' ? 'Password updated' : isReset ? 'Choose a new password' : 'Reset your password'}</h1>
            <p className="text-sm text-foreground/40 leading-relaxed">{status === 'reset' ? 'Your active sessions were closed. Sign in again with your new password.' : isReset ? 'Use at least 12 characters. The link works once.' : 'We will send a secure, single-use link if the account exists.'}</p>
          </div>

          {status === 'sent' ? (
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-5 text-sm leading-relaxed text-foreground/70"><CheckCircle2 className="mb-3 h-5 w-5 text-emerald-400" />Check your inbox for the reset link. If you do not see it, check spam and try again later.</div>
          ) : status === 'reset' ? (
            <Link href="/auth/signin" className="flex h-13 items-center justify-center rounded-2xl bg-foreground text-background font-semibold text-sm hover:opacity-90 transition-opacity">Back to sign in</Link>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              {!isReset ? (
                <label className="block space-y-1.5"><span className="text-xs font-medium text-foreground/40 tracking-wide uppercase">Email</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" placeholder="you@example.com" className="w-full h-13 px-4 py-3.5 bg-foreground/5 border border-foreground/10 backdrop-blur-md rounded-xl text-sm text-foreground placeholder:text-foreground/20 focus:outline-none focus:border-emerald-500/50 transition-all" /></label>
              ) : (
                <>
                  <label className="block space-y-1.5"><span className="text-xs font-medium text-foreground/40 tracking-wide uppercase">New password</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={12} autoComplete="new-password" className="w-full h-13 px-4 py-3.5 bg-foreground/5 border border-foreground/10 backdrop-blur-md rounded-xl text-sm text-foreground focus:outline-none focus:border-emerald-500/50 transition-all" /></label>
                  <label className="block space-y-1.5"><span className="text-xs font-medium text-foreground/40 tracking-wide uppercase">Confirm password</span><input type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required minLength={12} autoComplete="new-password" className="w-full h-13 px-4 py-3.5 bg-foreground/5 border border-foreground/10 backdrop-blur-md rounded-xl text-sm text-foreground focus:outline-none focus:border-emerald-500/50 transition-all" /></label>
                </>
              )}
              {error && <div role="alert" className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium">{error}</div>}
              <button type="submit" disabled={status === 'loading'} className="w-full h-13 rounded-2xl bg-foreground text-background font-semibold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50">{status === 'loading' && <Loader2 className="h-4 w-4 animate-spin" />}{isReset ? 'Update password' : 'Send reset link'}</button>
            </form>
          )}
          <Link href="/auth/signin" className="inline-flex items-center gap-2 text-xs text-foreground/45 hover:text-foreground/75 transition-colors"><ArrowLeft className="h-3.5 w-3.5" /> Back to sign in</Link>
        </div>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return <Suspense fallback={<div className="min-h-dvh bg-background" />}><ResetPasswordForm /></Suspense>
}
