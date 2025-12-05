'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, CheckCircle2 } from 'lucide-react'

export default function SignUpPage() {
    const router = useRouter()
    const [name, setName] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const [success, setSuccess] = useState(false)

    const handleSignUp = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        console.log('📝 [SignUp] Starting registration')
        console.log('👤 [SignUp] Name:', name)
        console.log('📧 [SignUp] Email:', email)
        console.log('🕐 [SignUp] Timestamp:', new Date().toISOString())

        // Validations
        if (password.length < 6) {
            console.warn('⚠️ [SignUp] Password too short')
            setError('La contraseña debe tener al menos 6 caracteres')
            setLoading(false)
            return
        }

        if (password !== confirmPassword) {
            console.warn('⚠️ [SignUp] Passwords do not match')
            setError('Las contraseñas no coinciden')
            setLoading(false)
            return
        }

        try {
            console.log('🌐 [SignUp] Sending registration request to API')
            const response = await fetch('/api/auth/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password })
            })

            const data = await response.json()

            console.log('📋 [SignUp] API Response:', {
                status: response.status,
                ok: response.ok,
                data: data
            })

            if (!response.ok) {
                console.error('❌ [SignUp] Registration failed:', data.error)
                setError(data.error || 'Error al crear la cuenta')
                setLoading(false)
                return
            }

            console.log('✅ [SignUp] Registration successful')
            setSuccess(true)

            // Redirect to login after 2 seconds
            setTimeout(() => {
                console.log('🔄 [SignUp] Redirecting to login page')
                router.push('/auth/signin')
            }, 2000)

        } catch (error) {
            console.error('💥 [SignUp] Exception during registration:', error)
            console.error('📊 [SignUp] Error details:', {
                name: (error as Error).name,
                message: (error as Error).message,
                stack: (error as Error).stack
            })
            setError('Error de conexión. Por favor intenta de nuevo.')
            setLoading(false)
        }
    }

    if (success) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4">
                <Card className="w-full max-w-md shadow-xl">
                    <CardContent className="pt-6">
                        <div className="flex flex-col items-center justify-center space-y-4 text-center">
                            <CheckCircle2 className="h-16 w-16 text-green-500" />
                            <h2 className="text-2xl font-bold">¡Cuenta Creada!</h2>
                            <p className="text-muted-foreground">
                                Tu cuenta ha sido creada exitosamente. Redirigiendo al inicio de sesión...
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4">
            <Card className="w-full max-w-md shadow-xl">
                <CardHeader className="space-y-1">
                    <div className="flex items-center justify-center mb-4">
                        <div className="h-12 w-12 rounded-lg bg-primary flex items-center justify-center">
                            <span className="text-2xl font-bold text-primary-foreground">N</span>
                        </div>
                    </div>
                    <CardTitle className="text-2xl text-center">Crear Cuenta</CardTitle>
                    <CardDescription className="text-center">
                        Únete a Novo y comienza a ser más productivo
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {error && (
                        <Alert variant="destructive" className="mb-4">
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    <form onSubmit={handleSignUp} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Nombre</Label>
                            <Input
                                id="name"
                                type="text"
                                placeholder="Tu nombre"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                                disabled={loading}
                                autoComplete="name"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="tu@email.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                disabled={loading}
                                autoComplete="email"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password">Contraseña</Label>
                            <Input
                                id="password"
                                type="password"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                disabled={loading}
                                autoComplete="new-password"
                            />
                            <p className="text-xs text-muted-foreground">
                                Mínimo 6 caracteres
                            </p>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="confirmPassword">Confirmar Contraseña</Label>
                            <Input
                                id="confirmPassword"
                                type="password"
                                placeholder="••••••••"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                                disabled={loading}
                                autoComplete="new-password"
                            />
                        </div>
                        <Button
                            type="submit"
                            className="w-full"
                            disabled={loading}
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Creando cuenta...
                                </>
                            ) : (
                                'Crear Cuenta'
                            )}
                        </Button>
                    </form>
                </CardContent>
                <CardFooter className="flex flex-col space-y-2">
                    <div className="text-sm text-center text-muted-foreground">
                        ¿Ya tienes una cuenta?{' '}
                        <Link href="/auth/signin" className="text-primary hover:underline font-medium">
                            Inicia sesión aquí
                        </Link>
                    </div>
                </CardFooter>
            </Card>
        </div>
    )
}
