import { google } from 'googleapis';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { title, type, startTime, endTime, projectId, routineId, energyRequired } = body;

    if (!title || !startTime || !endTime || !type) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    let googleEventId: string | null = null;

    // Check if the user has Google account credentials connected
    const account = await prisma.account.findFirst({
      where: {
        userId: session.user.id,
        provider: 'google',
      },
    });

    if (account && account.access_token) {
      try {
        const oauth2Client = new google.auth.OAuth2(
          process.env.GOOGLE_CLIENT_ID,
          process.env.GOOGLE_CLIENT_SECRET
        );

        oauth2Client.setCredentials({
          access_token: account.access_token,
          refresh_token: account.refresh_token,
        });

        // Listen for automatic token refreshes to keep Prisma DB Account synchronized
        oauth2Client.on('tokens', async (tokens) => {
          if (tokens.access_token) {
            console.log('🔄 [API Create] Google client triggered auto token refresh, updating DB Account...');
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
        const googleEvent = await calendar.events.insert({
          calendarId: 'primary',
          requestBody: {
            summary: title,
            description: `Novo Heritage TimeBlock: ${type} (Energy: ${energyRequired || 'medium'})`,
            start: {
              dateTime: new Date(startTime).toISOString(),
            },
            end: {
              dateTime: new Date(endTime).toISOString(),
            },
          },
        });

        googleEventId = googleEvent.data.id || null;
        console.log('✅ [API Create] Google Event created successfully. ID:', googleEventId);
      } catch (googleError) {
        console.error('⚠️ [API Create] Failed to create event in Google Calendar, proceeding locally:', googleError);
      }
    }

    // Save to local Neon database using Prisma
    const timeBlock = await prisma.timeBlock.create({
      data: {
        title,
        type,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        projectId: projectId || null,
        routineId: routineId || null,
        energyRequired: energyRequired || 'medium',
        googleEventId,
        userId: session.user.id,
        status: 'pending',
      },
    });

    return NextResponse.json(timeBlock, { status: 201 });
  } catch (error: any) {
    console.error('💥 [API Create] Error creating time block:', error);
    return NextResponse.json({ error: 'Failed to create time block', details: error.message }, { status: 500 });
  }
}
