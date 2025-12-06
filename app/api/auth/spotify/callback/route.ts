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
  <p>Client ID: ${clientId ? 'Set' : 'Not set'}</p>
  <p>Client Secret: ${clientSecret ? 'Set' : 'Not set'}</p>
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
  <p>Status: ${tokenResponse.status}</p>
  <p><a href="/music" style="color: #1DB954;">Go back to Music</a></p>
</body></html>`;
      return new Response(html, { status: tokenResponse.status, headers: { 'Content-Type': 'text/html' } });
    }

    console.log('Spotify tokens obtained successfully');

    // Show success page with auto-redirect
    const successHtml = `<!DOCTYPE html>
<html>
<head>
  <title>Spotify Connected!</title>
  <meta http-equiv="refresh" content="2;url=/music">
</head>
<body style="font-family: sans-serif; padding: 40px; background: #121212; color: white; text-align: center;">
  <h1 style="color: #1DB954;">✓ Spotify Connected!</h1>
  <p>Token received successfully.</p>
  <p>Redirecting to music page...</p>
  <p style="margin-top: 20px;"><a href="/music" style="color: #1DB954;">Click here if not redirected</a></p>
</body>
</html>`;

    // Create response with success page
    const response = new NextResponse(successHtml, {
      status: 200,
      headers: { 'Content-Type': 'text/html' }
    });

    // Set cookies
    response.cookies.set('spotify_access_token', tokenData.access_token, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: tokenData.expires_in
    });

    if (tokenData.refresh_token) {
      response.cookies.set('spotify_refresh_token', tokenData.refresh_token, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 31536000 // 1 year
      });
    }

    return response;
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
