import { google } from 'googleapis';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * Resolve a usable Google OAuth access token for a user — the session's
 * token if present, else the DB Account record (with expiry check). Shared
 * by any route that wants to call a Google API but must gracefully fall
 * back to non-Google data when the user hasn't connected (or their token
 * has expired) — most users sign in with credentials, not Google.
 */
export async function getGoogleAccessToken(userId: string, sessionToken?: string): Promise<string | null> {
    if (sessionToken) return sessionToken;

    try {
        const account = await prisma.account.findFirst({
            where: { userId, provider: 'google' },
            select: { access_token: true, expires_at: true },
        });

        if (!account?.access_token) return null;
        if (account.expires_at && account.expires_at < Math.floor(Date.now() / 1000) + 60) return null;

        return account.access_token;
    } catch {
        return null;
    }
}

/**
 * Initializes a Google API client with the user's access token from the session.
 */
export async function getGoogleAuthClient() {
    const session = await getServerSession(authOptions);

    if (!session?.accessToken) {
        throw new Error('No access token found. User might not be logged in with Google.');
    }

    const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET
    );

    oauth2Client.setCredentials({
        access_token: session.accessToken,
        refresh_token: session.refreshToken, // Optional, if we have it
    });

    return oauth2Client;
}

/**
 * Gmail Service
 */
export const gmailService = {
    sendEmail: async (to: string, subject: string, body: string) => {
        const auth = await getGoogleAuthClient();
        const gmail = google.gmail({ version: 'v1', auth });

        const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
        const messageParts = [
            `To: ${to}`,
            'Content-Type: text/html; charset=utf-8',
            'MIME-Version: 1.0',
            `Subject: ${utf8Subject}`,
            '',
            body,
        ];
        const message = messageParts.join('\n');

        // The body needs to be base64url encoded.
        const encodedMessage = Buffer.from(message)
            .toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');

        const res = await gmail.users.messages.send({
            userId: 'me',
            requestBody: {
                raw: encodedMessage,
            },
        });

        return res.data;
    },

    listUnread: async (maxResults = 5) => {
        const auth = await getGoogleAuthClient();
        const gmail = google.gmail({ version: 'v1', auth });

        const res = await gmail.users.messages.list({
            userId: 'me',
            q: 'is:unread',
            maxResults,
        });

        if (!res.data.messages) return [];

        const emails = await Promise.all(res.data.messages.map(async (msg) => {
            const details = await gmail.users.messages.get({
                userId: 'me',
                id: msg.id!,
            });

            const headers = details.data.payload?.headers;
            const subject = headers?.find(h => h.name === 'Subject')?.value || '(No Subject)';
            const from = headers?.find(h => h.name === 'From')?.value || '(Unknown)';
            const snippet = details.data.snippet;

            return { id: msg.id, subject, from, snippet };
        }));

        return emails;
    }
};

/**
 * Calendar Service
 */
export const calendarService = {
    listEvents: async (timeMin = new Date().toISOString(), maxResults = 10, timeMax?: string) => {
        const auth = await getGoogleAuthClient();
        const calendar = google.calendar({ version: 'v3', auth });

        const res = await calendar.events.list({
            calendarId: 'primary',
            timeMin,
            ...(timeMax ? { timeMax } : {}),
            maxResults,
            singleEvents: true,
            orderBy: 'startTime',
        });

        return res.data.items || [];
    },

    createEvent: async (summary: string, description: string, startTime: string, endTime: string) => {
        const auth = await getGoogleAuthClient();
        const calendar = google.calendar({ version: 'v3', auth });

        const event = {
            summary,
            description,
            start: {
                dateTime: startTime, // ISO string
                timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            },
            end: {
                dateTime: endTime, // ISO string
                timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            },
        };

        const res = await calendar.events.insert({
            calendarId: 'primary',
            requestBody: event,
        });

        return res.data;
    }
};

/**
 * Fitness Service - DISABLED (Scope removed to reduce verification requirements)
 * To re-enable, add 'https://www.googleapis.com/auth/fitness.activity.read' scope in lib/auth.ts
 */
/* 
export const fitnessService = {
    getDailySteps: async () => {
        const auth = await getGoogleAuthClient();
        const fitness = google.fitness({ version: 'v1', auth });

        // Get start of today
        const startTime = new Date();
        startTime.setHours(0, 0, 0, 0);
        const endTime = new Date();

        const res = await fitness.users.dataset.aggregate({
            userId: 'me',
            requestBody: {
                aggregateBy: [{
                    dataTypeName: 'com.google.step_count.delta',
                    dataSourceId: 'derived:com.google.step_count.delta:com.google.android.gms:estimated_steps'
                }],
                bucketByTime: { durationMillis: 86400000 }, // 1 day
                startTimeMillis: startTime.getTime().toString(),
                endTimeMillis: endTime.getTime().toString(),
            } as any, // googleapis types are incorrect for bucketByTime.durationMillis
        });

        const bucket = res.data.bucket?.[0];
        const steps = bucket?.dataset?.[0]?.point?.[0]?.value?.[0]?.intVal || 0;

        return steps;
    },

    getWorkoutHistory: async (days = 7) => {
        const auth = await getGoogleAuthClient();
        const fitness = google.fitness({ version: 'v1', auth });

        const endTime = new Date();
        const startTime = new Date();
        startTime.setDate(startTime.getDate() - days);

        const res = await fitness.users.dataset.aggregate({
            userId: 'me',
            requestBody: {
                aggregateBy: [{
                    dataTypeName: 'com.google.activity.segment',
                }],
                bucketByActivitySegment: { minDurationMillis: 60000 }, // Ignore < 1 min
                startTimeMillis: startTime.getTime().toString(),
                endTimeMillis: endTime.getTime().toString(),
            } as any, // googleapis types are incorrect for bucketByActivitySegment.minDurationMillis
        });

        const workouts = res.data.bucket?.map((bucket: any) => {
            const activityId = bucket.activity;
            const startTime = parseInt(bucket.startTimeMillis || '0');
            const endTime = parseInt(bucket.endTimeMillis || '0');
            const durationMinutes = Math.round((endTime - startTime) / 60000);

            // Map common activity IDs to names (simplified list)
            let activityName = 'Unknown Activity';
            if (activityId === 7) activityName = 'Walking';
            else if (activityId === 8) activityName = 'Running';
            else if (activityId === 1) activityName = 'Biking';
            else if (activityId === 97) activityName = 'Weightlifting';
            else if (activityId === 114) activityName = 'HIIT';
            else if (activityId === 82) activityName = 'Yoga';
            else if (activityId === 52) activityName = 'Hiking';
            else if (activityId === 72) activityName = 'Sleeping';

            return {
                activityId,
                name: activityName,
                startTime: new Date(startTime).toISOString(),
                durationMinutes,
            };
        }).filter((w: any) => w.name !== 'Unknown Activity' && w.name !== 'Sleeping').reverse() || [];

        return workouts;
    }
};
*/


/**
 * People Service (Contacts)
 */
export const peopleService = {
    listContacts: async (pageSize = 20) => {
        const auth = await getGoogleAuthClient();
        const people = google.people({ version: 'v1', auth });

        const res = await people.people.connections.list({
            resourceName: 'people/me',
            pageSize,
            personFields: 'names,emailAddresses,photos',
        });

        return res.data.connections?.map(person => ({
            name: person.names?.[0]?.displayName,
            email: person.emailAddresses?.[0]?.value,
            photo: person.photos?.[0]?.url,
        })) || [];
    }
};

/**
 * Books Service
 */
export const booksService = {
    searchBooks: async (query: string) => {
        const auth = await getGoogleAuthClient();
        const books = google.books({ version: 'v1', auth });

        const res = await books.volumes.list({
            q: query,
            maxResults: 10,
        });

        return res.data.items?.map(item => ({
            id: item.id,
            title: item.volumeInfo?.title,
            authors: item.volumeInfo?.authors,
            description: item.volumeInfo?.description,
            thumbnail: item.volumeInfo?.imageLinks?.thumbnail,
            pageCount: item.volumeInfo?.pageCount,
        })) || [];
    }
};

/**
 * Drive Service
 */
export const driveService = {
    /**
     * Lists files from Google Drive
     */
    listFiles: async (pageSize = 10) => {
        const auth = await getGoogleAuthClient();
        const drive = google.drive({ version: 'v3', auth });

        const res = await drive.files.list({
            pageSize,
            fields: 'files(id, name, mimeType, modifiedTime, size)',
            orderBy: 'modifiedTime desc',
        });

        return res.data.files || [];
    },

    /**
     * Creates a folder in Google Drive if it doesn't exist and uploads/saves a workspace backup
     */
    exportWorkspaceBackup: async (backupData: any) => {
        const auth = await getGoogleAuthClient();
        const drive = google.drive({ version: 'v3', auth });

        // 1. Find or create "Novo Backups" folder
        let folderId = '';
        const folderSearch = await drive.files.list({
            q: "name = 'Novo Backups' and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
            fields: 'files(id)',
            spaces: 'drive',
        });

        if (folderSearch.data.files && folderSearch.data.files.length > 0) {
            folderId = folderSearch.data.files[0].id!;
        } else {
            const folderMetadata = {
                name: 'Novo Backups',
                mimeType: 'application/vnd.google-apps.folder',
            };
            const folder = await drive.files.create({
                requestBody: folderMetadata,
                fields: 'id',
            });
            folderId = folder.data.id!;
        }

        // 2. Upload file
        const fileName = `novo_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
        const fileMetadata = {
            name: fileName,
            parents: [folderId],
        };

        const media = {
            mimeType: 'application/json',
            body: JSON.stringify(backupData, null, 2),
        };

        const file = await drive.files.create({
            requestBody: fileMetadata,
            media: media,
            fields: 'id, name, webViewLink',
        });

        return {
            id: file.data.id,
            name: file.data.name,
            webViewLink: file.data.webViewLink,
        };
    }
};

