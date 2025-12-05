import { NextResponse } from 'next/server';
import { booksService } from '@/lib/google';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const query = searchParams.get('q');

        if (!query) {
            return NextResponse.json({ error: 'Query parameter required' }, { status: 400 });
        }

        console.log('Searching books with query:', query);

        try {
            const results = await booksService.searchBooks(query);
            console.log('Books search results:', results?.length || 0, 'items');
            return NextResponse.json(results || []);
        } catch (bookError: any) {
            console.error('Books service error:', bookError);
            // Return empty array instead of erroring - books might not be connected
            return NextResponse.json([]);
        }
    } catch (error: any) {
        console.error('Error in books search route:', error);
        return NextResponse.json({
            error: 'Failed to search books',
            details: error.message
        }, { status: 500 });
    }
}
