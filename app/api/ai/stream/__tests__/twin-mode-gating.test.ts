/**
 * @jest-environment node
 */
import { prisma } from '@/lib/prisma';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn() },
  },
}));

jest.mock('next-auth', () => ({
  getServerSession: jest.fn().mockResolvedValue({ user: { id: 'user-1' } }),
}));

jest.mock('@/lib/ai/context-builder', () => ({
  buildUserContext: jest.fn().mockResolvedValue({
    summary: '{}',
    structured: { activeSignal: null, twinContext: null },
  }),
}));

jest.mock('@/lib/ai/activity', () => ({
  createActivityRun: jest.fn().mockResolvedValue({ id: 'run-1' }),
  appendActivityEvent: jest.fn().mockResolvedValue({}),
  finishActivityRun: jest.fn().mockResolvedValue({}),
  isActivityCancelled: jest.fn().mockResolvedValue(false),
  recordFirstVisibleActivityContent: jest.fn().mockResolvedValue(true),
}));

import { buildUserContext } from '@/lib/ai/context-builder';
import { finishActivityRun, recordFirstVisibleActivityContent } from '@/lib/ai/activity';

describe('Twin Mode server-side gating', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not pass twinMode: true through to buildUserContext for a Free-plan user even if the request asks for it', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ plan: 'free' });

    const { POST } = await import('../route');
    const request = new Request('http://localhost/api/ai/stream', {
      method: 'POST',
      body: JSON.stringify({ message: 'hola', history: [], twinMode: true }),
    });
    await POST(request as any);

    expect(buildUserContext).toHaveBeenCalledWith('user-1', { twinMode: false });
  });

  it('passes twinMode: true through to buildUserContext for a Pro-plan user who asked for it', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ plan: 'pro' });

    const { POST } = await import('../route');
    const request = new Request('http://localhost/api/ai/stream', {
      method: 'POST',
      body: JSON.stringify({ message: 'hola', history: [], twinMode: true }),
    });
    await POST(request as any);

    expect(buildUserContext).toHaveBeenCalledWith('user-1', { twinMode: true });
  });

  it('includes the persisted run identifier in the no-provider fallback stream', async () => {
    const { POST } = await import('../route');
    const response = await POST(new Request('http://localhost/api/ai/stream', {
      method: 'POST', body: JSON.stringify({ message: 'hola', history: [] }),
    }) as any)

    const body = await response.text()

    expect(body).toContain('"runId":"run-1"')
    expect(finishActivityRun).toHaveBeenCalledWith('user-1', 'run-1', 'failed', expect.objectContaining({ errorCode: 'provider_not_configured' }))
  })

  it('finishes the owned run when an unexpected server step fails', async () => {
    (buildUserContext as jest.Mock).mockRejectedValueOnce(new Error('private context failure'))
    const { POST } = await import('../route')

    const response = await POST(new Request('http://localhost/api/ai/stream', {
      method: 'POST', body: JSON.stringify({ message: 'hola', history: [] }),
    }) as any)

    expect(response.status).toBe(500)
    expect(finishActivityRun).toHaveBeenCalledWith('user-1', 'run-1', 'failed', expect.objectContaining({ errorCode: 'chat_request_failed' }))
  })

  it('marks the persisted chat run failed without exposing a provider error when every provider fails', async () => {
    const savedGroq = process.env.GROQ_API_KEY
    const savedCerebras = process.env.CEREBRAS_API_KEY
    const savedGemini = process.env.GEMINI_API_KEY
    const savedOpenRouter = process.env.OPENROUTER_API_KEY
    process.env.GROQ_API_KEY = 'test-key'
    delete process.env.CEREBRAS_API_KEY
    delete process.env.GEMINI_API_KEY
    delete process.env.OPENROUTER_API_KEY
    const fetchMock = jest.spyOn(global, 'fetch').mockImplementation(async () => new Response(JSON.stringify({ error: { message: 'private upstream diagnostic' } }), { status: 503 }))

    try {
      const { POST } = await import('../route');
      const response = await POST(new Request('http://localhost/api/ai/stream', {
        method: 'POST', body: JSON.stringify({ message: 'hola', history: [] }),
      }) as any)
      const body = await response.text()

      expect(finishActivityRun).toHaveBeenCalledWith('user-1', 'run-1', 'failed', expect.objectContaining({ errorCode: 'provider_unavailable' }))
      expect(body).not.toContain('private upstream diagnostic')
    } finally {
      fetchMock.mockRestore()
      if (savedGroq === undefined) delete process.env.GROQ_API_KEY; else process.env.GROQ_API_KEY = savedGroq
      if (savedCerebras === undefined) delete process.env.CEREBRAS_API_KEY; else process.env.CEREBRAS_API_KEY = savedCerebras
      if (savedGemini === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = savedGemini
      if (savedOpenRouter === undefined) delete process.env.OPENROUTER_API_KEY; else process.env.OPENROUTER_API_KEY = savedOpenRouter
    }
  });

  it('records an interrupted provider stream as failed rather than completed', async () => {
    const savedGroq = process.env.GROQ_API_KEY
    const savedCerebras = process.env.CEREBRAS_API_KEY
    const savedGemini = process.env.GEMINI_API_KEY
    const savedOpenRouter = process.env.OPENROUTER_API_KEY
    process.env.GROQ_API_KEY = 'test-key'
    delete process.env.CEREBRAS_API_KEY
    delete process.env.GEMINI_API_KEY
    delete process.env.OPENROUTER_API_KEY
    const fetchMock = jest.spyOn(global, 'fetch').mockImplementation(async () => new Response(new ReadableStream({
      start(controller) { controller.error(new Error('synthetic provider disconnect')) },
    }), { status: 200 }))

    try {
      const { POST } = await import('../route')
      const response = await POST(new Request('http://localhost/api/ai/stream', {
        method: 'POST', body: JSON.stringify({ message: 'hola', history: [] }),
      }) as any)
      await response.text()

      expect(finishActivityRun).toHaveBeenCalledWith('user-1', 'run-1', 'failed', expect.objectContaining({ errorCode: 'chat_stream_interrupted' }))
      expect(finishActivityRun).not.toHaveBeenCalledWith('user-1', 'run-1', 'completed', expect.anything())
    } finally {
      fetchMock.mockRestore()
      if (savedGroq === undefined) delete process.env.GROQ_API_KEY; else process.env.GROQ_API_KEY = savedGroq
      if (savedCerebras === undefined) delete process.env.CEREBRAS_API_KEY; else process.env.CEREBRAS_API_KEY = savedCerebras
      if (savedGemini === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = savedGemini
      if (savedOpenRouter === undefined) delete process.env.OPENROUTER_API_KEY; else process.env.OPENROUTER_API_KEY = savedOpenRouter
    }
  })

  it('records first-visible-content latency once without retaining the content', async () => {
    const savedGroq = process.env.GROQ_API_KEY
    const savedCerebras = process.env.CEREBRAS_API_KEY
    const savedGemini = process.env.GEMINI_API_KEY
    const savedOpenRouter = process.env.OPENROUTER_API_KEY
    process.env.GROQ_API_KEY = 'test-key'
    delete process.env.CEREBRAS_API_KEY
    delete process.env.GEMINI_API_KEY
    delete process.env.OPENROUTER_API_KEY
    const fetchMock = jest.spyOn(global, 'fetch').mockImplementation(async () => new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"contenido privado"}}]}\n\n'))
        controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'))
        controller.close()
      },
    }), { status: 200 }))

    try {
      const { POST } = await import('../route')
      const response = await POST(new Request('http://localhost/api/ai/stream', {
        method: 'POST', body: JSON.stringify({ message: 'hola', history: [] }),
      }) as any)
      await response.text()

      expect(recordFirstVisibleActivityContent).toHaveBeenCalledTimes(1)
      expect(recordFirstVisibleActivityContent).toHaveBeenCalledWith('user-1', 'run-1')
    } finally {
      fetchMock.mockRestore()
      if (savedGroq === undefined) delete process.env.GROQ_API_KEY; else process.env.GROQ_API_KEY = savedGroq
      if (savedCerebras === undefined) delete process.env.CEREBRAS_API_KEY; else process.env.CEREBRAS_API_KEY = savedCerebras
      if (savedGemini === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = savedGemini
      if (savedOpenRouter === undefined) delete process.env.OPENROUTER_API_KEY; else process.env.OPENROUTER_API_KEY = savedOpenRouter
    }
  })
});
