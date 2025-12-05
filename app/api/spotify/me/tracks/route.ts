import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function PUT(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.accessToken) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { ids } = body;

        if (!ids || !Array.isArray(ids)) {
            return NextResponse.json({ error: 'IDs array is required' }, { status: 400 });
        }

        const response = await fetch(`https://api.spotify.com/v1/me/tracks?ids=${ids.join(',')}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${session.accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('Failed to save tracks');
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error saving tracks:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.accessToken) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { ids } = body;

        if (!ids || !Array.isArray(ids)) {
            return NextResponse.json({ error: 'IDs array is required' }, { status: 400 });
        }

        const response = await fetch(`https://api.spotify.com/v1/me/tracks?ids=${ids.join(',')}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${session.accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('Failed to remove tracks');
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error removing tracks:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
