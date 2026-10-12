import { NextResponse } from 'next/server';
import { peopleService } from '@/lib/google';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const requestedPageSize = Number.parseInt(searchParams.get('pageSize') || '50', 10)
        // Contacts are used as a lightweight context signal. Clamp the page
        // before it reaches the provider so a malformed or overly broad URL
        // cannot request an unexpectedly large response.
        const pageSize = Number.isFinite(requestedPageSize)
            ? Math.min(Math.max(requestedPageSize, 1), 100)
            : 50

        const contacts = await peopleService.listContacts(pageSize);

        return NextResponse.json(contacts);
    } catch (error) {
        // Provider diagnostics stay server-side; clients only need a stable,
        // retryable error code.
        console.error('Error fetching contacts.');

        const errorMessage = error instanceof Error ? error.message : '';
        const isAuthError = errorMessage.includes('No access token found') ||
            errorMessage.includes('invalid_grant') ||
            errorMessage.includes('Unauthorized');

        return NextResponse.json({
            error: isAuthError ? 'Authentication required' : 'Failed to fetch contacts',
            code: isAuthError ? 'UNAUTHORIZED' : 'FETCH_ERROR'
        }, { status: isAuthError ? 401 : 500 });
    }
}
