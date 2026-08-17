'use client'

import { useState, useEffect } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Loader2, Eye, EyeOff, ChevronsRight } from 'lucide-react'
import { motion, useMotionValue, useTransform } from 'framer-motion'
import { InfinityOrbit } from '@/components/auth/infinity-orbit'
import { reloadAuthenticatedApp } from '@/lib/auth-navigation'

// Only follow a same-origin relative path (never a protocol-relative "//host"
// or absolute URL) — this is read from a query param an attacker could craft,
// so treat it as untrusted input, not a place to allow open redirects.
function getSafeCallbackUrl(): string {
  if (typeof window === 'undefined') return '/'
  const raw = new URLSearchParams(window.location.search).get('callbackUrl')
  if (raw && raw.startsWith('/') && !raw.startsWith('//')) return raw
  return '/'
}

export default function SignInPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  // NextAuth sends provider failures back to this screen as a query parameter.
  // Surface a useful, non-sensitive explanation instead of silently looping.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const providerError = new URLSearchParams(window.location.search).get('error')
    if (!providerError) return

    const messages: Record<string, string> = {
      OAuthCallback: 'The provider could not complete the sign-in callback. Check the connection settings and try again.',
      OAuthSignin: 'The provider sign-in could not be started. Check the connection settings and try again.',
      google: 'Google sign-in could not be completed. Check the Google callback URL and try again.',
      spotify: 'Spotify sign-in could not be completed. Check the Spotify callback URL and try again.',
      AccessDenied: 'Access was denied. You can try again or use your email and password.',
    }

    setError(messages[providerError] ?? 'Sign-in could not be completed. Please try again.')
  }, [])

  const handleCredentialsLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false
      })

      if (result?.error) {
        setError('Invalid email or password')
      } else if (result?.ok) {
        reloadAuthenticatedApp(getSafeCallbackUrl())
      } else {
        setError('Unexpected error occurred')
      }
    } catch (error) {
      setError('Connection error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    setError('')
    setGoogleLoading(true)
    try {
      await signIn('google', {
        callbackUrl: getSafeCallbackUrl(),
        redirect: true
      })
    } catch (error) {
      setError('Error signing in with Google')
      setGoogleLoading(false)
    }
  }

  return (
    <div className="min-h-dvh w-full flex bg-background text-foreground overflow-hidden">
      {/* Left — decorative panel, own fixed-dark surface (Kreative-style) */}
      <div className="hidden lg:flex w-1/2 relative flex-col justify-between p-10 overflow-hidden bg-[#0a0a0d]">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/30 via-teal-400/10 to-black" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,_rgba(74,222,128,0.30),_transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_80%,_rgba(45,212,191,0.22),_transparent_50%)]" />

        {/* Floating browser-chrome pill */}
        <div className="relative z-10 flex justify-center">
          <div className="flex items-center gap-2 rounded-full bg-white/10 border border-white/10 backdrop-blur-xl px-4 py-2 shadow-lg">
            <span className="h-2 w-2 rounded-full bg-red-400/80" />
            <span className="h-2 w-2 rounded-full bg-yellow-400/80" />
            <span className="h-2 w-2 rounded-full bg-green-400/80" />
            <span className="ml-2 text-[11px] font-medium text-white/50 tracking-wide">productivitynovo.app</span>
          </div>
        </div>

        {/* Center content */}
        <div className="relative z-10 flex flex-col items-center text-center gap-10 my-auto">
          <h1 className="font-serif text-3xl md:text-4xl tracking-tight text-white/90 leading-tight italic max-w-sm">
            Information isn&apos;t the problem.
          </h1>

          <InfinityOrbit />

          <p className="text-sm text-white/40 leading-relaxed max-w-xs -mt-4">
            Novo turns the noise into one clear answer: what to do right now.
          </p>
        </div>

        <p className="relative z-10 text-center text-[11px] text-white/25 font-medium tracking-wide">
          © {new Date().getFullYear()} Novo — All rights reserved
        </p>
      </div>

      {/* Right — form panel, theme-adaptive */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 lg:p-16 relative">
        <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/5 to-transparent pointer-events-none" />
        <div className="w-full max-w-sm space-y-8 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5 mb-6 lg:hidden">
              <div className="h-9 w-9 rounded-full bg-foreground flex items-center justify-center">
                <div className="h-3.5 w-3.5 bg-background rounded-full" />
              </div>
              <span className="text-sm font-bold tracking-tight text-foreground/40">NOVO</span>
            </div>
            <h2 className="text-3xl font-black tracking-tight">Welcome back</h2>
            <p className="text-sm text-foreground/40 leading-relaxed">Sign in to continue to your workspace.</p>
          </div>

          <button
            onClick={handleGoogleLogin}
            disabled={loading || googleLoading}
            className="w-full h-13 rounded-2xl bg-foreground text-background font-semibold text-sm flex items-center justify-center gap-3 active:scale-[0.98] transition-all disabled:opacity-50 shadow-lg hover:opacity-90"
          >
            {googleLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
            )}
            Continue with Google & YT Music
          </button>

          <div className="flex items-center gap-4">
            <div className="flex-1 h-px bg-foreground/10" />
            <span className="text-[11px] font-medium tracking-widest uppercase text-foreground/20">or</span>
            <div className="flex-1 h-px bg-foreground/10" />
          </div>

          <form onSubmit={handleCredentialsLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-xs font-medium text-foreground/40 tracking-wide uppercase">Email</label>
              <input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-13 px-4 py-3.5 bg-foreground/5 border border-foreground/10 backdrop-blur-md rounded-xl text-sm text-foreground placeholder:text-foreground/20 focus:outline-none focus:border-emerald-500/50 focus:bg-foreground/[0.07] transition-all"
                required
                disabled={loading || googleLoading}
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="text-xs font-medium text-foreground/40 tracking-wide uppercase">Password</label>
                <button type="button" className="text-[11px] text-foreground/30 hover:text-foreground/50 transition-colors">
                  Forgot?
                </button>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-13 px-4 py-3.5 pr-12 bg-foreground/5 border border-foreground/10 backdrop-blur-md rounded-xl text-sm text-foreground placeholder:text-foreground/20 focus:outline-none focus:border-emerald-500/50 focus:bg-foreground/[0.07] transition-all"
                  required
                  disabled={loading || googleLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-foreground/20 hover:text-foreground/40 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium">
                {error}
              </div>
            )}

            <SlideToSignIn
              isLoading={loading}
              enabled={email.length > 0 && password.length > 0}
              onSwipeComplete={() => handleCredentialsLogin()}
            />
          </form>

          <p className="text-center text-xs text-foreground/25">
            Don&apos;t have an account?{' '}
            <button onClick={() => router.push('/auth/signup')} className="text-foreground/60 font-medium hover:text-foreground transition-colors">
              Create one
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}

interface SlideToSignInProps {
  isLoading: boolean
  enabled: boolean
  onSwipeComplete: () => void
}

function SlideToSignIn({ isLoading, enabled, onSwipeComplete }: SlideToSignInProps) {
  const [trackWidth, setTrackWidth] = useState(0)
  const [thumbWidth, setThumbWidth] = useState(0)
  const x = useMotionValue(0)

  // Calculate max drag offset dynamically
  const maxDrag = Math.max(0, trackWidth - thumbWidth - 12) // 6px padding on left & right

  // Fade out track label text based on drag progress
  const opacity = useTransform(x, [0, maxDrag * 0.75], [1, 0])

  // Reset handle position when loading state finishes
  useEffect(() => {
    if (!isLoading) {
      x.set(0)
    }
  }, [isLoading, x])

  const handleDragEnd = async (event: any, info: any) => {
    if (!enabled || isLoading) return

    // If dragged past 80% threshold, trigger action and lock handle at the end
    if (x.get() >= maxDrag * 0.8 || info.offset.x >= maxDrag * 0.8) {
      x.set(maxDrag)
      onSwipeComplete()
    } else {
      // Bounce back to start
      x.set(0)
    }
  }

  // Keyboard equivalent for the drag gesture — a pointer-only "slide to sign
  // in" control has no way to submit for keyboard/screen-reader users. Enter
  // or Space acts exactly like a completed drag; no visual change for
  // pointer users.
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (!enabled || isLoading) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      x.set(maxDrag)
      onSwipeComplete()
    }
  }

  return (
    <div
      ref={(node) => {
        if (node) setTrackWidth(node.getBoundingClientRect().width)
      }}
      className={`relative w-full h-[52px] rounded-xl bg-foreground/5 border border-foreground/10 flex items-center p-1.5 overflow-hidden transition-all duration-300 ${
        !enabled ? 'opacity-40 pointer-events-none' : ''
      }`}
    >
      {/* Dynamic Background Pulse when enabled */}
      {enabled && !isLoading && (
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 pointer-events-none animate-pulse-slow" />
      )}

      {/* Track Label Text */}
      <motion.div
        style={{ opacity }}
        className="absolute inset-0 flex items-center justify-center pointer-events-none z-0"
      >
        <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-foreground/30 select-none">
          {isLoading ? "AUTHENTICATING SYSTEM..." : "SLIDE TO SIGN IN"}
        </span>
      </motion.div>

      {/* Draggable Thumb — also a keyboard-operable button (Tab + Enter/Space) */}
      <motion.div
        ref={(node) => {
          if (node) setThumbWidth(node.getBoundingClientRect().width)
        }}
        role="button"
        tabIndex={enabled && !isLoading ? 0 : -1}
        aria-label="Sign in"
        aria-disabled={!enabled || isLoading}
        onKeyDown={handleKeyDown}
        drag={enabled && !isLoading ? "x" : false}
        dragConstraints={{ left: 0, right: maxDrag }}
        dragElastic={0.05}
        dragMomentum={false}
        onDragEnd={handleDragEnd}
        style={{ x }}
        className={`h-10 w-10 rounded-lg bg-foreground text-background flex items-center justify-center cursor-grab active:cursor-grabbing shadow-lg transition-colors select-none z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
          isLoading ? 'cursor-default' : ''
        }`}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ChevronsRight className="h-4 w-4" />
        )}
      </motion.div>
    </div>
  )
}
