'use client'

import React, { useState } from 'react'
import {
    X,
    MoreHorizontal,
    Heart,
    ListMusic,
    Plus
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { usePlayerStore } from '@/lib/player-store'

interface NowPlayingPanelProps {
    isOpen: boolean
    onClose: () => void
    className?: string
}

export function NowPlayingPanel({ isOpen, onClose, className }: NowPlayingPanelProps) {
    const { currentTrack, queue, currentPlaylist, playTrack } = usePlayerStore()
    const [isLiked, setIsLiked] = useState(false)
    const [isFollowing, setIsFollowing] = useState(false)

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

            <ScrollArea className="flex-1">
                <div className="p-4">
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
                                onClick={() => setIsLiked(!isLiked)}
                                className={`h-8 w-8 ${isLiked ? 'text-green-500' : 'text-gray-400 hover:text-white'}`}
                            >
                                <Heart className={`h-5 w-5 ${isLiked ? 'fill-current' : ''}`} />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => console.log('More options for:', currentTrack?.name)}
                                className="text-gray-400 hover:text-white h-8 w-8"
                            >
                                <MoreHorizontal className="h-5 w-5" />
                            </Button>
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
                                    onClick={() => setIsFollowing(!isFollowing)}
                                    className={`rounded-full border-white/20 ${isFollowing ? 'bg-white text-black' : 'text-white hover:bg-white hover:text-black'}`}
                                >
                                    {isFollowing ? 'Following' : 'Follow'}
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Queue Preview */}
                    {queue.length > 0 && (
                        <div className="mt-6">
                            <div className="flex items-center justify-between mb-3">
                                <h4 className="text-white font-bold text-sm">Next in queue</h4>
                                <Button variant="link" className="text-sm text-gray-400 hover:text-white p-0">
                                    Open queue
                                </Button>
                            </div>
                            <div className="space-y-2">
                                {queue.slice(0, 3).map((track, index) => (
                                    <div
                                        key={`${track.id}-${index}`}
                                        onClick={() => playTrack(track)}
                                        className="flex items-center gap-3 p-2 rounded-md hover:bg-white/10 group transition-colors cursor-pointer"
                                    >
                                        {track.image ? (
                                            <img
                                                src={track.image}
                                                alt={track.name}
                                                className="w-10 h-10 rounded object-cover"
                                            />
                                        ) : (
                                            <div className="w-10 h-10 rounded bg-[#282828] flex items-center justify-center">
                                                <ListMusic className="w-4 h-4 text-gray-500" />
                                            </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-white text-sm truncate">{track.name}</p>
                                            <p className="text-gray-400 text-xs truncate">{track.artist}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Credits section (simplified) */}
                    <div className="mt-6 border-t border-[#282828] pt-4">
                        <h4 className="text-white font-bold text-sm mb-3">Credits</h4>
                        <div className="text-gray-400 text-sm">
                            <p className="mb-1">
                                <span className="text-white">{currentTrack.artist}</span>
                            </p>
                            <p className="text-xs">Main Artist</p>
                        </div>
                    </div>
                </div>
            </ScrollArea>
        </div>
    )
}
