import { google } from 'googleapis'
import { prisma } from '@/lib/prisma'
import { getGoogleAccessToken } from '@/lib/google'

const MARKER = 'novo-task:'

function dayBounds(value: string) {
  const day = value.slice(0, 10)
  const start = new Date(`${day}T00:00:00`)
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  return { day, start, end }
}

/** Keeps a task's due date represented in Novo Calendar and, when available, Google Calendar. */
export async function syncTaskToCalendars(input: {
  userId: string
  taskId: string
  title: string
  dueDate?: string | null
  priority?: string | null
  accessToken?: string | null
}) {
  const marker = `${MARKER}${input.taskId}`
  const existing = await prisma.calendarEvent.findFirst({
    where: { userId: input.userId, source: 'novo', description: { startsWith: marker } },
  })

  if (!input.dueDate) {
    if (existing?.googleEventId) {
      await deleteGoogleEvent(input.userId, existing.googleEventId, input.accessToken)
    }
    if (existing) await prisma.calendarEvent.delete({ where: { id: existing.id } })
    return
  }

  const { day, start, end } = dayBounds(input.dueDate)
  const description = `${marker}\nPriority: ${input.priority ?? 'medium'}`
  let localEvent = existing
    ? await prisma.calendarEvent.update({
        where: { id: existing.id },
        data: { title: input.title, description, start, end, allDay: true },
      })
    : await prisma.calendarEvent.create({
        data: { userId: input.userId, title: input.title, description, start, end, allDay: true, source: 'novo' },
      })

  const googleEventId = await upsertGoogleEvent(input.userId, input.title, description, day, existing?.googleEventId, input.accessToken)
  if (googleEventId && googleEventId !== localEvent.googleEventId) {
    localEvent = await prisma.calendarEvent.update({ where: { id: localEvent.id }, data: { googleEventId } })
  }
  return localEvent
}

async function googleCalendar(userId: string, accessToken?: string | null) {
  const token = await getGoogleAccessToken(userId, accessToken ?? undefined)
  if (!token) return null
  const auth = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET)
  auth.setCredentials({ access_token: token })
  return google.calendar({ version: 'v3', auth })
}

async function upsertGoogleEvent(userId: string, title: string, description: string, day: string, eventId?: string | null, accessToken?: string | null) {
  try {
    const calendar = await googleCalendar(userId, accessToken)
    if (!calendar) return null
    const requestBody = { summary: title, description, start: { date: day }, end: { date: nextDay(day) } }
    if (eventId) {
      try {
        await calendar.events.update({ calendarId: 'primary', eventId, requestBody })
        return eventId
      } catch {
        // The remote event may have been deleted; recreate it below.
      }
    }
    const created = await calendar.events.insert({ calendarId: 'primary', requestBody })
    return created.data.id ?? null
  } catch (error) {
    console.warn('[task-calendar-sync] Google Calendar unavailable:', error instanceof Error ? error.message : error)
    return null
  }
}

async function deleteGoogleEvent(userId: string, eventId: string, accessToken?: string | null) {
  try {
    const calendar = await googleCalendar(userId, accessToken)
    if (calendar) await calendar.events.delete({ calendarId: 'primary', eventId })
  } catch (error) {
    console.warn('[task-calendar-sync] Could not delete Google event:', error instanceof Error ? error.message : error)
  }
}

function nextDay(day: string) {
  const date = new Date(`${day}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + 1)
  return date.toISOString().slice(0, 10)
}
