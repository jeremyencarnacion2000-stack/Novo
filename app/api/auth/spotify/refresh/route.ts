export async function POST(request: Request) {
  const cookies = request.headers.get('cookie') || '';
  const refreshToken = cookies.split(';').find(c => c.trim().startsWith('spotify_refresh_token='))?.split('=')[1];
  if (!refreshToken) {
    return new Response(JSON.stringify({ error: 'No refresh token' }), { status: 401 });
  }
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return new Response(JSON.stringify({ error: 'Spotify credentials not configured' }), { status: 500 });
  }
  try {
    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(clientId + ':' + clientSecret).toString('base64')
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      })
    });
    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok) {
      return new Response(JSON.stringify({ error: tokenData }), { status: tokenResponse.status });
    }
    const response = new Response(JSON.stringify({ success: true }), { status: 200 });
    response.headers.set('Set-Cookie', `spotify_access_token=${tokenData.access_token}; HttpOnly; Secure; SameSite=Strict; Max-Age=${tokenData.expires_in}`);
    if (tokenData.refresh_token) {
      response.headers.append('Set-Cookie', `spotify_refresh_token=${tokenData.refresh_token}; HttpOnly; Secure; SameSite=Strict; Max-Age=31536000`);
    }
    return response;
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
}