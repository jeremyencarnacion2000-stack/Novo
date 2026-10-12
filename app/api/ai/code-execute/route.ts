import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { z } from 'zod';

const MAX_CODE_EXECUTE_BODY_BYTES = 256_000;
const codeExecuteRequestSchema = z.object({
  language: z.string().trim().min(1).max(64),
  code: z.string().min(1).max(200_000),
  input: z.string().max(32_000).default(''),
}).strict();

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rl = rateLimit(`ai:code:${session.user.id}`, 5, 60_000);
    if (!rl.allowed) return rateLimitResponse(rl);

    const contentLength = Number(request.headers.get('content-length'));
    if (Number.isFinite(contentLength) && contentLength > MAX_CODE_EXECUTE_BODY_BYTES) {
      return NextResponse.json({ error: 'Code execution payload is too large' }, { status: 413 });
    }

    const parsed = codeExecuteRequestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid code execution request' }, { status: 400 });
    }
    const { language, code, input } = parsed.data;

    // Call Piston API
    const response = await fetch('https://emkc.org/api/v2/piston/execute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        language,
        version: '*', // Use latest version
        files: [{
          content: code
        }],
        stdin: input
      })
    });

    if (!response.ok) {
      throw new Error(`Piston API request failed: ${response.status}`);
    }

    const data = await response.json();

    return NextResponse.json({
      language,
      code,
      output: data.run?.output || '',
      stderr: data.run?.stderr || '',
      exit_code: data.run?.code || 0,
      execution_time: data.run?.signal || null
    });

  } catch {
    console.error('Code execution request failed.');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
