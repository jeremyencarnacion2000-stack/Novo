import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  // Show errors as HTML for debugging
  if (error) {
    const html = `<!DOCTYPE html>
<html><head><title>Spotify Error</title></head>
<body style="font-family: sans-serif; padding: 40px; background: #121212; color: white;">
  <h1>Spotify Authorization Error</h1>
  <p>Error: ${error}</p>
  <p>Error description: ${url.searchParams.get('error_description') || 'No description'}</p>
  <p><a href="/music" style="color: #1DB954;">Go back to Music</a></p>
</body></html>`;
    return new Response(html, { status: 400, headers: { 'Content-Type': 'text/html' } });
  }

  if (!code) {
    const html = `<!DOCTYPE html>
<html><head><title>Spotify Error</title></head>
<body style="font-family: sans-serif; padding: 40px; background: #121212; color: white;">
  <h1>No Authorization Code</h1>
  <p>No code was provided by Spotify.</p>
  <p><a href="/music" style="color: #1DB954;">Go back to Music</a></p>
</body></html>`;
    return new Response(html, { status: 400, headers: { 'Content-Type': 'text/html' } });
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    const html = `<!DOCTYPE html>
<html><head><title>Config Error</title></head>
<body style="font-family: sans-serif; padding: 40px; background: #121212; color: white;">
  <h1>Configuration Error</h1>
  <p>Spotify credentials not configured on server.</p>
</body></html>`;
    return new Response(html, { status: 500, headers: { 'Content-Type': 'text/html' } });
  }

  const baseUrl = 'https://novo-desktop-mvp.vercel.app';
  const redirectUri = `${baseUrl}/api/auth/spotify/callback`;

  console.log('Spotify callback - exchanging code for tokens');

  try {
    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(clientId + ':' + clientSecret).toString('base64')
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri
      })
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error('Spotify token error:', tokenData);
      const html = `<!DOCTYPE html>
<html><head><title>Token Error</title></head>
<body style="font-family: sans-serif; padding: 40px; background: #121212; color: white;">
  <h1>Spotify Token Error</h1>
  <p>Error: ${tokenData.error || 'Unknown'}</p>
  <p>Description: ${tokenData.error_description || 'No description'}</p>
  <p>Redirect URI used: ${redirectUri}</p>
  <p><a href="/music" style="color: #1DB954;">Go back to Music</a></p>
</body></html>`;
      return new Response(html, { status: tokenResponse.status, headers: { 'Content-Type': 'text/html' } });
    }

    console.log('Spotify tokens obtained successfully');
    console.log('Token length:', tokenData.access_token?.length);

    // URL encode the token to prevent cookie corruption
    const encodedAccessToken = encodeURIComponent(tokenData.access_token);
    const encodedRefreshToken = tokenData.refresh_token ? encodeURIComponent(tokenData.refresh_token) : null;

    // Redirect with cookies set directly in headers
    const musicUrl = new URL('/music', request.url);

    // Build Set-Cookie headers
    const accessTokenCookie = `spotify_access_token=${encodedAccessToken}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${tokenData.expires_in}`;
    const refreshTokenCookie = encodedRefreshToken
      ? `spotify_refresh_token=${encodedRefreshToken}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=31536000`
      : null;

    const headers = new Headers();
    headers.set('Location', musicUrl.toString());
    headers.append('Set-Cookie', accessTokenCookie);
    if (refreshTokenCookie) {
      headers.append('Set-Cookie', refreshTokenCookie);
    }

    console.log('Setting cookies and redirecting');

    return new Response(null, {
      status: 302,
      headers
    });
  } catch (err: any) {
    console.error('Spotify callback error:', err);
    const html = `<!DOCTYPE html>
<html><head><title>Server Error</title></head>
<body style="font-family: sans-serif; padding: 40px; background: #121212; color: white;">
  <h1>Server Error</h1>
  <p>Error: ${err.message || 'Unknown error'}</p>
  <p><a href="/music" style="color: #1DB954;">Go back to Music</a></p>
</body></html>`;
    return new Response(html, { status: 500, headers: { 'Content-Type': 'text/html' } });
  }
}
