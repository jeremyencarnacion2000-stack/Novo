import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { MusicAlgorithm } from './music-algorithm'

// BroadcastChannel for cross-tab synchronization
const playerChannel = typeof window !== 'undefined' ? new BroadcastChannel('player-state') : null

export interface CurrentTrack {
  id: string; // YouTube Video ID
  uri: string; // Fallback or direct YT Video ID
  name: string;
  artist: string;
  artistId?: string; // YT Music channel/artist ID
  albumId?: string; // YT Music playlist/album ID
  image: string | undefined;
  duration_ms?: number;
}

export interface Playlist {
  id: string;
  name: string;
  tracks: CurrentTrack[];
}

export interface PlayerState {
  currentTrack: CurrentTrack | null;
  currentPlaylist: Playlist | null;
  currentTrackIndex: number;
  isPlaying: boolean;
  volume: number;
  isOpen: boolean;
  progress: number; // Current position in milliseconds
  isReady: boolean; // Whether the YouTube IFrame SDK is ready
  isShuffle: boolean; // Shuffle mode
  repeatMode: 'off' | 'track' | 'playlist'; // Repeat mode
  queue: CurrentTrack[]; // Queue for upcoming tracks
  autoPlay: boolean; // Automatic playback of next tracks
  playHistory: string[]; // History for similarity algorithm
  likedTracks: string[]; // List of liked track IDs
  followedArtists: string[]; // List of followed artist IDs
  recommendations: CurrentTrack[]; // Radio mode recommendations
}

export interface PlayerActions {
  playTrack: (track: CurrentTrack) => Promise<void>;
  playPlaylist: (playlist: Playlist, startIndex?: number) => void;
  togglePlayPause: () => Promise<void>;
  nextTrack: () => Promise<void>; 
  previousTrack: () => Promise<void>;
  setVolume: (volume: number) => void;
  setProgress: (progress: number) => void;
  seekTo: (position: number) => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  toggleOpen: () => void;
  setOpen: (isOpen: boolean) => void;
  setReady: (isReady: boolean) => void;
  resetPlayer: () => void;
  addToQueue: (tracks: CurrentTrack[]) => void;
  clearQueue: () => void;
  playNext: (track: CurrentTrack) => void;
  setAutoPlay: (autoPlay: boolean) => void;
  syncWithSDK: (track: CurrentTrack, isPlaying: boolean, progress: number) => void;
  toggleLike: (track: any) => void;
  setLikedTracks: (ids: string[]) => void;
  toggleFollow: (artistId: string, artistName: string, imageUrl: string) => Promise<void>;
  setFollowedArtists: (artistIds: string[]) => void;
  fetchAutoplayQueue: (track: CurrentTrack) => Promise<void>;
  clearRecommendations: () => void;
}

const initialState: PlayerState = {
  currentTrack: null,
  currentPlaylist: null,
  currentTrackIndex: 0,
  isPlaying: false,
  volume: 0.5,
  isOpen: false,
  progress: 0,
  isReady: false,
  isShuffle: false,
  repeatMode: 'off',
  queue: [],
  autoPlay: true,
  playHistory: [],
  likedTracks: [],
  followedArtists: [],
  recommendations: [],
}

export const usePlayerStore = create<PlayerState & PlayerActions>()(
  persist(
    (set, get) => {
      // Flag to prevent infinite loop from BroadcastChannel
      let isUpdatingFromBroadcast = false

      // Listen for BroadcastChannel messages
      if (typeof window !== 'undefined' && playerChannel) {
        playerChannel.onmessage = (event) => {
          const { type, payload } = event.data
          if (type === 'PLAYER_STATE_UPDATE' && !isUpdatingFromBroadcast) {
            isUpdatingFromBroadcast = true
            set(payload)
            setTimeout(() => { isUpdatingFromBroadcast = false }, 100)
          }
        }
      }

      return {
        ...initialState,

        playTrack: async (track: CurrentTrack) => {
          const state = get()
          set({
            currentTrack: track,
            currentPlaylist: null,
            currentTrackIndex: 0,
            isPlaying: true,
            isOpen: true,
            progress: 0,
            queue: [],
            recommendations: []
          })

          if (playerChannel) {
            playerChannel.postMessage({
              type: 'PLAYER_STATE_UPDATE',
              payload: {
                currentTrack: track,
                currentPlaylist: null,
                isPlaying: true,
                isOpen: true,
                progress: 0,
                queue: [],
                recommendations: []
              }
            })
          }

          if (state.autoPlay) {
            await get().fetchAutoplayQueue(track)
          }

          // Sync with centralized status API
          fetch('/api/ytmusic/status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              currentTrack: track,
              isPlaying: true,
              progress: 0
            })
          }).catch(e => console.error("Status sync failed", e))
        },

        playPlaylist: (playlist: Playlist, startIndex: number = 0) => {
          const track = playlist.tracks[startIndex] || null
          set({
            currentPlaylist: playlist,
            currentTrack: track,
            currentTrackIndex: startIndex,
            isPlaying: true,
            isOpen: true,
            progress: 0,
            queue: [],
            recommendations: []
          })

          if (playerChannel) {
            playerChannel.postMessage({
              type: 'PLAYER_STATE_UPDATE',
              payload: {
                currentPlaylist: playlist,
                currentTrack: track,
                currentTrackIndex: startIndex,
                isPlaying: true,
                isOpen: true,
                progress: 0,
                queue: [],
                recommendations: []
              }
            })
          }
        },

        nextTrack: async () => {
          const state = get()
          if (state.currentTrack) {
            set((s) => ({
              playHistory: [state.currentTrack!.id, ...s.playHistory].slice(0, 50)
            }))
          }

          // 1. Queue
          if (state.queue.length > 0) {
            const [nextInQueue, ...remainingQueue] = state.queue
            set({
              currentTrack: nextInQueue,
              queue: remainingQueue,
              progress: 0,
              isPlaying: true
            })
            return
          }

          // 2. Playlist (Album Sequence)
          if (state.currentPlaylist && state.currentPlaylist.tracks.length > 0) {
            let nextIndex = state.currentTrackIndex + 1
            if (state.isShuffle) {
              const available = state.currentPlaylist.tracks.length
              nextIndex = Math.floor(Math.random() * available)
            }

            if (nextIndex < state.currentPlaylist.tracks.length) {
              const nextTrack = state.currentPlaylist.tracks[nextIndex]
              set({
                currentTrack: nextTrack,
                currentTrackIndex: nextIndex,
                progress: 0,
                isPlaying: true
              })
              return
            } else {
              // Playlist finished
              if (state.repeatMode === 'playlist') {
                set({
                  currentTrack: state.currentPlaylist.tracks[0],
                  currentTrackIndex: 0,
                  progress: 0,
                  isPlaying: true
                })
                return
              }
              // If not repeating, fall through to recommendations (Radio mode)
              set({ currentPlaylist: null })
            }
          }

          // 3. Automated Recommendations (Radio Mode)
          if (state.recommendations.length > 0) {
            const [nextRec, ...remainingRecs] = state.recommendations
            set({
              currentTrack: nextRec,
              recommendations: remainingRecs,
              progress: 0,
              isPlaying: true
            })
            
            // Refill recommendations if running low
            if (remainingRecs.length < 3 && state.autoPlay) {
              get().fetchAutoplayQueue(nextRec)
            }
            return
          }

          // 4. If nothing left, try to fetch new recommendations
          if (state.autoPlay && state.currentTrack) {
            await get().fetchAutoplayQueue(state.currentTrack)
            const newState = get()
            if (newState.recommendations.length > 0) {
              const [nextRec, ...remainingRecs] = newState.recommendations
              set({
                currentTrack: nextRec,
                recommendations: remainingRecs,
                progress: 0,
                isPlaying: true
              })
              return
            }
          }

          set({ isPlaying: false, progress: 0 })

          // Sync with centralized status API
          fetch('/api/ytmusic/status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              currentTrack: state.currentTrack,
              isPlaying: state.isPlaying,
              progress: state.progress
            })
          }).catch(e => console.error("Status sync failed", e))
        },

        fetchAutoplayQueue: async (track: CurrentTrack) => {
          const state = get()
          if (!track.id) return
          
          try {
            let url = `/api/ytmusic/recommendations?limit=15&seed_tracks=${track.id}`
            if (track.artistId) url += `&seed_artists=${track.artistId}`

            const response = await fetch(url)
            if (response.ok) {
              const data = await response.json()
              let recommendations = data.tracks || []
              
              recommendations = recommendations.filter((t: any) => 
                t.id !== track.id && 
                !state.queue.some((q) => q.id === t.id) &&
                !state.playHistory.includes(t.id)
              )

              if (recommendations.length > 0) {
                set((s) => ({
                  recommendations: [...s.recommendations, ...recommendations].slice(0, 30)
                }))
              }
            }
          } catch (e) {
            console.error("PlayerStore: Autoplay fetch failed", e)
          }
        },

        previousTrack: async () => {
          const state = get()
          if (state.progress > 5000) {
            set({ progress: 0 })
            return
          }

          if (state.currentPlaylist && state.currentPlaylist.tracks.length > 0) {
            const prevIndex = (state.currentTrackIndex - 1 + state.currentPlaylist.tracks.length) % state.currentPlaylist.tracks.length
            set({
              currentTrack: state.currentPlaylist.tracks[prevIndex],
              currentTrackIndex: prevIndex,
              progress: 0,
              isPlaying: true
            })
          }
        },

        togglePlayPause: async () => {
          const isPlaying = !get().isPlaying
          set({ isPlaying })
          if (playerChannel) {
            playerChannel.postMessage({
              type: 'PLAYER_STATE_UPDATE',
              payload: { isPlaying }
            })
          }

          // Sync with centralized status API
          fetch('/api/ytmusic/status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              currentTrack: get().currentTrack,
              isPlaying: isPlaying,
              progress: get().progress
            })
          }).catch(e => console.error("Status sync failed", e))
        },

        setVolume: (volume: number) => set({ volume }),
        setProgress: (progress: number) => set({ progress }),
        seekTo: (position: number) => set({ progress: position }),
        toggleShuffle: () => set((s) => ({ isShuffle: !s.isShuffle })),
        toggleRepeat: () => set((s) => {
          const modes: Array<'off' | 'playlist' | 'track'> = ['off', 'playlist', 'track']
          const next = modes[(modes.indexOf(s.repeatMode) + 1) % modes.length]
          return { repeatMode: next }
        }),
        toggleOpen: () => set((s) => ({ isOpen: !s.isOpen })),
        setOpen: (isOpen: boolean) => set({ isOpen }),
        setReady: (isReady: boolean) => set({ isReady }),
        resetPlayer: () => set(initialState),
        addToQueue: (tracks: CurrentTrack[]) => set((s) => ({ queue: [...s.queue, ...tracks] })),
        clearQueue: () => set({ queue: [] }),
        playNext: (track: CurrentTrack) => set((s) => ({ queue: [track, ...s.queue] })),
        setAutoPlay: (autoPlay: boolean) => set({ autoPlay }),
        
        syncWithSDK: (track, isPlaying, progress) => {
          const state = get()
          if (state.currentTrack?.id !== track.id || state.isPlaying !== isPlaying || Math.abs(state.progress - progress) > 5000) {
            set({ currentTrack: track, isPlaying, progress })
          }
        },

        toggleLike: (track: any) => {
          const state = get()
          if (!track) return

          const trackId = typeof track === 'string' ? track : (track.id || track.videoId || track.trackId)
          if (!trackId) return

          const isLiked = state.likedTracks.includes(trackId)
          
          set((s) => ({
            likedTracks: isLiked 
              ? s.likedTracks.filter(id => id !== trackId)
              : [...s.likedTracks, trackId]
          }))

          const name = track.name || track.title || state.currentTrack?.name || 'Unknown'
          const artist = track.artist || (track.artists?.[0]?.name) || state.currentTrack?.artist || 'Unknown'
          const artistId = track.artistId || (track.artists?.[0]?.id) || state.currentTrack?.artistId || ''
          const album = track.album?.name || track.album || state.currentTrack?.albumId || ''
          const thumbnail = track.image || track.thumbnail || track.thumbnails?.[0]?.url || track.album?.images?.[0]?.url || state.currentTrack?.image || ''
          const duration = track.duration_ms || track.duration || state.currentTrack?.duration_ms || 0

          fetch('/api/music/liked', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              trackId,
              action: isLiked ? 'remove' : 'add',
              title: name,
              artist: artist,
              artistId: artistId,
              album: album,
              thumbnail: thumbnail,
              duration: duration
            })
          }).catch(e => console.error("Like sync failed", e))
        },

        toggleFollow: async (artistId, artistName, imageUrl) => {
          const isFollowing = get().followedArtists.includes(artistId)
          try {
            const res = await fetch('/api/music/follow', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ artistId, artistName, imageUrl, action: isFollowing ? 'unfollow' : 'follow' })
            })
            if (res.ok) {
              set((s) => ({
                followedArtists: isFollowing 
                  ? s.followedArtists.filter(id => id !== artistId)
                  : [...s.followedArtists, artistId]
              }))
            }
          } catch (e) {
            console.error("Follow sync failed", e)
          }
        },
        setFollowedArtists: (artistIds) => set({ followedArtists: artistIds }),
        setLikedTracks: (ids) => set({ likedTracks: ids }),
        clearRecommendations: () => set({ recommendations: [] }),
      }
    },
    {
      name: 'novo-player-v2',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        volume: state.volume,
        isShuffle: state.isShuffle,
        repeatMode: state.repeatMode,
        playHistory: state.playHistory,
        likedTracks: state.likedTracks,
        followedArtists: state.followedArtists,
      }),
    }
  )
)