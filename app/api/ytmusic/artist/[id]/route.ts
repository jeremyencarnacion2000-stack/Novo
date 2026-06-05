import { NextResponse } from 'next/server'
import { getYTMusic } from '@/lib/ytmusic'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'Artist ID is required' }, { status: 400 })
    }

    const ytmusic = await getYTMusic()
    const artist = await ytmusic.getArtist(id)

    // Map to a more consistent format for the frontend
    const mappedArtist = {
      id: artist.artistId,
      name: artist.name,
      thumbnails: artist.thumbnails,
      topSongs: artist.topSongs?.map((song: any) => ({
        id: song.videoId,
        name: song.name,
        artist: song.artist?.name || artist.name,
        image: song.thumbnails?.[song.thumbnails.length - 1]?.url,
        duration: song.duration,
        album: song.album?.name || ''
      })) || [],
      topAlbums: artist.topAlbums?.map((album: any) => ({
        id: album.albumId,
        playlistId: album.playlistId,
        name: album.name,
        year: album.year,
        image: album.thumbnails?.[album.thumbnails.length - 1]?.url
      })) || [],
      similarArtists: artist.similarArtists?.map((sa: any) => ({
        id: sa.artistId,
        name: sa.name,
        image: sa.thumbnails?.[sa.thumbnails.length - 1]?.url
      })) || []
    }

    return NextResponse.json(mappedArtist)
  } catch (error: any) {
    console.error('Artist API Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
