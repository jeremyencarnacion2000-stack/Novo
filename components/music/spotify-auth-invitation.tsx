'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Music, Sparkles, Users, Headphones } from 'lucide-react'

export function SpotifyAuthInvitation() {
  const handleConnect = () => {
    window.location.href = '/api/spotify/auth'
  }

  return (
    <Card className="w-full max-w-2xl mx-auto bg-gradient-to-br from-green-50 to-green-100 border-green-200 shadow-lg">
      <CardHeader className="text-center pb-4">
        <div className="flex justify-center mb-4">
          <div className="p-3 bg-green-500 rounded-full">
            <Music className="w-8 h-8 text-white" />
          </div>
        </div>
        <CardTitle className="text-2xl font-bold text-green-800">
          Conecta tu Spotify
        </CardTitle>
        <CardDescription className="text-green-700 text-lg">
          Desbloquea una experiencia musical completa
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
          <div className="flex flex-col items-center space-y-2">
            <Sparkles className="w-6 h-6 text-green-600" />
            <p className="text-sm font-medium text-green-800">Música Personalizada</p>
            <p className="text-xs text-green-600">Recomendaciones basadas en tus gustos</p>
          </div>
          <div className="flex flex-col items-center space-y-2">
            <Users className="w-6 h-6 text-green-600" />
            <p className="text-sm font-medium text-green-800">Playlists Ilimitadas</p>
            <p className="text-xs text-green-600">Crea y comparte tus listas favoritas</p>
          </div>
          <div className="flex flex-col items-center space-y-2">
            <Headphones className="w-6 h-6 text-green-600" />
            <p className="text-sm font-medium text-green-800">Acceso Completo</p>
            <p className="text-xs text-green-600">Millones de canciones a tu alcance</p>
          </div>
        </div>
        <Button
          onClick={handleConnect}
          className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200"
          size="lg"
        >
          Conectar con Spotify
        </Button>
      </CardContent>
    </Card>
  )
}