import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const clientId = process.env.SPOTIFY_CLIENT_ID;

  if (!clientId) {
    return new Response('Spotify client ID not configured', { status: 500 });
  }

  const baseUrl = 'https://novo-desktop-mvp.vercel.app';
  const redirectUri = `${baseUrl}/api/auth/spotify/callback`;
  const scopes = 'user-read-email user-read-private playlist-read-private user-library-read user-read-playback-state';
  // show_dialog=true forces Spotify to show the login screen every time
  const authUrl = `https://accounts.spotify.com/authorize?response_type=code&client_id=${clientId}&scope=${encodeURIComponent(scopes)}&redirect_uri=${encodeURIComponent(redirectUri)}&show_dialog=true`;

  // Return HTML page with meta refresh and JavaScript redirect
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta http-equiv="refresh" content="0;url=${authUrl}">
  <title>Redirecting to Spotify...</title>
</head>
<body>
  <p>Redirecting to Spotify...</p>
  <p>If you are not redirected, <a href="${authUrl}">click here</a>.</p>
  <script>window.location.href = "${authUrl}";</script>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html',
    },
  });
}

export async function POST(request: NextRequest) {
  return GET(request);
}
