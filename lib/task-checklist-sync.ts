import { isSameDay, parseISO } from 'date-fns'
import { prisma } from '@/lib/prisma'
import { withProviderSyncLock } from '@/lib/provider-sync-lock'

/**
 * Keeps the generated checklist mirror of a task in sync. The task is the
 * canonical record: only tasks due today get a checklist row, and a linked
 * row is removed when the task moves out of today. The advisory lock makes
 * retries and autosave races converge on one row instead of creating copies.
 */
export async function syncTaskChecklist(input: {
  userId: string
  taskId: string
  title: string
  priority: string
  status: string
  dueDate?: string | null
}) {
  const dueToday = Boolean(input.dueDate && isSameDay(parseISO(input.dueDate), new Date()))

  await withProviderSyncLock(prisma, `novo:task-checklist:${input.userId}:${input.taskId}`, async (tx) => {
    const existing = await tx.checklistItem.findFirst({
      where: { userId: input.userId, taskId: input.taskId },
      select: { id: true },
    })

    if (!dueToday) {
      if (existing) await tx.checklistItem.delete({ where: { id: existing.id } })
      return
    }

    if (existing) {
      await tx.checklistItem.update({
        where: { id: existing.id },
        data: {
          text: input.title,
          priority: input.priority,
          ...(input.status === 'done' ? { completed: true } : {}),
        },
      })
      return
    }

    await tx.checklistItem.create({
      data: {
        text: input.title,
        completed: input.status === 'done',
        priority: input.priority,
        userId: input.userId,
        taskId: input.taskId,
      },
    })
  })
}
