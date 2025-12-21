import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { internalAI } from '@/lib/internal-ai/service';

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return new NextResponse('Unauthorized', { status: 401 });
        }

        const body = await req.json();
        const { content } = body;

        if (!content) {
            return new NextResponse('Content is required', { status: 400 });
        }

        // Execute internal AI action
        const result = await internalAI.execute('categorize_note', { content }, session.user.id);

        if (!result.success) {
            return new NextResponse(result.error || 'Failed to categorize note', { status: 500 });
        }

        return NextResponse.json(result.data);
    } catch (error) {
        console.error('[NOTES_CATEGORIZE]', error);
        return new NextResponse('Internal Error', { status: 500 });
    }
}
