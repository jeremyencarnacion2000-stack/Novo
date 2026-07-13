'use client'

import React, { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { 
  Play, 
  Pause, 
  Heart, 
  MoreHorizontal, 
  Music, 
  ChevronLeft,
  Disc,
  Users,
  Check,
  UserPlus
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { Card } from '@/components/ui/card'
import { usePlayerStore } from '@/lib/player-store'
import { cn } from '@/lib/utils'
import Link from 'next/link'

interface ArtistData {
  id: string
  name: string
  thumbnails: { url: string; width: number; height: number }[]
  topSongs: any[]
  topAlbums: any[]
  similarArtists: any[]
}

export default function ArtistProfilePage() {
  const { id } = useParams()
  const [artist, setArtist] = useState<ArtistData | null>(null)
  const [loading, setLoading] = useState(true)
  const { playTrack, playPlaylist, currentTrack, isPlaying, togglePlayPause, likedTracks, toggleLike, followedArtists, toggleFollow } = usePlayerStore()

  useEffect(() => {
    async function fetchArtist() {
      try {
        const res = await fetch(`/api/ytmusic/artist/${id}`)
        if (res.ok) {
          const data = await res.json()
          setArtist(data)
        }
      } catch (err) {
        console.error('Failed to fetch artist:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchArtist()
  }, [id])

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-black/20 backdrop-blur-3xl">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
          <p className="text-gray-400 animate-pulse font-medium">Loading Artist Profile...</p>
        </div>
      </div>
    )
  }

  if (!artist) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-black/20 backdrop-blur-3xl">
        <div className="text-center space-y-4">
          <Music className="h-16 w-16 text-gray-600 mx-auto opacity-20" />
          <h2 className="text-xl font-bold text-white">Artist not found</h2>
          <Link href="/music">
            <Button variant="outline" className="rounded-full border-white/10 mt-4">Go Back</Button>
          </Link>
        </div>
      </div>
    )
  }

  const artistImage = artist.thumbnails?.[artist.thumbnails.length - 1]?.url || '/placeholder-album.png'

  return (
    <div className="flex h-full w-full text-white overflow-hidden bg-black/20 backdrop-blur-3xl p-2 sm:p-4 gap-2 sm:gap-4 select-none">
      <Card variant="primary" className="flex-1 h-full min-h-0 rounded-2xl sm:rounded-3xl flex flex-col overflow-hidden z-10 border-white/10 bg-white/5 relative">
        
        {/* Transparent Header Overlay */}
        <div className="absolute top-0 left-0 right-0 z-20 p-4 sm:p-8 flex items-center justify-between bg-gradient-to-b from-black/60 to-transparent pointer-events-none">
          <Link href="/music" className="pointer-events-auto">
            <Button size="icon" variant="ghost" className="rounded-full bg-black/20 hover:bg-black/40 text-white backdrop-blur-md border border-white/10">
              <ChevronLeft className="h-6 w-6" />
            </Button>
          </Link>
        </div>

        <ScrollArea className="flex-1 overflow-y-auto">
          <div className="flex flex-col">
            
            {/* Hero Section */}
            <div className="relative h-[40vh] sm:h-[50vh] w-full shrink-0">
              <img 
                src={artistImage} 
                alt={artist.name} 
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-12 space-y-4">
                <div className="flex items-center gap-2 text-indigo-400 font-bold uppercase tracking-widest text-xs">
                  <Users className="h-3 w-3" />
                  Verified Artist
                </div>
                <h1 className="text-4xl sm:text-6xl md:text-8xl font-black tracking-tighter drop-shadow-2xl">{artist.name}</h1>
                <div className="flex items-center gap-4 pt-4">
                  <Button 
                    size="lg" 
                    className="rounded-full bg-indigo-600 hover:bg-indigo-700 text-white px-8 h-14 font-bold shadow-xl hover:scale-105 transition-all flex items-center gap-3"
                    onClick={() => {
                        if (artist.topSongs?.[0]) {
                            playTrack({
                                id: artist.topSongs[0].id,
                                uri: artist.topSongs[0].id,
                                name: artist.topSongs[0].name,
                                artist: artist.name,
                                image: artist.topSongs[0].image,
                                duration_ms: artist.topSongs[0].duration * 1000
                            })
                        }
                    }}
                  >
                    <Play className="h-6 w-6 fill-current" />
                    Play Now
                  </Button>
                  <Button 
                    variant="outline" 
                    size="lg" 
                    className={cn(
                      "rounded-full h-14 px-8 font-bold backdrop-blur-sm transition-all flex items-center gap-2",
                      followedArtists.includes(artist.id)
                        ? "bg-white/10 border-white/30 text-white hover:bg-red-500/20 hover:border-red-500/30 hover:text-red-300"
                        : "border-white/20 text-white hover:bg-white/10"
                    )}
                    onClick={() => {
                      const artistImage = artist.thumbnails?.[artist.thumbnails.length - 1]?.url || ''
                      toggleFollow(artist.id, artist.name, artistImage)
                    }}
                  >
                    {followedArtists.includes(artist.id) ? (
                      <><Check className="h-5 w-5" /> Following</>
                    ) : (
                      <><UserPlus className="h-5 w-5" /> Follow</>
                    )}
                  </Button>
                  <Button variant="ghost" size="icon" className="rounded-full text-white/60 hover:text-white">
                    <MoreHorizontal className="h-6 w-6" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="p-6 sm:p-12 space-y-12">
              
              {/* Top Songs */}
              <section className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-black tracking-tight">Popular Tracks</h2>
                  <Button variant="ghost" className="text-indigo-400 hover:text-indigo-300 font-bold text-sm">See all</Button>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-12 gap-y-1">
                  {artist.topSongs.slice(0, 10).map((song, idx) => (
                    <div 
                      key={song.id} 
                      className="group flex items-center gap-4 p-3 rounded-xl hover:bg-white/5 transition-all cursor-pointer border border-transparent hover:border-white/5"
                      onClick={() => playTrack({
                          id: song.id,
                          uri: song.id,
                          name: song.name,
                          artist: artist.name,
                          artistId: artist.id,
                          image: song.image,
                          duration_ms: song.duration * 1000
                      })}
                    >
                      <div className="w-4 text-center text-gray-500 font-mono text-sm group-hover:text-white transition-colors">{idx + 1}</div>
                      <div className="relative w-12 h-12 shrink-0 overflow-hidden rounded-lg">
                        <img src={song.image || '/placeholder-album.png'} loading="lazy" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Play className="h-4 w-4 text-white fill-current" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className={cn("font-bold truncate text-sm", currentTrack?.id === song.id ? "text-indigo-400" : "text-white")}>{song.name}</h4>
                        <p className="text-xs text-gray-500 truncate">{song.album || 'Single'}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className={cn("h-8 w-8", likedTracks.includes(song.id) ? "text-red-500" : "text-gray-500 hover:text-white")}
                          onClick={(e) => {
                              e.stopPropagation();
                              toggleLike(song);
                          }}
                        >
                          <Heart className={cn("h-4 w-4", likedTracks.includes(song.id) && "fill-current")} />
                        </Button>
                        <span className="hidden sm:block text-xs text-gray-500 font-mono">
                          {Math.floor(song.duration / 60)}:{(song.duration % 60).toString().padStart(2, '0')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Albums */}
              {artist.topAlbums.length > 0 && (
                <section className="space-y-6">
                  <h2 className="text-2xl font-black tracking-tight">Discography</h2>
                  <ScrollArea className="w-full pb-4" horizontalWheel>
                    <div className="flex gap-6 min-w-max pb-4">
                      {artist.topAlbums.map((album) => (
                        <div key={album.id} className="w-40 sm:w-48 space-y-4 group cursor-pointer">
                          <div className="relative aspect-square rounded-2xl overflow-hidden shadow-lg group-hover:shadow-indigo-500/20 transition-all duration-500">
                            <img src={album.image || '/placeholder-album.png'} loading="lazy" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center">
                                <Button size="icon" className="h-12 w-12 rounded-full bg-white text-black hover:scale-110 transition-transform shadow-2xl">
                                    <Disc className="h-6 w-6" />
                                </Button>
                            </div>
                          </div>
                          <div>
                            <h4 className="font-bold text-white truncate text-sm">{album.name}</h4>
                            <p className="text-xs text-gray-500">{album.year || 'Album'}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <ScrollBar orientation="horizontal" />
                  </ScrollArea>
                </section>
              )}

              {/* Similar Artists */}
              {artist.similarArtists.length > 0 && (
                <section className="space-y-6 pb-24">
                  <h2 className="text-2xl font-black tracking-tight">Fans also like</h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
                    {artist.similarArtists.slice(0, 6).map((sa) => (
                      <Link key={sa.id} href={`/music/artist/${sa.id}`} className="group space-y-4 text-center">
                        <div className="aspect-square rounded-full overflow-hidden shadow-lg transition-all duration-500 group-hover:scale-105 group-hover:shadow-indigo-500/10">
                          <img src={sa.image || '/placeholder-album.png'} loading="lazy" className="w-full h-full object-cover" />
                        </div>
                        <h4 className="font-bold text-white truncate text-sm group-hover:text-indigo-400 transition-colors">{sa.name}</h4>
                      </Link>
                    ))}
                  </div>
                </section>
              )}
            </div>
          </div>
        </ScrollArea>
      </Card>
    </div>
  )
}
