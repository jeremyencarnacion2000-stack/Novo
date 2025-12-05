import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { query, num_results = 10 } = await request.json();
    console.log('Web search request:', { query, num_results });

    if (!query) {
      console.error('Web search: Query is required');
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    // Get SerpAPI key from environment
    const serpApiKey = process.env.SERPAPI_API_KEY;
    if (!serpApiKey) {
      console.error('Web search: SerpAPI key not configured in environment variables');
      return NextResponse.json({ error: 'SerpAPI key not configured' }, { status: 500 });
    }

    // Call SerpAPI
    const serpApiUrl = `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&num=${num_results}&api_key=${serpApiKey}`;
    console.log('Calling SerpAPI:', serpApiUrl.replace(serpApiKey, '[REDACTED]'));

    const response = await fetch(serpApiUrl);

    if (!response.ok) {
      console.error('SerpAPI request failed:', response.status, await response.text());
      throw new Error(`SerpAPI request failed: ${response.status}`);
    }

    const data = await response.json();
    console.log('SerpAPI response received, results count:', data.organic_results?.length || 0);

    // Extract relevant results
    const results = data.organic_results?.map((result: any) => ({
      title: result.title,
      link: result.link,
      snippet: result.snippet,
      display_link: result.displayed_link
    })) || [];

    console.log('Processed results:', results.length);

    return NextResponse.json({
      query,
      results,
      total_results: data.search_information?.total_results || 0
    });

  } catch (error) {
    console.error('Web search error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}