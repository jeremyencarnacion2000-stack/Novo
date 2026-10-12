/** @jest-environment node */

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/ytmusic', () => ({ getYTMusic: jest.fn() }))

import { getServerSession } from 'next-auth'
import { getYTMusic } from '@/lib/ytmusic'
import { GET as getSearch } from './search/route'
import { GET as getTop } from './top/route'
import { GET as getRecommendations } from './recommendations/route'
import { GET as getAlbum } from './album/[id]/route'
import { GET as getArtist } from './artist/[id]/route'
import { GET as getPlaylistTracks } from './playlists/[id]/tracks/route'
import { GET as getHome } from './home/route'
import { GET as getYoutubeSearch } from '../youtube/search/route'

describe('authenticated YouTube Music read routes', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getServerSession as jest.Mock).mockResolvedValue(null)
  })

  it.each([
    ['search', () => getSearch(new Request('http://localhost/api/ytmusic/search?q=novo'))],
    ['top', () => getTop()],
    ['recommendations', () => getRecommendations(new Request('http://localhost/api/ytmusic/recommendations'))],
    ['album', () => getAlbum(new Request('http://localhost/api/ytmusic/album/a'), { params: Promise.resolve({ id: 'a' }) })],
    ['artist', () => getArtist(new Request('http://localhost/api/ytmusic/artist/a'), { params: Promise.resolve({ id: 'a' }) })],
    ['playlist tracks', () => getPlaylistTracks(new Request('http://localhost/api/ytmusic/playlists/a/tracks'), { params: Promise.resolve({ id: 'a' }) })],
    ['home', () => getHome()],
    ['YouTube search', () => getYoutubeSearch(new Request('http://localhost/api/youtube/search?q=novo'))],
  ])('returns 401 before provider work for %s', async (_name, invoke) => {
    const response = await invoke()

    expect(response.status).toBe(401)
    expect(getYTMusic).not.toHaveBeenCalled()
  })

  it('normalizes search limits and trims the query before provider work', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
    ;(getYTMusic as jest.Mock).mockResolvedValue({
      searchSongs: jest.fn().mockResolvedValue([]),
    })

    const response = await getSearch(new Request('http://localhost/api/ytmusic/search?q=%20novo%20&limit=-50'))

    expect(response.status).toBe(200)
    const client = await (getYTMusic as jest.Mock).mock.results[0].value
    expect(client.searchSongs).toHaveBeenCalledWith('novo')
  })

  it('rejects an oversized YouTube query before loading the provider', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
    const oversized = 'x'.repeat(201)

    const response = await getYoutubeSearch(new Request(`http://localhost/api/youtube/search?q=${oversized}`))

    expect(response.status).toBe(400)
    expect(getYTMusic).not.toHaveBeenCalled()
  })

  it('caps recommendation results before mapping the provider response', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
    const songs = Array.from({ length: 60 }, (_, index) => ({
      videoId: `video-${index % 30}`,
      name: `Track ${index}`,
      artist: { name: 'Artist', artistId: 'artist-1' },
      duration: 180,
      thumbnails: [],
    }))
    const searchSongs = jest.fn().mockResolvedValue(songs)
    ;(getYTMusic as jest.Mock).mockResolvedValue({ searchSongs })

    const response = await getRecommendations(new Request('http://localhost/api/ytmusic/recommendations?limit=999999'))
    expect(response.status).toBe(200)
    const firstPayload = await response.json()
    expect(firstPayload.tracks).toHaveLength(30)
    expect(new Set(firstPayload.tracks.map((track: { id: string }) => track.id)).size).toBe(30)
    expect(searchSongs).toHaveBeenCalledWith('trending songs 2024 hits')
    const payload = await getRecommendations(new Request('http://localhost/api/ytmusic/recommendations?limit=1'))
    const secondPayload = await payload.json()
    expect(secondPayload.tracks).toHaveLength(1)
  })
})
