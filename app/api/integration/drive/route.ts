/**
 * /api/integration/drive
 *
 * GET  — Checks if the Google integration includes the 'drive.file' scope.
 * POST — Gathers user's settings, checklist, routines, projects, tasks, trackers,
 *        builds the workspace backup payload, and uploads it to Google Drive.
 */

import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { driveService } from '@/lib/google';
import { findGoogleAccountForScopes } from '@/lib/google-account';
import { readIdempotencyKey } from '@/lib/server-idempotency';

// ── GET — Check Connection / Scope Status ────────────────────────────────────

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // A user can have a basic Google login row alongside an incremental
    // connector grant. Select the account that actually owns Drive scope.
    const googleAccount = await findGoogleAccountForScopes(session.user.id, ['drive.file']);

    if (!googleAccount) {
        return NextResponse.json({
            connected: false,
            hasScope: false,
            message: 'Google account not connected to Novo',
        });
    }

    return NextResponse.json({
        connected: true,
        hasScope: true,
    });
}

// ── POST — Trigger Workspace Backup ──────────────────────────────────────────

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const idempotency = readIdempotencyKey(req);
    if (idempotency.invalid) {
        return NextResponse.json({ error: 'InvalidIdempotencyKey' }, { status: 400 });
    }

    // Select the specific incremental grant rather than whichever Google
    // account row happens to sort first.
    const googleAccount = await findGoogleAccountForScopes(session.user.id, ['drive.file']);

    if (!googleAccount) {
        return NextResponse.json({ error: 'Google account not connected' }, { status: 400 });
    }

    try {
        // Read client-provided settings from request body (since settings live in localStorage)
        const body = await req.json().catch(() => ({}));
        const settings = body.settings || {};

        // Gather database collections
        const [checklist, routines, projects, tasks, trackers] = await Promise.all([
            prisma.checklistItem.findMany({ where: { userId: session.user.id } }),
            prisma.routine.findMany({ where: { userId: session.user.id }, include: { tasks: true } }),
            prisma.project.findMany({ where: { userId: session.user.id }, include: { subtasks: true } }),
            prisma.task.findMany({ where: { userId: session.user.id } }),
            prisma.tracker.findMany({ where: { userId: session.user.id } }),
        ]);

        // Construct standardized backup structure matching DataIntegrator shape
        const backupPayload = {
            version: '1.0',
            timestamp: new Date().toISOString(),
            settings,
            checklist,
            routines,
            projects,
            tasks,
            trackers,
        };

        // Export to Google Drive
        const uploadResult = await driveService.exportWorkspaceBackup(backupPayload, idempotency.key ?? undefined);

        // Record activity history
        try {
            await prisma.activityHistory.create({
                data: {
                    userId: session.user.id,
                    activity: `Saved backup to Google Drive: ${uploadResult.name}`,
                    date: new Date().toISOString(),
                }
            });
        } catch {
            // Non-critical — the backup itself already succeeded
        }

        const response = NextResponse.json({
            success: true,
            fileName: uploadResult.name,
            fileId: uploadResult.id,
            webViewLink: uploadResult.webViewLink,
        });
        if (uploadResult.replayed) response.headers.set('X-Idempotent-Replay', 'true');
        return response;

    } catch {
        // Provider diagnostics stay server-side; the UI only needs a stable,
        // retryable code and must never receive Google SDK/auth details.
        console.error('[Google Drive Backup] Export failed.');
        return NextResponse.json({
            error: 'Google Drive backup failed',
            code: 'DRIVE_EXPORT_FAILED',
        }, { status: 502 });
    }
}
