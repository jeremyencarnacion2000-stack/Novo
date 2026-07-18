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

// ── GET — Check Connection / Scope Status ────────────────────────────────────

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Find the Google Account for this user
    const googleAccount = await prisma.account.findFirst({
        where: {
            userId: session.user.id,
            provider: 'google',
        },
    });

    if (!googleAccount) {
        return NextResponse.json({
            connected: false,
            hasScope: false,
            message: 'Google account not connected to Novo',
        });
    }

    // Check if scope list contains drive.file
    const scopes = googleAccount.scope || '';
    const hasDriveScope = scopes.includes('https://www.googleapis.com/auth/drive.file') || scopes.includes('drive.file');

    return NextResponse.json({
        connected: true,
        hasScope: hasDriveScope,
        scopes,
        updatedAt: (googleAccount as any).updatedAt || new Date(),
    });
}

// ── POST — Trigger Workspace Backup ──────────────────────────────────────────

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Double-check if the google account exists and has Drive scope
    const googleAccount = await prisma.account.findFirst({
        where: {
            userId: session.user.id,
            provider: 'google',
        },
    });

    if (!googleAccount) {
        return NextResponse.json({ error: 'Google account not connected' }, { status: 400 });
    }

    const scopes = googleAccount.scope || '';
    const hasDriveScope = scopes.includes('https://www.googleapis.com/auth/drive.file') || scopes.includes('drive.file');

    if (!hasDriveScope) {
        return NextResponse.json({
            error: 'Insufficient permission. Google Drive access not granted.',
            code: 'MISSING_DRIVE_SCOPE',
        }, { status: 403 });
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
        const uploadResult = await driveService.exportWorkspaceBackup(backupPayload);

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

        return NextResponse.json({
            success: true,
            fileName: uploadResult.name,
            fileId: uploadResult.id,
            webViewLink: uploadResult.webViewLink,
        });

    } catch (err: any) {
        console.error('[Google Drive Backup] Export failed:', err);
        return NextResponse.json({
            error: 'Google Drive backup failed',
            detail: err.message || err,
        }, { status: 502 });
    }
}
