import { NextResponse } from 'next/server';
import { peopleService } from '@/lib/google';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const pageSize = parseInt(searchParams.get('pageSize') || '50');

        const contacts = await peopleService.listContacts(pageSize);

        return NextResponse.json(contacts);
    } catch (error) {
        console.error('Error fetching contacts:', error);

        const errorMessage = error instanceof Error ? error.message : String(error);
        const isAuthError = errorMessage.includes('No access token found') ||
            errorMessage.includes('invalid_grant') ||
            errorMessage.includes('Unauthorized');

        return NextResponse.json({
            error: isAuthError ? 'Authentication required' : 'Failed to fetch contacts',
            details: errorMessage,
            code: isAuthError ? 'UNAUTHORIZED' : 'FETCH_ERROR'
        }, { status: isAuthError ? 401 : 500 });
    }
}
