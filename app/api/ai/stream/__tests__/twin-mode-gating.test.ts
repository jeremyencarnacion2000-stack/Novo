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

import { buildUserContext } from '@/lib/ai/context-builder';

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
});
