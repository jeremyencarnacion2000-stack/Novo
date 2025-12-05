'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface MusicPlayerProps {
  trackId: string
}

export function MusicPlayer({ trackId }: MusicPlayerProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Music Player</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="mt-4">
          <p>Music player content will be added here</p>
        </div>
      </CardContent>
    </Card>
  )
}