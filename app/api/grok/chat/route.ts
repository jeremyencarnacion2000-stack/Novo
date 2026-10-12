import { NextRequest, NextResponse } from 'next/server';
import { GrokAPIClient, type GrokTool } from '@/lib/grok';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { z } from 'zod';

const MAX_GROK_BODY_BYTES = 2_000_000;
const grokToolSchema = z.object({
  type: z.literal('function'),
  function: z.object({
    name: z.string().trim().min(1).max(200),
    description: z.string().max(4_000),
    parameters: z.object({
      type: z.literal('object'),
      properties: z.record(z.string(), z.unknown()),
      required: z.array(z.string().max(200)).max(100),
    }).strict(),
  }).strict(),
}).strict();
const grokChatRequestSchema = z.object({
  message: z.string().trim().min(1).max(12_000),
  context: z.string().max(24_000).default(''),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().max(12_000),
    id: z.string().max(200).optional(),
    timestamp: z.string().max(100).optional(),
  })).max(40).default([]),
  systemPrompt: z.string().max(12_000).optional(),
  tools: z.array(grokToolSchema).max(32).optional(),
}).strict();

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rl = rateLimit(`ai:grok:${session.user.id}`, 15, 60_000);
    if (!rl.allowed) return rateLimitResponse(rl);

    const contentLength = Number(request.headers.get('content-length'));
    if (Number.isFinite(contentLength) && contentLength > MAX_GROK_BODY_BYTES) {
      return NextResponse.json({ error: 'Chat payload is too large' }, { status: 413 });
    }

    const parsedRequest = grokChatRequestSchema.safeParse(await request.json().catch(() => null));
    if (!parsedRequest.success) {
      return NextResponse.json({ error: 'Invalid chat request' }, { status: 400 });
    }
    const { message, context, systemPrompt } = parsedRequest.data;
    const tools = parsedRequest.data.tools as GrokTool[] | undefined;
    const history = parsedRequest.data.history.map((item, index) => ({
      ...item,
      id: item.id ?? `grok-history-${index}`,
      timestamp: item.timestamp ?? '1970-01-01T00:00:00.000Z',
    }));

    const client = GrokAPIClient.getInstance();
    const result = await client.generateResponse(message, context, history, systemPrompt, tools);

    return NextResponse.json(result);
  } catch {
    console.error('[Grok chat] Request failed.');
    return NextResponse.json(
      { error: 'AssistantUnavailable', message: 'No se pudo completar la solicitud de IA.' },
      { status: 500 }
    );
  }
}
