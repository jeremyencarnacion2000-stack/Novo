import { NextRequest, NextResponse } from 'next/server';
import { executeAIAction, pickDisplayableFields } from '@/lib/ai/executor';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const userId = session.user.id;

        const { action } = await request.json();

        if (!action) {
            return NextResponse.json({ error: 'Action is required' }, { status: 400 });
        }

        const actionType = typeof action === 'object' && action
            ? String((action as { type?: unknown; name?: unknown }).type ?? (action as { name?: unknown }).name ?? '').toUpperCase()
            : ''
        // These legacy actions can alter cognitive state and trigger chained
        // effects. They must use the persisted Novo Loop proposal/confirmation
        // path, never this generic executor endpoint.
        if (actionType === 'UPDATE_COGNITIVE_STATE' || actionType === 'COGNITIVE_PIPELINE') {
            return NextResponse.json(
                { error: 'ConfirmationRequired', message: 'Esta acción debe confirmarse desde el ciclo operativo de Novo.' },
                { status: 409 }
            )
        }

        const result = await executeAIAction(action, userId);

        return NextResponse.json({
            success: result.success,
            output: result.success ? (result.message || JSON.stringify(result.data, null, 2)) : (result.message || 'No se pudo completar la acción.'),
            code: result.success ? undefined : result.error,
            metadata: {
                ...(result.metadata || {}),
                ...pickDisplayableFields(result.data)
            }
        });

    } catch {
        console.error('[Execute Route] Action execution failed.');
        return NextResponse.json(
            { error: 'InternalError', message: 'No se pudo ejecutar la acción.' },
            { status: 500 }
        );
    }
}
