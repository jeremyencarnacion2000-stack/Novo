import { NextRequest, NextResponse } from 'next/server';
import { GrokAPIClient } from '@/lib/grok';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rl = rateLimit(`ai:grok:${session.user.id}`, 15, 60_000);
    if (!rl.allowed) return rateLimitResponse(rl);

    const body = await request.json();
    const { message, context, history, systemPrompt, tools } = body;

    const client = GrokAPIClient.getInstance();
    const result = await client.generateResponse(message, context, history, systemPrompt, tools);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in Grok chat route:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
