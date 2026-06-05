// YouTube Music Service — Uses YouTube Data API v3 with user's OAuth token
// Provides real account data: playlists, liked songs, subscriptions, channel info

const YT_API_BASE = 'https://www.googleapis.com/youtube/v3';

// In-memory cache with TTL (5 min)
const cache = new Map<string, { data: any; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000;

function getCached(key: string) {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
  return null;
}
function setCache(key: string, data: any) {
  cache.set(key, { data, ts: Date.now() });
}

async function ytFetch(path: string, token: string, params: Record<string, string> = {}) {
  const url = new URL(`${YT_API_BASE}/${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`YouTube API ${res.status}: ${err}`);
  }
  return res.json();
}

// Get user's YouTube channel info
export async function getMyChannel(token: string) {
  const ck = `channel:${token.slice(-8)}`;
  const cached = getCached(ck);
  if (cached) return cached;

  const data = await ytFetch('channels', token, {
    part: 'snippet,statistics,contentDetails',
    mine: 'true',
  });
  const ch = data.items?.[0];
  if (!ch) return null;
  const result = {
    id: ch.id,
    name: ch.snippet.title,
    image: ch.snippet.thumbnails?.high?.url || ch.snippet.thumbnails?.default?.url,
    subscribers: parseInt(ch.statistics.subscriberCount || '0'),
    likedPlaylistId: ch.contentDetails?.relatedPlaylists?.likes,
  };
  setCache(ck, result);
  return result;
}

// Get user's playlists
export async function getMyPlaylists(token: string, maxResults = 25) {
  const ck = `playlists:${token.slice(-8)}`;
  const cached = getCached(ck);
  if (cached) return cached;

  const data = await ytFetch('playlists', token, {
    part: 'snippet,contentDetails',
    mine: 'true',
    maxResults: String(maxResults),
  });
  const result = (data.items || []).map((p: any) => ({
    id: p.id,
    name: p.snippet.title,
    description: p.snippet.description,
    image: p.snippet.thumbnails?.high?.url || p.snippet.thumbnails?.medium?.url || p.snippet.thumbnails?.default?.url,
    trackCount: p.contentDetails?.itemCount || 0,
    owner: p.snippet.channelTitle,
  }));
  setCache(ck, result);
  return result;
}

// Get tracks from a playlist
export async function getPlaylistTracks(token: string, playlistId: string, maxResults = 50) {
  const ck = `pltracks:${playlistId}`;
  const cached = getCached(ck);
  if (cached) return cached;

  const data = await ytFetch('playlistItems', token, {
    part: 'snippet,contentDetails',
    playlistId,
    maxResults: String(maxResults),
  });
  const videoIds = (data.items || [])
    .map((i: any) => i.contentDetails?.videoId)
    .filter(Boolean);

  // Get durations
  let durMap: Record<string, number> = {};
  let viewMap: Record<string, string> = {};
  if (videoIds.length > 0) {
    const vData = await ytFetch('videos', token, {
      part: 'contentDetails,statistics',
      id: videoIds.join(','),
    });
    for (const v of vData.items || []) {
      durMap[v.id] = parseDuration(v.contentDetails.duration);
      viewMap[v.id] = v.statistics?.viewCount || '0';
    }
  }

  const result = (data.items || []).map((item: any) => {
    const vid = item.contentDetails?.videoId;
    return {
      id: vid,
      name: item.snippet.title,
      artist: item.snippet.videoOwnerChannelTitle?.replace(' - Topic', '') || '',
      artistId: item.snippet.videoOwnerChannelId || '',
      image: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.medium?.url || '',
      duration_ms: durMap[vid] || 0,
      viewCount: viewMap[vid] || '0',
      addedAt: item.snippet.publishedAt,
    };
  });
  setCache(ck, result);
  return result;
}

// Get liked videos (YouTube "Liked videos" playlist)
export async function getLikedVideos(token: string, maxResults = 50) {
  const channel = await getMyChannel(token);
  if (!channel?.likedPlaylistId) return [];
  return getPlaylistTracks(token, channel.likedPlaylistId, maxResults);
}

// Get subscriptions (channels the user follows)
export async function getSubscriptions(token: string, maxResults = 20) {
  const ck = `subs:${token.slice(-8)}`;
  const cached = getCached(ck);
  if (cached) return cached;

  const data = await ytFetch('subscriptions', token, {
    part: 'snippet',
    mine: 'true',
    maxResults: String(maxResults),
    order: 'relevance',
  });
  const result = (data.items || []).map((s: any) => ({
    id: s.snippet.resourceId.channelId,
    name: s.snippet.title,
    image: s.snippet.thumbnails?.high?.url || s.snippet.thumbnails?.default?.url,
    description: s.snippet.description,
  }));
  setCache(ck, result);
  return result;
}

// Search YouTube (music category)
export async function searchYouTube(token: string, query: string, maxResults = 20) {
  const data = await ytFetch('search', token, {
    part: 'snippet',
    q: query,
    type: 'video',
    videoCategoryId: '10', // Music category
    maxResults: String(maxResults),
  });
  const videoIds = (data.items || []).map((i: any) => i.id.videoId).filter(Boolean);

  let durMap: Record<string, number> = {};
  let viewMap: Record<string, string> = {};
  if (videoIds.length > 0) {
    const vData = await ytFetch('videos', token, {
      part: 'contentDetails,statistics',
      id: videoIds.join(','),
    });
    for (const v of vData.items || []) {
      durMap[v.id] = parseDuration(v.contentDetails.duration);
      viewMap[v.id] = v.statistics?.viewCount || '0';
    }
  }

  return (data.items || []).map((item: any) => ({
    id: item.id.videoId,
    name: item.snippet.title,
    artist: item.snippet.channelTitle?.replace(' - Topic', '') || '',
    artistId: item.snippet.channelId || '',
    image: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.medium?.url || '',
    duration_ms: durMap[item.id.videoId] || 0,
    viewCount: viewMap[item.id.videoId] || '0',
  }));
}

// Get channel/artist details
export async function getChannelDetails(token: string, channelId: string) {
  const ck = `ch:${channelId}`;
  const cached = getCached(ck);
  if (cached) return cached;

  const data = await ytFetch('channels', token, {
    part: 'snippet,statistics,brandingSettings',
    id: channelId,
  });
  const ch = data.items?.[0];
  if (!ch) return null;
  const result = {
    id: ch.id,
    name: ch.snippet.title,
    image: ch.snippet.thumbnails?.high?.url,
    banner: ch.brandingSettings?.image?.bannerExternalUrl,
    subscribers: parseInt(ch.statistics.subscriberCount || '0'),
    videoCount: parseInt(ch.statistics.videoCount || '0'),
    description: ch.snippet.description,
  };
  setCache(ck, result);
  return result;
}

// Parse ISO 8601 duration (PT4M9S → ms)
function parseDuration(iso: string): number {
  if (!iso) return 0;
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return ((parseInt(m[1] || '0') * 3600) + (parseInt(m[2] || '0') * 60) + parseInt(m[3] || '0')) * 1000;
}

// Format view count (1234567 → "1,234,567")
export function formatViewCount(count: string | number): string {
  return Number(count).toLocaleString();
}
