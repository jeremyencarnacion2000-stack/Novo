import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rl = rateLimit(`ai:search:${session.user.id}`, 20, 60_000);
    if (!rl.allowed) return rateLimitResponse(rl);

    const { query, num_results = 10 } = await request.json();
    console.log('[Web search] Authenticated request received.');

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    // Get SerpAPI key from environment
    const serpApiKey = process.env.SERPAPI_API_KEY;
    if (!serpApiKey) {
      console.error('[Web search] Provider is not configured.');
      return NextResponse.json({ error: 'SearchUnavailable', message: 'La búsqueda no está disponible en este momento.' }, { status: 503 });
    }

    // Call SerpAPI
    const serpApiUrl = `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&num=${num_results}&api_key=${serpApiKey}`;
    console.log('[Web search] Calling configured provider.');

    const response = await fetch(serpApiUrl);

    if (!response.ok) {
      console.error('[Web search] Provider request failed.', { status: response.status });
      throw new Error(`SerpAPI request failed: ${response.status}`);
    }

    const data = await response.json();
    console.log('[Web search] Provider response received.');

    // Extract relevant results
    const results = data.organic_results?.map((result: any) => ({
      title: result.title,
      link: result.link,
      snippet: result.snippet,
      display_link: result.displayed_link
    })) || [];

    console.log('[Web search] Results processed.');

    return NextResponse.json({
      query,
      results,
      total_results: data.search_information?.total_results || 0
    });

  } catch {
    console.error('[Web search] Request failed.');
    return NextResponse.json({ error: 'InternalError', message: 'No se pudo completar la búsqueda.' }, { status: 500 });
  }
}
