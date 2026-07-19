import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Settings > Danger Zone > "Delete all your data" used to only run
// localStorage.clear() client-side — every workspace item was still sitting
// in Postgres and reappeared on the next load, even though the button said
// "Permanently delete all workspace items... Cannot be undone." This is the
// server-side counterpart, scoped to exactly the resources
// DataIntegrator.exportData() already treats as "your data" (checklist,
// routines, projects, tasks, trackers) — the same set the Export Backup
// button downloads, so export/delete stay symmetric. Deliberately excludes
// auth records (User/Account/Session — the user stays logged in), billing
// (Subscription), and the behavioral pilot's ExperimentDay rows, none of
// which "delete my workspace data" should silently take out.
export async function DELETE() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id

    await prisma.$transaction([
      prisma.checklistItem.deleteMany({ where: { userId } }),
      prisma.routine.deleteMany({ where: { userId } }),
      prisma.project.deleteMany({ where: { userId } }),
      prisma.task.deleteMany({ where: { userId } }),
      prisma.tracker.deleteMany({ where: { userId } }),
    ])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting user data:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
