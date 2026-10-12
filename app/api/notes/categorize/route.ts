import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { internalAI } from '@/lib/internal-ai/service';
import { z } from 'zod';

const categorizeSchema = z.object({
    content: z.string().trim().min(1).max(20_000),
});

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const parsed = categorizeSchema.safeParse(await req.json());
        if (!parsed.success) {
            return NextResponse.json({ error: 'Invalid note content' }, { status: 400 });
        }
        const { content } = parsed.data;

        // Execute internal AI action
        const result = await internalAI.execute('categorize_note', { content }, session.user.id);

        if (!result.success) {
            return NextResponse.json({
                error: 'Note categorization unavailable',
                code: 'NOTE_CATEGORIZATION_FAILED',
            }, { status: 500 });
        }

        return NextResponse.json(result.data);
    } catch {
        console.error('[NOTES_CATEGORIZE] Request failed.');
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}
