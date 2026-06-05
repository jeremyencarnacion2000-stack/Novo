import { NextResponse } from 'next/server'
import { getYTMusic } from '@/lib/ytmusic'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'Album ID is required' }, { status: 400 })
    }

    const ytmusic = await getYTMusic()
    const album = await ytmusic.getAlbum(id)

    const mappedAlbum = {
      id: (album as any).albumId || id,
      playlistId: (album as any).playlistId,
      name: album.name,
      artist: (album as any).artist?.name || 'Unknown Artist',
      artistId: (album as any).artist?.artistId,
      year: (album as any).year,
      thumbnails: album.thumbnails,
      tracks: (album as any).songs?.map((song: any) => ({
        id: song.videoId,
        uri: song.videoId,
        name: song.name,
        artist: song.artist?.name || (album as any).artist?.name || 'Unknown',
        artistId: song.artist?.artistId || (album as any).artist?.artistId,
        image: song.thumbnails?.[song.thumbnails.length - 1]?.url || album.thumbnails?.[album.thumbnails.length - 1]?.url,
        album: album.name,
        duration: song.duration,
        duration_ms: (song.duration || 0) * 1000,
      })) || []
    }

    return NextResponse.json(mappedAlbum)
  } catch (error: any) {
    console.error('Album API Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
