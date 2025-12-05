"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Play, Clock, Music } from "lucide-react"
import { usePlayerStore } from "@/lib/player-store"
import { SpotifyTrack } from "@/lib/spotify"

interface PlaylistViewProps {
    isOpen: boolean
    onClose: () => void
    playlistId: string
    type: 'playlist' | 'album' | 'saved-tracks'
    title: string
    description?: string
    image?: string
}

export function PlaylistView({ isOpen, onClose, playlistId, type, title, description, image }: PlaylistViewProps) {
    const [tracks, setTracks] = useState<SpotifyTrack[]>([])
    const [loading, setLoading] = useState(false)
    const { playPlaylist, playTrack } = usePlayerStore()

    useEffect(() => {
        if (isOpen) {
            loadTracks()
        }
    }, [isOpen, playlistId, type])

    const loadTracks = async () => {
        setLoading(true)
        try {
            let url = ''
            if (type === 'playlist') {
                url = `/api/spotify/playlists/${playlistId}/tracks`
            } else if (type === 'album') {
                url = `/api/spotify/albums/${playlistId}/tracks`
            } else if (type === 'saved-tracks') {
                url = `/api/spotify/tracks?limit=50` // Default limit, might need pagination for full library
            }

            if (url) {
                const res = await fetch(url)
                if (res.ok) {
                    const data = await res.json()
                    let fetchedTracks: SpotifyTrack[] = []

                    if (type === 'playlist') {
                        fetchedTracks = data.items.map((item: any) => item.track)
                    } else if (type === 'album') {
                        // Album tracks don't have album info nested, so we might need to add it or handle it
                        fetchedTracks = data.items.map((item: any) => ({
                            ...item,
                            album: { name: title, images: [{ url: image }] } // Polyfill album info
                        }))
                    } else if (type === 'saved-tracks') {
                        fetchedTracks = data.items.map((item: any) => item.track)
                    }

                    setTracks(fetchedTracks.filter(t => t)) // Filter out nulls
                }
            }
        } catch (error) {
            console.error("Failed to load tracks", error)
        } finally {
            setLoading(false)
        }
    }

    const handlePlayAll = () => {
        playPlaylist({
            id: playlistId,
            name: title,
            tracks: tracks.map(t => ({
                id: t.id,
                uri: t.uri,
                name: t.name,
                artist: t.artists.map(a => a.name).join(', '),
                image: t.album?.images?.[0]?.url || image,
                duration_ms: t.duration_ms
            }))
        })
    }

    const handlePlayTrack = (track: SpotifyTrack, index: number) => {
        playPlaylist({
            id: playlistId,
            name: title,
            tracks: tracks.map(t => ({
                id: t.id,
                uri: t.uri,
                name: t.name,
                artist: t.artists.map(a => a.name).join(', '),
                image: t.album?.images?.[0]?.url || image,
                duration_ms: t.duration_ms
            }))
        }, index)
    }

    const formatDuration = (ms: number) => {
        const minutes = Math.floor(ms / 60000)
        const seconds = ((ms % 60000) / 1000).toFixed(0)
        return `${minutes}:${Number(seconds) < 10 ? '0' : ''}${seconds}`
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0 gap-0">
                <DialogHeader className="sr-only">
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{description || `View ${title} playlist`}</DialogDescription>
                </DialogHeader>
                <div className="p-6 border-b flex items-start gap-6">
                    {image ? (
                        <img src={image} alt={title} className="w-48 h-48 rounded-md shadow-lg object-cover" />
                    ) : (
                        <div className="w-48 h-48 bg-muted rounded-md flex items-center justify-center">
                            <Music className="w-16 h-16 text-muted-foreground" />
                        </div>
                    )}
                    <div className="flex-1 pt-4">
                        <h2 className="text-3xl font-bold mb-2">{title}</h2>
                        {description && <p className="text-muted-foreground mb-6 line-clamp-2">{description}</p>}
                        <div className="flex items-center gap-4">
                            <Button onClick={handlePlayAll} size="lg" className="bg-[#1DB954] hover:bg-[#1ed760] text-white rounded-full px-8">
                                <Play className="w-5 h-5 mr-2 fill-current" />
                                Play
                            </Button>
                            <div className="text-sm text-muted-foreground">
                                {tracks.length} songs
                            </div>
                        </div>
                    </div>
                </div>

                <ScrollArea className="flex-1 p-6">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {tracks.map((track, index) => (
                                <div
                                    key={track.id}
                                    className="group flex items-center gap-4 p-2 rounded-md hover:bg-accent/50 transition-colors cursor-pointer"
                                    onClick={() => handlePlayTrack(track, index)}
                                >
                                    <div className="w-8 text-center text-sm text-muted-foreground group-hover:hidden">
                                        {index + 1}
                                    </div>
                                    <div className="w-8 hidden group-hover:flex items-center justify-center">
                                        <Play className="w-4 h-4 fill-current" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-medium truncate">{track.name}</div>
                                        <div className="text-sm text-muted-foreground truncate">
                                            {track.artists.map(a => a.name).join(', ')}
                                        </div>
                                    </div>
                                    <div className="text-sm text-muted-foreground hidden md:block w-1/3 truncate">
                                        {track.album?.name}
                                    </div>
                                    <div className="text-sm text-muted-foreground w-12 text-right">
                                        {track.duration_ms ? formatDuration(track.duration_ms) : '--:--'}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </ScrollArea>
            </DialogContent>
        </Dialog>
    )
}
