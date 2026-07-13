'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { Loader2, CheckCircle2, Eye, EyeOff } from 'lucide-react'
import { motion } from 'framer-motion'
import { InfinityOrbit } from '@/components/auth/infinity-orbit'

export default function SignUpPage() {
    const router = useRouter()
    const [firstName, setFirstName] = useState('')
    const [lastName, setLastName] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const [googleLoading, setGoogleLoading] = useState(false)
    const [success, setSuccess] = useState(false)

    const handleSignUp = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        const fullName = `${firstName} ${lastName}`.trim()

        if (password.length < 6) {
            setError('Debe tener al menos 8 caracteres.')
            setLoading(false)
            return
        }

        try {
            const response = await fetch('/api/auth/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: fullName, email, password })
            })

            const data = await response.json()

            if (!response.ok) {
                setError(data.error || 'Error al crear la cuenta')
                setLoading(false)
                return
            }

            setSuccess(true)
            setTimeout(() => {
                router.push('/auth/signin')
            }, 2000)

        } catch (error) {
            setError('Error de conexión. Intenta de nuevo.')
            setLoading(false)
        }
    }

    const handleGoogleSignUp = async () => {
        setError('')
        setGoogleLoading(true)
        try {
            await signIn('google', { callbackUrl: '/onboarding', redirect: true })
        } catch (error) {
            setError('Error al registrarte con Google')
            setGoogleLoading(false)
        }
    }

    if (success) {
        return (
            <div className="min-h-dvh flex items-center justify-center bg-background text-foreground p-4 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 via-transparent to-transparent opacity-50" />
                <div className="absolute inset-0 backdrop-blur-[40px]" />
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center justify-center space-y-4 text-center relative z-10"
                >
                    <CheckCircle2 className="h-16 w-16 text-green-500 animate-bounce-slow" />
                    <h2 className="text-2xl font-bold tracking-tight">¡Cuenta creada!</h2>
                    <p className="text-foreground/40">Redirigiendo al inicio de sesión...</p>
                </motion.div>
            </div>
        )
    }

    return (
        <div className="min-h-dvh w-full flex bg-background text-foreground overflow-hidden">
            {/* Left — decorative panel, own fixed-dark surface (Kreative-style, matches /auth/signin) */}
            <div className="hidden lg:flex w-1/2 relative flex-col justify-between p-10 overflow-hidden bg-[#0a0a0d]">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/40 via-purple-700/20 to-black" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,_rgba(129,140,248,0.35),_transparent_55%)]" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_80%,_rgba(168,85,247,0.25),_transparent_50%)]" />

                <div className="relative z-10 flex justify-center">
                    <div className="flex items-center gap-2 rounded-full bg-white/10 border border-white/10 backdrop-blur-xl px-4 py-2 shadow-lg">
                        <span className="h-2 w-2 rounded-full bg-red-400/80" />
                        <span className="h-2 w-2 rounded-full bg-yellow-400/80" />
                        <span className="h-2 w-2 rounded-full bg-green-400/80" />
                        <span className="ml-2 text-[11px] font-medium text-white/50 tracking-wide">productivitynovo.app</span>
                    </div>
                </div>

                <div className="relative z-10 flex flex-col items-center text-center gap-10 my-auto">
                    <h1 className="font-serif text-3xl md:text-4xl tracking-tight text-white/90 leading-tight italic max-w-sm">
                        Information isn&apos;t the problem.
                    </h1>

                    <InfinityOrbit />

                    <p className="text-sm text-white/40 leading-relaxed max-w-xs -mt-4">
                        Crea tu cuenta y deja que tu Gemelo Cognitivo empiece a aprender desde el primer día.
                    </p>
                </div>

                <p className="relative z-10 text-center text-[11px] text-white/25 font-medium tracking-wide">
                    © {new Date().getFullYear()} Novo — Todos los derechos reservados
                </p>
            </div>

            {/* Right — form panel, theme-adaptive */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-8 lg:p-16 relative overflow-y-auto">
                <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/5 to-transparent pointer-events-none" />
                <div className="w-full max-w-sm space-y-7 relative z-10 py-8">
                    <div className="space-y-2">
                        <div className="flex items-center gap-2.5 mb-6 lg:hidden">
                            <div className="h-9 w-9 rounded-full bg-foreground flex items-center justify-center">
                                <div className="h-3.5 w-3.5 bg-background rounded-full" />
                            </div>
                            <span className="text-sm font-bold tracking-tight text-foreground/40">NOVO</span>
                        </div>
                        <h2 className="text-3xl font-black tracking-tight">Crea tu cuenta</h2>
                        <p className="text-sm text-foreground/40 leading-relaxed">Empieza gratis. Sin tarjeta de crédito.</p>
                    </div>

                    <button
                        onClick={handleGoogleSignUp}
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
                        Continuar con Google
                    </button>

                    <div className="flex items-center gap-4">
                        <div className="flex-1 h-px bg-foreground/10" />
                        <span className="text-[11px] font-medium tracking-widest uppercase text-foreground/20">o</span>
                        <div className="flex-1 h-px bg-foreground/10" />
                    </div>

                    <form onSubmit={handleSignUp} className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <label htmlFor="firstName" className="text-xs font-medium text-foreground/40 tracking-wide uppercase">Nombre</label>
                                <input
                                    id="firstName"
                                    placeholder="Juan"
                                    value={firstName}
                                    onChange={(e) => setFirstName(e.target.value)}
                                    className="w-full h-13 px-4 py-3.5 bg-foreground/5 border border-foreground/10 backdrop-blur-md rounded-xl text-sm text-foreground placeholder:text-foreground/20 focus:outline-none focus:border-indigo-500/50 focus:bg-foreground/[0.07] transition-all"
                                    required
                                    disabled={loading || googleLoading}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label htmlFor="lastName" className="text-xs font-medium text-foreground/40 tracking-wide uppercase">Apellido</label>
                                <input
                                    id="lastName"
                                    placeholder="Pérez"
                                    value={lastName}
                                    onChange={(e) => setLastName(e.target.value)}
                                    className="w-full h-13 px-4 py-3.5 bg-foreground/5 border border-foreground/10 backdrop-blur-md rounded-xl text-sm text-foreground placeholder:text-foreground/20 focus:outline-none focus:border-indigo-500/50 focus:bg-foreground/[0.07] transition-all"
                                    required
                                    disabled={loading || googleLoading}
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label htmlFor="email" className="text-xs font-medium text-foreground/40 tracking-wide uppercase">Email</label>
                            <input
                                id="email"
                                type="email"
                                placeholder="tu@ejemplo.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full h-13 px-4 py-3.5 bg-foreground/5 border border-foreground/10 backdrop-blur-md rounded-xl text-sm text-foreground placeholder:text-foreground/20 focus:outline-none focus:border-indigo-500/50 focus:bg-foreground/[0.07] transition-all"
                                required
                                disabled={loading || googleLoading}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label htmlFor="password" className="text-xs font-medium text-foreground/40 tracking-wide uppercase">Contraseña</label>
                            <div className="relative">
                                <input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full h-13 px-4 py-3.5 pr-12 bg-foreground/5 border border-foreground/10 backdrop-blur-md rounded-xl text-sm text-foreground placeholder:text-foreground/20 focus:outline-none focus:border-indigo-500/50 focus:bg-foreground/[0.07] transition-all"
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
                            <p className="text-xs text-foreground/25">Mínimo 8 caracteres.</p>
                        </div>

                        {error && (
                            <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium">
                                {error}
                            </div>
                        )}

                        <motion.button
                            type="submit"
                            disabled={loading || googleLoading}
                            whileTap={{ scale: 0.98 }}
                            className="w-full h-13 rounded-2xl bg-foreground text-background font-semibold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 shadow-lg hover:opacity-90"
                        >
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Crear cuenta'}
                        </motion.button>
                    </form>

                    <p className="text-center text-xs text-foreground/25">
                        ¿Ya tienes cuenta?{' '}
                        <button onClick={() => router.push('/auth/signin')} className="text-foreground/60 font-medium hover:text-foreground transition-colors">
                            Inicia sesión
                        </button>
                    </p>
                </div>
            </div>
        </div>
    )
}
