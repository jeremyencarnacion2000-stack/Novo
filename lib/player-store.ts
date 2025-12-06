import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// BroadcastChannel for cross-tab synchronization
const playerChannel = typeof window !== 'undefined' ? new BroadcastChannel('player-state') : null

export interface CurrentTrack {
  id: string;
  uri: string; // Spotify URI for playback
  name: string;
  artist: string;
  artistId?: string; // Spotify artist ID for continuous playback
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
  deviceId: string | null; // Spotify Web Playback SDK device ID
  isReady: boolean; // Whether the Spotify SDK is ready
  isShuffle: boolean; // Shuffle mode
  repeatMode: 'off' | 'track' | 'playlist'; // Repeat mode
}

interface PlayerActions {
  playTrack: (track: CurrentTrack) => void;
  playPlaylist: (playlist: Playlist, startIndex?: number) => void;
  togglePlayPause: () => void;
  nextTrack: () => void;
  previousTrack: () => void;
  setVolume: (volume: number) => void;
  setProgress: (progress: number) => void;
  seekTo: (position: number) => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  toggleOpen: () => void;
  setOpen: (isOpen: boolean) => void;
  setDeviceId: (deviceId: string) => void;
  setReady: (isReady: boolean) => void;
  resetPlayer: () => void;
}

const initialState: PlayerState = {
  currentTrack: null,
  currentPlaylist: null,
  currentTrackIndex: 0,
  isPlaying: false,
  volume: 0.5,
  isOpen: false,
  progress: 0,
  deviceId: null,
  isReady: false,
  isShuffle: false,
  repeatMode: 'off',
}

export const usePlayerStore = create<PlayerState & PlayerActions>()(
  persist(
    (set, get) => {
      // Listen for BroadcastChannel messages
      if (playerChannel) {
        playerChannel.onmessage = (event) => {
          const { type, payload } = event.data
          if (type === 'PLAYER_STATE_UPDATE') {
            set(payload)
          }
        }
      }

      return {
        ...initialState,
        playTrack: (track) => {
          console.log('playTrack called with:', track.name, 'Setting isOpen to true')
          set((state) => {
            const updatedState = {
              ...state,
              currentTrack: track,
              currentPlaylist: null,
              currentTrackIndex: 0,
              isPlaying: true,
              isOpen: true,
              progress: 0
            };
            console.log('playTrack updatedState:', { isOpen: updatedState.isOpen, currentTrack: updatedState.currentTrack?.name })
            if (playerChannel) {
              playerChannel.postMessage({
                type: 'PLAYER_STATE_UPDATE',
                payload: {
                  currentTrack: updatedState.currentTrack,
                  currentPlaylist: updatedState.currentPlaylist,
                  currentTrackIndex: updatedState.currentTrackIndex,
                  isPlaying: updatedState.isPlaying,
                  isOpen: updatedState.isOpen,
                  progress: updatedState.progress,
                  volume: updatedState.volume,
                }
              });
            }
            return updatedState;
          });
        },
        playPlaylist: (playlist, startIndex = 0) => {
          console.log('playPlaylist called with:', playlist.name, 'startIndex:', startIndex, 'Setting isOpen to true')
          set((state) => {
            const updatedState = {
              ...state,
              currentPlaylist: playlist,
              currentTrack: playlist.tracks[startIndex] || null,
              currentTrackIndex: startIndex,
              isPlaying: true,
              isOpen: true,
              progress: 0
            };
            console.log('playPlaylist updatedState:', { isOpen: updatedState.isOpen, currentTrack: updatedState.currentTrack?.name })
            if (playerChannel) {
              playerChannel.postMessage({
                type: 'PLAYER_STATE_UPDATE',
                payload: {
                  currentPlaylist: updatedState.currentPlaylist,
                  currentTrack: updatedState.currentTrack,
                  currentTrackIndex: updatedState.currentTrackIndex,
                  isPlaying: updatedState.isPlaying,
                  isOpen: updatedState.isOpen,
                  progress: updatedState.progress,
                  volume: updatedState.volume,
                }
              });
            }
            return updatedState;
          });
        },
        nextTrack: () => {
          const state = get();
          if (state.currentPlaylist && state.currentPlaylist.tracks.length > 0) {
            let nextIndex: number;

            if (state.isShuffle) {
              // Random track (excluding current)
              const availableIndices = state.currentPlaylist.tracks
                .map((_, i) => i)
                .filter(i => i !== state.currentTrackIndex);
              nextIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)] || 0;
            } else {
              nextIndex = (state.currentTrackIndex + 1) % state.currentPlaylist.tracks.length;
            }

            set({
              currentTrack: state.currentPlaylist.tracks[nextIndex],
              currentTrackIndex: nextIndex,
              progress: 0,
              isPlaying: true
            });
          }
        },
        previousTrack: () => {
          const state = get();
          // If more than 3 seconds into track, restart it
          if (state.progress > 3000) {
            set({ progress: 0 });
            return;
          }

          if (state.currentPlaylist && state.currentPlaylist.tracks.length > 0) {
            const prevIndex = state.currentTrackIndex === 0
              ? state.currentPlaylist.tracks.length - 1
              : state.currentTrackIndex - 1;
            set({
              currentTrack: state.currentPlaylist.tracks[prevIndex],
              currentTrackIndex: prevIndex,
              progress: 0,
              isPlaying: true
            });
          }
        },
        togglePlayPause: () => {
          set((state) => {
            const updatedState = { ...state, isPlaying: !state.isPlaying };
            if (playerChannel) {
              playerChannel.postMessage({
                type: 'PLAYER_STATE_UPDATE',
                payload: {
                  currentTrack: updatedState.currentTrack,
                  currentPlaylist: updatedState.currentPlaylist,
                  currentTrackIndex: updatedState.currentTrackIndex,
                  isPlaying: updatedState.isPlaying,
                  isOpen: updatedState.isOpen,
                  progress: updatedState.progress,
                  volume: updatedState.volume,
                }
              });
            }
            return updatedState;
          });
        },
        setVolume: (volume) => {
          set({ volume });
        },
        setProgress: (progress) => {
          set({ progress });
        },
        seekTo: (position) => {
          set({ progress: position });
        },
        toggleShuffle: () => {
          set((state) => ({ isShuffle: !state.isShuffle }));
        },
        toggleRepeat: () => {
          set((state) => {
            const modes: Array<'off' | 'track' | 'playlist'> = ['off', 'playlist', 'track'];
            const currentIndex = modes.indexOf(state.repeatMode);
            const nextIndex = (currentIndex + 1) % modes.length;
            return { repeatMode: modes[nextIndex] };
          });
        },
        toggleOpen: () => set((state) => ({ isOpen: !state.isOpen })),
        setOpen: (isOpen) => set({ isOpen }),
        setDeviceId: (deviceId) => set({ deviceId }),
        setReady: (isReady) => set({ isReady }),
        resetPlayer: () => set(initialState),
      }
    },
    {
      name: 'novo-player',
      partialize: (state) => ({
        currentTrack: state.currentTrack,
        currentPlaylist: state.currentPlaylist,
        currentTrackIndex: state.currentTrackIndex,
        volume: state.volume,
        isOpen: state.isOpen,
        isShuffle: state.isShuffle,
        repeatMode: state.repeatMode,
      }),
    }
  )
)