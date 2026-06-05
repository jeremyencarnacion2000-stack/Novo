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

        console.log(`[Execute Route] Incoming Action:`, JSON.stringify(action, null, 2));
        const result = await executeAIAction(action, userId);
        console.log(`[Execute Route] Result:`, JSON.stringify(result, null, 2));

        return NextResponse.json({
            success: result.success,
            output: result.success ? (result.message || JSON.stringify(result.data, null, 2)) : (result.error || result.message || 'Unknown execution error'),
            metadata: {
                ...(result.metadata || {}),
                ...(result.data || {})
            }
        });

    } catch (error) {
        console.error('Error executing action:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal server error' },
            { status: 500 }
        );
    }
}
