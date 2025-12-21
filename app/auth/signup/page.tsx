'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, CheckCircle2, Eye, EyeOff, Github } from 'lucide-react'
import { motion } from 'framer-motion'

export default function SignUpPage() {
    const router = useRouter()
    const [firstName, setFirstName] = useState('')
    const [lastName, setLastName] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const [success, setSuccess] = useState(false)

    const handleSignUp = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        // Combine names
        const fullName = `${firstName} ${lastName}`.trim()

        if (password.length < 6) {
            setError('Must be at least 8 characters.')
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
                setError(data.error || 'Error creating account')
                setLoading(false)
                return
            }

            setSuccess(true)
            setTimeout(() => {
                router.push('/auth/signin')
            }, 2000)

        } catch (error) {
            setError('Connection error. Please try again.')
            setLoading(false)
        }
    }

    if (success) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-black text-white p-4">
                <div className="flex flex-col items-center justify-center space-y-4 text-center">
                    <CheckCircle2 className="h-16 w-16 text-green-500" />
                    <h2 className="text-2xl font-bold">Account Created!</h2>
                    <p className="text-gray-400">Redirecting to login...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen w-full flex bg-black text-white overflow-hidden">
            {/* Left Side - Gradient & Info */}
            <div className="hidden lg:flex w-1/2 relative p-12 flex-col justify-between overflow-hidden">
                {/* Gradient Background */}
                <div className="absolute inset-0 bg-gradient-to-br from-violet-600 via-purple-700 to-black opacity-90 z-0" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_var(--tw-gradient-stops))] from-violet-500/40 via-transparent to-transparent z-0" />

                {/* Content */}
                <div className="relative z-10 h-full flex flex-col justify-center items-center text-center space-y-8">
                    <div className="flex items-center gap-2 mb-8">
                        <div className="h-8 w-8 rounded-full border-2 border-white flex items-center justify-center">
                            <div className="h-4 w-4 bg-white rounded-full" />
                        </div>
                        <span className="text-xl font-semibold tracking-tight">OnlyPipe</span>
                    </div>

                    <h1 className="text-5xl font-bold tracking-tight max-w-md">
                        Get Started with Us
                    </h1>
                    <p className="text-gray-300 max-w-sm">
                        Complete these easy steps to register your account.
                    </p>

                    <div className="w-full max-w-xs space-y-4 mt-8">
                        <div className="bg-white text-black p-4 rounded-xl flex items-center gap-4 shadow-lg transform scale-105 transition-transform">
                            <div className="h-6 w-6 bg-black text-white rounded-full flex items-center justify-center text-xs font-bold">1</div>
                            <span className="font-medium">Sign up your account</span>
                        </div>
                        <div className="bg-white/10 backdrop-blur-sm p-4 rounded-xl flex items-center gap-4 border border-white/10">
                            <div className="h-6 w-6 bg-white/20 rounded-full flex items-center justify-center text-xs">2</div>
                            <span className="text-gray-300">Set up your workspace</span>
                        </div>
                        <div className="bg-white/10 backdrop-blur-sm p-4 rounded-xl flex items-center gap-4 border border-white/10">
                            <div className="h-6 w-6 bg-white/20 rounded-full flex items-center justify-center text-xs">3</div>
                            <span className="text-gray-300">Set up your profile</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Side - Form */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-8 lg:p-16 bg-black">
                <div className="w-full max-w-md space-y-8">
                    <div className="space-y-2">
                        <h2 className="text-3xl font-bold tracking-tight">Sign Up Account</h2>
                        <p className="text-gray-400">Enter your personal data to create your account.</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <Button variant="outline" className="bg-black border-gray-800 hover:bg-gray-900 hover:text-white h-12">
                            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                            </svg>
                            Google
                        </Button>
                        <Button variant="outline" className="bg-black border-gray-800 hover:bg-gray-900 hover:text-white h-12">
                            <Github className="mr-2 h-4 w-4" />
                            Github
                        </Button>
                    </div>

                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t border-gray-800" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-black px-2 text-gray-500">Or</span>
                        </div>
                    </div>

                    <form onSubmit={handleSignUp} className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="firstName" className="text-gray-300">First Name</Label>
                                <Input
                                    id="firstName"
                                    placeholder="eg. John"
                                    value={firstName}
                                    onChange={(e) => setFirstName(e.target.value)}
                                    className="bg-gray-900/50 border-gray-800 h-12 focus:border-violet-500 transition-colors"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="lastName" className="text-gray-300">Last Name</Label>
                                <Input
                                    id="lastName"
                                    placeholder="eg. Francisco"
                                    value={lastName}
                                    onChange={(e) => setLastName(e.target.value)}
                                    className="bg-gray-900/50 border-gray-800 h-12 focus:border-violet-500 transition-colors"
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="email" className="text-gray-300">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="eg. johnfrans@gmail.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="bg-gray-900/50 border-gray-800 h-12 focus:border-violet-500 transition-colors"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="password" className="text-gray-300">Password</Label>
                            <div className="relative">
                                <Input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    placeholder="Enter your password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="bg-gray-900/50 border-gray-800 h-12 pr-10 focus:border-violet-500 transition-colors"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                                >
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                            <p className="text-xs text-gray-500">Must be at least 8 characters.</p>
                        </div>

                        {error && (
                            <Alert variant="destructive" className="bg-red-900/20 border-red-900 text-red-200">
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}

                        <Button
                            type="submit"
                            className="w-full h-12 bg-white text-black hover:bg-gray-200 font-semibold text-base"
                            disabled={loading}
                        >
                            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Sign Up'}
                        </Button>
                    </form>

                    <div className="text-center text-sm text-gray-500">
                        Already have an account?{' '}
                        <Link href="/auth/signin" className="text-white hover:underline font-medium">
                            Log in
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    )
}
