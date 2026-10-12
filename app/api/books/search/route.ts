import { NextResponse } from 'next/server';
import { booksService } from '@/lib/google';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const query = searchParams.get('q')?.trim() || '';

        if (!query) {
            return NextResponse.json({ error: 'Query parameter required' }, { status: 400 });
        }
        if (query.length > 200) {
            return NextResponse.json({ error: 'Search query is too long' }, { status: 400 });
        }

        console.log('Searching books');

        try {
            const results = await booksService.searchBooks(query);
            console.log('Books search results:', results?.length || 0, 'items');
            return NextResponse.json(results || []);
        } catch (bookError: any) {
            console.error('Books service request failed');
            // Return empty array instead of erroring - books might not be connected
            return NextResponse.json([]);
        }
    } catch {
        console.error('Books search route failed');
        return NextResponse.json({ error: 'Book search temporarily unavailable' }, { status: 500 });
    }
}
