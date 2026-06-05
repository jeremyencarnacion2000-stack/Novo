'use client'

import React, { useState } from 'react'
import {
    X,
    MoreHorizontal,
    Heart,
    ListMusic,
    Plus,
    Loader2,
    Search,
    Mic
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { usePlayerStore } from '@/lib/player-store'
import { cn } from '@/lib/utils'

interface NowPlayingPanelProps {
    isOpen: boolean
    onClose: () => void
    className?: string
}

export function NowPlayingPanel({ isOpen, onClose, className }: NowPlayingPanelProps) {
    const { currentTrack, queue, currentPlaylist, playTrack, toggleLike, likedTracks, followedArtists, toggleFollow } = usePlayerStore()
    const [activeTab, setActiveTab] = useState<'about' | 'lyrics' | 'queue'>('about')
    const [playlists, setPlaylists] = useState<any[]>([])
    const [isMenuOpen, setIsMenuOpen] = useState(false)
    const menuRef = React.useRef<HTMLDivElement>(null)

    React.useEffect(() => {
        if (isOpen) {
            fetch('/api/music/playlists')
                .then(r => r.ok ? r.json() : [])
                .then(data => setPlaylists(data))
                .catch(e => console.error("Failed to fetch playlists in panel", e))
        }
    }, [isOpen])

    React.useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setIsMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleAddTrack = async (playlistId: string) => {
        if (!currentTrack) return
        
        const playlist = playlists.find(p => p.id === playlistId)
        if (!playlist) return
        
        const currentTracks = Array.isArray(playlist.tracks) ? playlist.tracks : []
        const trackIdToAdd = currentTrack.id
        if (currentTracks.some((t: any) => (t.id || t.trackId) === trackIdToAdd)) {
            setIsMenuOpen(false)
            return
        }

        const updatedTracks = [...currentTracks, {
            id: trackIdToAdd,
            name: currentTrack.name,
            artist: currentTrack.artist,
            artistId: currentTrack.artistId || '',
            image: currentTrack.image || '',
            duration_ms: currentTrack.duration_ms || 240000
        }]

        // Optimistic update
        setPlaylists(prev => prev.map(p => p.id === playlistId ? { ...p, tracks: updatedTracks } : p))
        setIsMenuOpen(false)

        try {
            await fetch(`/api/music/playlists/${playlistId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tracks: updatedTracks })
            })
        } catch (e) {
            console.error("Failed to add track from panel", e)
        }
    }

    const isLiked = currentTrack ? likedTracks.includes(currentTrack.id) : false
    const isFollowing = currentTrack?.artistId ? followedArtists.includes(currentTrack.artistId) : false

    if (!isOpen || !currentTrack) {
        return null
    }

    return (
        <div className={`w-[420px] bg-[#121212] border-l border-[#282828] flex flex-col h-full ${className}`}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#282828]">
                <h3 className="text-white font-bold text-sm">
                    {currentPlaylist ? currentPlaylist.name : 'Now Playing'}
                </h3>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onClose}
                    className="text-gray-400 hover:text-white h-8 w-8"
                >
                    <X className="h-4 w-4" />
                </Button>
            </div>

            {/* Tabs */}
            <div className="flex gap-4 px-4 py-2 border-b border-[#282828] bg-black/20">
                <button 
                  onClick={() => setActiveTab('about')}
                  className={`text-xs font-bold uppercase tracking-wider pb-1 transition-colors ${activeTab === 'about' ? 'text-white border-b-2 border-white' : 'text-gray-500 hover:text-gray-300'}`}
                >
                    About
                </button>
                <button 
                  onClick={() => setActiveTab('lyrics')}
                  className={`text-xs font-bold uppercase tracking-wider pb-1 transition-colors ${activeTab === 'lyrics' ? 'text-white border-b-2 border-white' : 'text-gray-500 hover:text-gray-300'}`}
                >
                    Lyrics
                </button>
                <button 
                  onClick={() => setActiveTab('queue')}
                  className={`text-xs font-bold uppercase tracking-wider pb-1 transition-colors ${activeTab === 'queue' ? 'text-white border-b-2 border-white' : 'text-gray-500 hover:text-gray-300'}`}
                >
                    Queue ({queue.length})
                </button>
            </div>

            <ScrollArea className="flex-1">
                <div className="p-4">
                    {activeTab === 'about' && (
                        <>
                            {/* Album Art */}
                            <div className="relative mb-4 group">
                                {currentTrack.image ? (
                                    <img
                                        src={currentTrack.image}
                                        alt={currentTrack.name}
                                        className="w-full aspect-square rounded-lg object-cover shadow-2xl"
                                    />
                                ) : (
                                    <div className="w-full aspect-square rounded-lg bg-[#282828] flex items-center justify-center">
                                        <ListMusic className="w-20 h-20 text-gray-500" />
                                    </div>
                                )}
                            </div>

                            {/* Track Info */}
                            <div className="flex items-start justify-between mb-6">
                                <div className="flex-1 min-w-0">
                                    <h2 className="text-2xl font-bold text-white truncate mb-1">
                                        {currentTrack.name}
                                    </h2>
                                    <p className="text-gray-400 hover:underline cursor-pointer">
                                        {currentTrack.artist}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 ml-4">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => toggleLike(currentTrack)}
                                        className={`h-8 w-8 ${isLiked ? 'text-[#ff4e50]' : 'text-gray-400 hover:text-white'}`}
                                    >
                                        <Heart className={`h-5 w-5 ${isLiked ? 'fill-current' : ''}`} />
                                    </Button>
                                    <div className="relative">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                setIsMenuOpen(!isMenuOpen)
                                            }}
                                            className={cn("h-8 w-8", isMenuOpen ? "text-[#1db954]" : "text-gray-400 hover:text-white")}
                                        >
                                            <MoreHorizontal className="h-5 w-5" />
                                        </Button>
                                        
                                        {isMenuOpen && (
                                            <div 
                                                ref={menuRef}
                                                className="absolute right-0 mt-2 w-48 bg-[#1e201b]/95 backdrop-blur-2xl border border-white/10 rounded-xl py-1 shadow-2xl z-50 overflow-hidden"
                                            >
                                                <div className="px-3 py-1.5 text-[10px] font-bold text-white/40 uppercase tracking-widest border-b border-white/5">Options</div>
                                                
                                                {playlists.length > 0 ? (
                                                    <div className="py-1">
                                                        <p className="px-3 py-1 text-[11px] font-semibold text-[#b3b3b3]">Add to Playlist:</p>
                                                        {playlists.map(p => (
                                                            <button
                                                                key={p.id}
                                                                onClick={() => handleAddTrack(p.id)}
                                                                className="w-full text-left px-4 py-1.5 text-xs text-white/80 hover:text-white hover:bg-white/10 transition-colors truncate"
                                                            >
                                                                + {p.name}
                                                            </button>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="px-4 py-2 text-xs text-[#b3b3b3] italic">
                                                        No custom playlists. Create one on the Home page.
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* About the Artist section */}
                            {currentTrack.artist && (
                                <div className="bg-[#1a1a1a] rounded-lg p-4 mb-4">
                                    <h4 className="text-white font-bold text-sm mb-3">About the artist</h4>
                                    <div className="flex items-center gap-3">
                                        <div className="w-16 h-16 rounded-full bg-[#282828] flex items-center justify-center overflow-hidden">
                                            {currentTrack.image ? (
                                                <img
                                                    src={currentTrack.image}
                                                    alt={currentTrack.artist}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <ListMusic className="w-6 h-6 text-gray-500" />
                                            )}
                                        </div>
                                        <div className="flex-1">
                                            <h5 className="text-white font-bold">{currentTrack.artist}</h5>
                                            <p className="text-gray-400 text-sm">Artist</p>
                                        </div>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                                if (currentTrack.artistId) {
                                                    toggleFollow(currentTrack.artistId, currentTrack.artist || 'Unknown', currentTrack.image || '')
                                                }
                                            }}
                                            className={cn(
                                                "rounded-full border-white/20 px-6 font-bold transition-all duration-300",
                                                isFollowing ? "bg-white text-black hover:bg-gray-200" : "text-white hover:bg-white hover:text-black hover:scale-105"
                                            )}
                                        >
                                            {isFollowing ? 'Following' : 'Follow'}
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {/* Credits section */}
                            <div className="mt-6 border-t border-[#282828] pt-4">
                                <h4 className="text-white font-bold text-sm mb-3">Credits</h4>
                                <div className="text-gray-400 text-sm">
                                    <p className="mb-1">
                                        <span className="text-white">{currentTrack.artist}</span>
                                    </p>
                                    <p className="text-xs">Main Artist</p>
                                </div>
                            </div>
                        </>
                    )}

                    {activeTab === 'lyrics' && (
                        <div className="min-h-[400px] flex flex-col items-center justify-center p-8 text-center space-y-6">
                            <div className="relative">
                                <div className="absolute inset-0 bg-indigo-500/20 blur-3xl rounded-full animate-pulse" />
                                <div className="relative bg-white/5 p-8 rounded-full border border-white/10 animate-[bounce_3s_infinite]">
                                    <Mic className="h-12 w-12 text-indigo-400" />
                                </div>
                            </div>
                            
                            <div className="space-y-4 max-w-xs">
                                <h4 className="text-white font-black text-xl tracking-tight">Searching for lyrics...</h4>
                                <div className="space-y-2">
                                  <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                                     <div className="h-full bg-indigo-500 w-1/3 animate-[shimmer_2s_infinite]" />
                                  </div>
                                  <div className="h-2 w-4/5 bg-white/5 rounded-full mx-auto overflow-hidden">
                                     <div className="h-full bg-indigo-500 w-1/2 animate-[shimmer_2.5s_infinite]" />
                                  </div>
                                </div>
                                <p className="text-gray-500 text-sm leading-relaxed">
                                    We are synchronizing metadata from YouTube Music to find the perfect lyrics for 
                                    <span className="text-indigo-400 font-medium"> {currentTrack.name}</span>.
                                </p>
                            </div>

                            <style jsx>{`
                                @keyframes shimmer {
                                    0% { transform: translateX(-100%); }
                                    100% { transform: translateX(300%); }
                                }
                            `}</style>
                        </div>
                    )}

                    {activeTab === 'queue' && (
                        <div className="flex flex-col pt-4">
                            <h4 className="text-white font-bold text-sm mb-4">Queue</h4>
                            {queue.length > 0 ? (
                                <div className="space-y-2">
                                    {queue.map((track, index) => (
                                        <div
                                            key={`${track.id}-${index}`}
                                            onClick={() => playTrack(track)}
                                            className="flex items-center gap-3 p-2 rounded-md hover:bg-white/10 group transition-colors cursor-pointer"
                                        >
                                            <div className="relative w-10 h-10 shrink-0">
                                                {track.image ? (
                                                    <img
                                                        src={track.image}
                                                        alt={track.name}
                                                        className="w-full h-full rounded object-cover"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full rounded bg-[#282828] flex items-center justify-center">
                                                        <ListMusic className="w-4 h-4 text-gray-500" />
                                                    </div>
                                                )}
                                                <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded">
                                                    <Plus className="w-4 h-4 text-white" />
                                                </div>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-white text-sm truncate font-medium">{track.name}</p>
                                                <p className="text-gray-400 text-xs truncate">{track.artist}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-20 text-center">
                                    <ListMusic className="w-12 h-12 text-gray-600 mb-4" />
                                    <p className="text-gray-400 italic">Your queue is empty.</p>
                                    <p className="text-xs text-gray-500 mt-2">Add songs from the home page or search.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </ScrollArea>
        </div>
    )
}
