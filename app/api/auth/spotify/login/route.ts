export async function POST(request: Request) {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  if (!clientId) {
    return new Response(JSON.stringify({ error: 'Spotify client ID not configured' }), { status: 500 });
  }
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  const redirectUri = `${baseUrl}/api/auth/spotify/callback`;
  const scopes = 'user-read-email user-read-private playlist-read-private user-library-read user-read-playback-state';
  const authUrl = `https://accounts.spotify.com/authorize?response_type=code&client_id=${clientId}&scope=${encodeURIComponent(scopes)}&redirect_uri=${encodeURIComponent(redirectUri)}`;
  return Response.redirect(authUrl);
}