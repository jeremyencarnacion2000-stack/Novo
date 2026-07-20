import { google } from 'googleapis';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import crypto from 'crypto';

// Disable Static Optimization for Webhook listener
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const channelToken = request.headers.get('x-goog-channel-token');
    const resourceState = request.headers.get('x-goog-resource-state');
    const channelId = request.headers.get('x-goog-channel-id');
    const resourceId = request.headers.get('x-goog-resource-id');

    console.log('🔔 [Calendar Webhook] Received event notification:', {
      channelId,
      resourceId,
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

    const expectedSignature = crypto
      .createHmac('sha256', process.env.NEXTAUTH_SECRET || 'secret-fallback')
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
      console.error('❌ [Calendar Webhook] Connected Google Account not found for user ID:', userId);
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
        console.log('🔄 [Calendar Webhook] Automatic token refresh triggered during sync, updating DB Account...');
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
    console.log(`📊 [Calendar Webhook] Fetched ${googleEvents.length} events from Google Calendar for synchronization.`);

    // Perform atomic database synchronizations to avoid race conditions
    for (const event of googleEvents) {
      if (!event.id) continue;

      const eventStart = new Date(event.start?.dateTime || event.start?.date || Date.now());
      const eventEnd = new Date(event.end?.dateTime || event.end?.date || Date.now());
      const isCancelled = event.status === 'cancelled';

      if (isCancelled) {
        console.log(`🗑️ [Calendar Webhook] Event ${event.id} is deleted on Google, deleting locally...`);
        try {
          await prisma.timeBlock.delete({
            where: { googleEventId: event.id },
          });
        } catch {
          // Record might not exist locally, ignore deletion errors safely
        }
      } else {
        console.log(`🔄 [Calendar Webhook] Upserting event locally: "${event.summary}"`);
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

    return NextResponse.json({ success: true, synced: googleEvents.length });
  } catch (error: any) {
    console.error('💥 [Calendar Webhook] Fatal webhook synchronization failure:', error);
    return NextResponse.json({ error: 'Internal sync error', details: error.message }, { status: 500 });
  }
}
