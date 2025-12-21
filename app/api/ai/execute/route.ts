import { NextRequest, NextResponse } from 'next/server';
import { executeAIAction } from '@/lib/ai/executor';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        const userId = session?.user?.id || 'demo-user-id';

        const { action } = await request.json();

        if (!action) {
            return NextResponse.json({ error: 'Action is required' }, { status: 400 });
        }

        console.log(`[Execute Route] Executing action: ${action.type}`);
        const result = await executeAIAction(action, userId);

        return NextResponse.json({
            success: result.success,
            output: result.message || JSON.stringify(result.data, null, 2),
            metadata: result.data
        });

    } catch (error) {
        console.error('Error executing action:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal server error' },
            { status: 500 }
        );
    }
}
