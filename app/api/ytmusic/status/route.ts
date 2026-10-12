import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { z } from 'zod';

// Simple in-memory cache for player state (for fast mirroring)
// In production, this should be in Redis or Postgres for persistence across server restarts
const playerStates = new Map<string, any>();
const playerStateSchema = z.object({
  currentTrack: z.unknown().nullable().optional(),
  isPlaying: z.boolean(),
  progress: z.number().finite().min(0).max(86_400_000),
}).strict();

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;

    const state = playerStates.get(userId) || {
      currentTrack: null,
      isPlaying: false,
      progress: 0,
      timestamp: Date.now()
    };

    return NextResponse.json(state);
  } catch {
    console.error('[ytmusic/status] read failed')
    return NextResponse.json({ error: 'Music service temporarily unavailable' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;

    const body = await request.json();
    const parsed = playerStateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid player state' }, { status: 400 });
    }
    const { currentTrack, isPlaying, progress } = parsed.data;

    const newState = {
      currentTrack,
      isPlaying,
      progress,
      timestamp: Date.now()
    };

    playerStates.set(userId, newState);

    return NextResponse.json({ success: true });
  } catch {
    console.error('[ytmusic/status] update failed')
    return NextResponse.json({ error: 'Music service temporarily unavailable' }, { status: 500 });
  }
}
