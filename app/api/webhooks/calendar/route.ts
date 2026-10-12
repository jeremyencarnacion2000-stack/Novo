import { google } from 'googleapis';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { runAmbientTwinForUser } from '@/lib/cognitive/ambient-twin-runtime';

// Disable Static Optimization for Webhook listener
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const channelToken = request.headers.get('x-goog-channel-token');
    const resourceState = request.headers.get('x-goog-resource-state');

    console.log('[Calendar Webhook] Notification received.', {
      resourceState,
      hasToken: !!channelToken,
    });

    if (!channelToken) {
      console.error('❌ [Calendar Webhook] Missing channel verification token.');
      return new Response('Missing token', { status: 400 });
    }

    // Cryptographic validation of the secret token signature
    const [userId, signature] = channelToken.split('.');
    if (!userId || !signature) {
      console.error('❌ [Calendar Webhook] Invalid token structure.');
      return new Response('Invalid token format', { status: 400 });
    }

    const signingSecret = process.env.NEXTAUTH_SECRET;
    if (!signingSecret) {
      // Never fall back to a known development secret for a public webhook.
      // A missing deployment secret must fail closed instead of accepting a
      // forgeable channel token.
      console.error('❌ [Calendar Webhook] NEXTAUTH_SECRET is not configured.');
      return new Response('Webhook unavailable', { status: 503 });
    }

    const expectedSignature = crypto
      .createHmac('sha256', signingSecret)
      .update(userId)
      .digest('hex');

    // timingSafeEqual (not ===) so response time can't leak the signature
    // byte-by-byte — same pattern as the Lemon Squeezy webhook.
    const signatureBuffer = Buffer.from(signature, 'utf8');
    const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
    const isSignatureValid =
      signatureBuffer.length === expectedBuffer.length &&
      crypto.timingSafeEqual(signatureBuffer, expectedBuffer);

    if (!isSignatureValid) {
      console.error('🚫 [Calendar Webhook] Unauthorized signature signature mismatch.');
      return new Response('Unauthorized webhook verification failed', { status: 401 });
    }

    // Google webhook verification check
    if (resourceState === 'sync') {
      console.log('✅ [Calendar Webhook] Channel verification successful (sync state received).');
      return new Response('Sync validation OK', { status: 200 });
    }

    // Retrieve user's Google credentials from Neon DB
    const account = await prisma.account.findFirst({
      where: {
        userId,
        provider: 'google',
      },
    });

    if (!account || !account.access_token) {
      console.error('[Calendar Webhook] Connected Google account not found.');
      return new Response('Linked Google account not found', { status: 404 });
    }

    // Instantiate OAuth2 Client with auto-refresh capability
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );

    oauth2Client.setCredentials({
      access_token: account.access_token,
      refresh_token: account.refresh_token,
    });

    // Auto-update rotated tokens inside the DB
    oauth2Client.on('tokens', async (tokens) => {
      if (tokens.access_token) {
        console.log('[Calendar Webhook] Rotated Google credentials persisted.');
        await prisma.account.update({
          where: { id: account.id },
          data: {
            access_token: tokens.access_token,
            expires_at: tokens.expiry_date ? Math.floor(tokens.expiry_date / 1000) : undefined,
            refresh_token: tokens.refresh_token ?? undefined,
          },
        });
      }
    });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    // Fetch Google Calendar events updated in the active viewport (e.g. past 7 days to next 30 days)
    const timeMin = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const timeMax = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const eventsResponse = await calendar.events.list({
      calendarId: 'primary',
      timeMin,
      timeMax,
      singleEvents: true,
    });

    const googleEvents = eventsResponse.data.items || [];
    console.log('[Calendar Webhook] Calendar events fetched.', { count: googleEvents.length });

    // Perform atomic database synchronizations to avoid race conditions
    for (const event of googleEvents) {
      if (!event.id) continue;

      const eventStart = new Date(event.start?.dateTime || event.start?.date || Date.now());
      const eventEnd = new Date(event.end?.dateTime || event.end?.date || Date.now());
      const isCancelled = event.status === 'cancelled';

      if (isCancelled) {
        // Delete only the current user's mirror. A provider event id must never
        // be allowed to remove another user's time block.
        await prisma.timeBlock.deleteMany({
          where: { googleEventId: event.id, userId },
        });
      } else {
        // The unique provider id is global, but the resource is user-owned.
        // Refuse to overwrite a row that belongs to a different account.
        const existing = await prisma.timeBlock.findUnique({
          where: { googleEventId: event.id },
          select: { userId: true },
        });
        if (existing && existing.userId !== userId) continue;
        await prisma.timeBlock.upsert({
          where: { googleEventId: event.id },
          update: {
            title: event.summary || 'Google Event',
            startTime: eventStart,
            endTime: eventEnd,
            updatedAt: new Date(),
          },
          create: {
            googleEventId: event.id,
            title: event.summary || 'Google Event',
            type: 'google_event',
            startTime: eventStart,
            endTime: eventEnd,
            energyRequired: 'medium',
            status: 'pending',
            userId,
          },
        });
      }
    }

    await runAmbientTwinForUser(userId, { trigger: 'calendar_changed' }).catch(() => undefined);

    return NextResponse.json({ success: true, synced: googleEvents.length });
  } catch {
    console.error('💥 [Calendar Webhook] Fatal webhook synchronization failure.');
    return NextResponse.json({ error: 'Internal sync error' }, { status: 500 });
  }
}
