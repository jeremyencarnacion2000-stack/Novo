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
  queue: CurrentTrack[]; // Queue for upcoming tracks
  accessToken: string | null; // Spotify Access Token for API calls
}

interface PlayerActions {
  playTrack: (track: CurrentTrack) => void;
  playPlaylist: (playlist: Playlist, startIndex?: number) => void;
  togglePlayPause: () => void;
  nextTrack: () => Promise<void>; // Changed to Promise
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
  addToQueue: (tracks: CurrentTrack[]) => void;
  clearQueue: () => void;
  playNext: (track: CurrentTrack) => void;
  setAutoPlay: (autoPlay: boolean) => void;
  setAccessToken: (token: string | null) => void;
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
  queue: [],
  autoPlay: true,
  accessToken: null,
}

export const usePlayerStore = create<PlayerState & PlayerActions>()(
  persist(
    (set, get) => {
      // Flag to prevent infinite loop from BroadcastChannel
      let isUpdatingFromBroadcast = false

      // Listen for BroadcastChannel messages
      if (playerChannel) {
        playerChannel.onmessage = (event) => {
          const { type, payload } = event.data
          if (type === 'PLAYER_STATE_UPDATE' && !isUpdatingFromBroadcast) {
            isUpdatingFromBroadcast = true
            set(payload)
            // Reset flag after a short delay to allow state to settle
            setTimeout(() => { isUpdatingFromBroadcast = false }, 100)
          }
        }
      }

      return {
        ...initialState,
        setAccessToken: (token) => set({ accessToken: token }),
        playTrack: (track) => {
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
        nextTrack: async () => {
          const state = get();

          // 1. First check if there are tracks in the queue
          if (state.queue.length > 0) {
            const [nextInQueue, ...remainingQueue] = state.queue;
            set({
              currentTrack: nextInQueue,
              queue: remainingQueue,
              progress: 0,
              isPlaying: true,
              isOpen: true
            });
            return;
          }

          // 2. Then check playlist
          if (state.currentPlaylist && state.currentPlaylist.tracks.length > 0) {
            let nextIndex: number;

            if (state.isShuffle) {
              // Random track (excluding current)
              const availableIndices = state.currentPlaylist.tracks
                .map((_, i) => i)
                .filter(i => i !== state.currentTrackIndex);
              nextIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)] || 0;
            } else {
              nextIndex = state.currentTrackIndex + 1;

              // Check if we've reached the end
              if (nextIndex >= state.currentPlaylist.tracks.length) {
                if (state.repeatMode === 'playlist') {
                  nextIndex = 0; // Loop back to start
                } else {
                  // End of playlist
                  // 3. Fallback to Autoplay / Recommendations
                  if (state.autoPlay && state.accessToken && state.currentTrack) {
                    try {
                      const seedTrack = state.currentTrack.id;
                      const seedArtist = state.currentTrack.artistId;

                      let url = `/api/spotify/recommendations?limit=5`;
                      if (seedTrack) url += `&seed_tracks=${seedTrack}`;
                      else if (seedArtist) url += `&seed_artists=${seedArtist}`;

                      // We need to fetch from our API route which handles the token
                      // But here we have the token in state, so we can call Spotify directly or use our API
                      // Using our API is safer if we don't want to manage token refresh here, 
                      // but we stored the token. Let's try calling our API first.

                      // Actually, we can't easily call our own API with relative path if we are on server, 
                      // but this is client-side store.

                      const response = await fetch(url);
                      if (response.ok) {
                        const data = await response.json();
                        const recommendations = data.tracks || [];
                        if (recommendations.length > 0) {
                          // Add to queue and play first
                          const [first, ...rest] = recommendations;
                          set({
                            currentTrack: first,
                            queue: rest,
                            progress: 0,
                            isPlaying: true,
                            isOpen: true,
                            // Clear playlist so we don't go back to it
                            currentPlaylist: null,
                            currentTrackIndex: 0
                          });
                          return;
                        }
                      }
                    } catch (e) {
                      console.error("Failed to fetch recommendations", e);
                    }
                  }

                  set({ isPlaying: false, progress: 0 });
                  return;
                }
              }
            }

            set({
              currentTrack: state.currentPlaylist.tracks[nextIndex],
              currentTrackIndex: nextIndex,
              progress: 0,
              isPlaying: true
            });
            return;
          }

          // 4. No playlist, but we have a current track (Single track mode) -> Fetch recommendations
          if (state.autoPlay && state.accessToken && state.currentTrack) {
            try {
              const seedTrack = state.currentTrack.id;
              const seedArtist = state.currentTrack.artistId;

              let url = `/api/spotify/recommendations?limit=5`;
              if (seedTrack) url += `&seed_tracks=${seedTrack}`;
              else if (seedArtist) url += `&seed_artists=${seedArtist}`;

              const response = await fetch(url);
              if (response.ok) {
                const data = await response.json();
                const recommendations = data.tracks || [];
                if (recommendations.length > 0) {
                  const [first, ...rest] = recommendations;
                  set({
                    currentTrack: first,
                    queue: rest,
                    progress: 0,
                    isPlaying: true,
                    isOpen: true
                  });
                  return;
                }
              }
            } catch (e) {
              console.error("Failed to fetch recommendations", e);
            }
          }

          set({ isPlaying: false, progress: 0 });
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
        addToQueue: (tracks) => {
          set((state) => ({
            queue: [...state.queue, ...tracks]
          }));
        },
        clearQueue: () => {
          set({ queue: [] });
        },
        playNext: (track) => {
          set((state) => ({
            queue: [track, ...state.queue]
          }));
        },
        setAutoPlay: (autoPlay) => {
          set({ autoPlay });
        },
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
        accessToken: state.accessToken, // Persist token
      }),
    }
  )
)