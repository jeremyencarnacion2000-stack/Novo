import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Simple in-memory cache for player state (for fast mirroring)
// In production, this should be in Redis or Postgres for persistence across server restarts
const playerStates = new Map<string, any>();

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id || 'demo-user-id';

    const state = playerStates.get(userId) || {
      currentTrack: null,
      isPlaying: false,
      progress: 0,
      timestamp: Date.now()
    };

    return NextResponse.json(state);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id || 'demo-user-id';

    const body = await request.json();
    const { currentTrack, isPlaying, progress } = body;

    const newState = {
      currentTrack,
      isPlaying,
      progress,
      timestamp: Date.now()
    };

    playerStates.set(userId, newState);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
