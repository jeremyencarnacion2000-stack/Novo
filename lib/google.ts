import { createHash } from 'node:crypto';
import { google } from 'googleapis';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { findGoogleAccountForScopes, toGoogleOAuthCredentials } from '@/lib/google-account';

/**
 * Resolve a usable Google OAuth access token for a user from the server-owned
 * Account record (with expiry and capability checks). Shared by routes that
 * call a Google API but must gracefully fall back when the user hasn't
 * connected that capability or the grant has expired.
 */
export async function getGoogleAccessToken(userId: string, requiredScopes: string[] = []): Promise<string | null> {
    try {
        const account = await findGoogleAccountForScopes(userId, requiredScopes);

        if (!account?.access_token) return null;
        if (account.expires_at && account.expires_at < Math.floor(Date.now() / 1000) + 60) return null;

        return account.access_token;
    } catch {
        return null;
    }
}

/**
 * Initializes a Google API client from the authenticated user's server-owned
 * Google grant. The browser session contributes identity only.
 */
export async function getGoogleAuthClient(requiredScopes: string[] = []) {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
        throw new Error('No access token found. User might not be logged in with Google.');
    }

    // Resolve the durable grant on the server. The session endpoint contains
    // identity only, so browser clients can never read or replay OAuth tokens.
    return getGoogleAuthClientForUser(session.user.id, requiredScopes);
}

/**
 * Server/background OAuth client. Unlike getGoogleAuthClient(), this resolves
 * a durable Google grant owned by a Novo user and rotates refreshed tokens
 * back into that same account record. It is safe for credentials-based users,
 * Vercel Cron and no-browser reconciliation jobs.
 */
export async function getGoogleAuthClientForUser(userId: string, requiredScopes: string[] = []) {
    const account = await findGoogleAccountForScopes(userId, requiredScopes);
    if (!account) {
        throw new Error('Google connection with the required permission was not found.');
    }

    const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
    );
    oauth2Client.setCredentials(toGoogleOAuthCredentials(account));
    oauth2Client.on('tokens', (tokens) => {
        if (!tokens.access_token) return;
        void prisma.account.update({
            where: { id: account.id },
            data: {
                access_token: tokens.access_token,
                expires_at: tokens.expiry_date ? Math.floor(tokens.expiry_date / 1000) : undefined,
                refresh_token: tokens.refresh_token ?? account.refresh_token ?? undefined,
            },
        }).catch(() => undefined);
    });

    return oauth2Client;
}

/**
 * Gmail Service
 */
export const gmailService = {
    sendEmail: async (to: string, subject: string, body: string) => {
        const auth = await getGoogleAuthClient(['gmail.send']);
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
        const auth = await getGoogleAuthClient(['gmail.readonly']);
        return listUnreadWithAuth(auth, maxResults);
    },

    /** Read a user's mailbox from their persisted OAuth grant, never a browser session. */
    listUnreadForUser: async (userId: string, maxResults = 5, signal?: AbortSignal) => {
        const auth = await getGoogleAuthClientForUser(userId, ['gmail.readonly']);
        return listUnreadWithAuth(auth, maxResults, signal);
    },
};

async function listUnreadWithAuth(auth: Awaited<ReturnType<typeof getGoogleAuthClient>>, maxResults: number, signal?: AbortSignal) {
        const gmail = google.gmail({ version: 'v1', auth });
        // Novo only needs a compact inbox signal (subject, sender and the
        // provider snippet). Never fetch full message bodies for context or
        // background sync, and cap the provider request to keep latency and
        // prompt size bounded even if a caller passes an unexpected value.
        const boundedMaxResults = Number.isFinite(maxResults)
            ? Math.min(Math.max(Math.trunc(maxResults), 1), 50)
            : 5;

        const res = await gmail.users.messages.list({
            userId: 'me',
            q: 'is:unread',
            maxResults: boundedMaxResults,
        }, { signal });

        if (!res.data.messages) return [];

        const emails = await Promise.all(res.data.messages.map(async (msg) => {
            const details = await gmail.users.messages.get({
                userId: 'me',
                id: msg.id!,
                format: 'metadata',
                metadataHeaders: ['Subject', 'From'],
            }, { signal });

            const headers = details.data.payload?.headers;
            const subject = headers?.find(h => h.name === 'Subject')?.value || '(No Subject)';
            const from = headers?.find(h => h.name === 'From')?.value || '(Unknown)';
            const snippet = details.data.snippet;

            return { id: msg.id, subject, from, snippet };
        }));

        return emails;
}

/**
 * Calendar Service
 */
export const calendarService = {
    listEvents: async (timeMin = new Date().toISOString(), maxResults = 10, timeMax?: string) => {
        const auth = await getGoogleAuthClient(['calendar']);
        return listCalendarEventsWithAuth(auth, timeMin, maxResults, timeMax);
    },

    listEventsForUser: async (userId: string, timeMin = new Date().toISOString(), maxResults = 10, timeMax?: string) => {
        const auth = await getGoogleAuthClientForUser(userId, ['calendar']);
        return listCalendarEventsWithAuth(auth, timeMin, maxResults, timeMax);
    },

    createEvent: async (summary: string, description: string, startTime: string, endTime: string) => {
        const auth = await getGoogleAuthClient(['calendar']);
        return createCalendarEventWithAuth(auth, summary, description, startTime, endTime);
    },

    createEventForUser: async (userId: string, summary: string, description: string, startTime: string, endTime: string, idempotencyKey?: string) => {
        const auth = await getGoogleAuthClientForUser(userId, ['calendar']);
        return createCalendarEventWithAuth(auth, summary, description, startTime, endTime, idempotencyKey ? `${userId}:${idempotencyKey}` : undefined);
    },
};

async function listCalendarEventsWithAuth(auth: Awaited<ReturnType<typeof getGoogleAuthClient>>, timeMin: string, maxResults: number, timeMax?: string) {
        const calendar = google.calendar({ version: 'v3', auth });

        const boundedMaxResults = Number.isFinite(maxResults)
            ? Math.min(Math.max(Math.trunc(maxResults), 1), 250)
            : 50

        const res = await calendar.events.list({
            calendarId: 'primary',
            timeMin,
            ...(timeMax ? { timeMax } : {}),
            maxResults: boundedMaxResults,
            singleEvents: true,
            orderBy: 'startTime',
        });

        return res.data.items || [];
}

async function createCalendarEventWithAuth(auth: Awaited<ReturnType<typeof getGoogleAuthClient>>, summary: string, description: string, startTime: string, endTime: string, idempotencyKey?: string) {
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

        // Google Calendar accepts a caller-supplied event id. Hash the
        // user-scoped intent so a lost response/retry converges on the same
        // external event without collapsing two intentional creates that use
        // different keys. The hash is lowercase hex, valid for Calendar ids.
        const eventId = idempotencyKey
            ? createHash('sha256').update(idempotencyKey).digest('hex')
            : undefined;

        try {
            const res = await calendar.events.insert({
                calendarId: 'primary',
                requestBody: eventId ? { ...event, id: eventId } : event,
            });
            return res.data;
        } catch (error: any) {
            // A duplicate deterministic id means the first request succeeded
            // but its response was lost. Read the winner instead of creating
            // another event or surfacing a false failure to the user.
            if (eventId && Number(error?.code) === 409) {
                const existing = await calendar.events.get({ calendarId: 'primary', eventId });
                return existing.data;
            }
            throw error;
        }
}

/**
 * Fitness Service - DISABLED (Scope removed to reduce verification requirements)
 * To re-enable, add 'https://www.googleapis.com/auth/fitness.activity.read' scope in lib/auth.ts
 */
/* 
export const fitnessService = {
    getDailySteps: async () => {
        const auth = await getGoogleAuthClient(['fitness.activity.read']);
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
        const auth = await getGoogleAuthClient(['fitness.activity.read']);
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
        const auth = await getGoogleAuthClient(['contacts.readonly']);
        const people = google.people({ version: 'v1', auth });

        const boundedPageSize = Number.isFinite(pageSize)
            ? Math.min(Math.max(Math.trunc(pageSize), 1), 100)
            : 20;

        const res = await people.people.connections.list({
            resourceName: 'people/me',
            pageSize: boundedPageSize,
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
        const auth = await getGoogleAuthClient(['drive.file']);
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
    exportWorkspaceBackup: async (backupData: any, idempotencyKey?: string) => {
        const auth = await getGoogleAuthClient(['drive.file']);
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

        // 2. Upload file. A retry of the same explicit user intent reuses a
        // deterministic filename and updates the existing Drive file instead
        // of creating a second backup. Without a key, preserve the historical
        // snapshot behavior and create a timestamped file.
        const stableName = idempotencyKey
            ? `novo_backup_${createHash('sha256').update(idempotencyKey).digest('hex')}.json`
            : null;
        const fileName = stableName ?? `novo_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
        const fileMetadata = {
            name: fileName,
            parents: [folderId],
        };

        const media = {
            mimeType: 'application/json',
            body: JSON.stringify(backupData, null, 2),
        };

        let file;
        let replayed = false;
        if (stableName) {
            const existing = await drive.files.list({
                q: `name = '${stableName}' and '${folderId}' in parents and trashed = false`,
                fields: 'files(id)',
                spaces: 'drive',
                pageSize: 1,
            });
            const existingId = existing.data.files?.[0]?.id;
            if (existingId) {
                file = await drive.files.update({
                    fileId: existingId,
                    media,
                    fields: 'id, name, webViewLink',
                });
                replayed = true;
            }
        }
        if (!file) {
            file = await drive.files.create({
                requestBody: fileMetadata,
                media,
                fields: 'id, name, webViewLink',
            });
        }

        return {
            id: file.data.id,
            name: file.data.name,
            webViewLink: file.data.webViewLink,
            replayed,
        };
    }
};

