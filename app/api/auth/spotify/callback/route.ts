export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');
  if (error) {
    return new Response(JSON.stringify({ error }), { status: 400 });
  }
  if (!code) {
    return new Response(JSON.stringify({ error: 'No code provided' }), { status: 400 });
  }
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return new Response(JSON.stringify({ error: 'Spotify credentials not configured' }), { status: 500 });
  }
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  const redirectUri = `${baseUrl}/api/auth/spotify/callback`;
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
      return new Response(JSON.stringify({ error: tokenData }), { status: tokenResponse.status });
    }
    // Guardar en cookies HTTP-only
    console.log('DEBUG: /api/auth/spotify/callback - Tokens obtenidos:', { access: !!tokenData.access_token, refresh: !!tokenData.refresh_token, expires: tokenData.expires_in });
    const response = new Response(null, { status: 302 });
    response.headers.set('Location', '/music');
    response.headers.set('Set-Cookie', `spotify_access_token=${tokenData.access_token}; HttpOnly; Secure; SameSite=Strict; Max-Age=${tokenData.expires_in}`);
    response.headers.append('Set-Cookie', `spotify_refresh_token=${tokenData.refresh_token}; HttpOnly; Secure; SameSite=Strict; Max-Age=31536000`);
    console.log('DEBUG: /api/auth/spotify/callback - Cookies guardadas, redirigiendo a /music');
    return response;
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
}