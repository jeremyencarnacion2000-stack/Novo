import fs from 'node:fs'
import path from 'node:path'

const source = (relativePath: string) =>
  fs.readFileSync(path.join(process.cwd(), ...relativePath.split('/')), 'utf8')

describe('private request and provider log hygiene', () => {
  it('does not log task or project request bodies', () => {
    expect(source('app/api/tasks/route.ts')).not.toContain("console.log('Creating task with body:'")
    expect(source('app/api/projects/route.ts')).not.toContain("console.log('Creating project with body:'")
  })

  it('does not log or return raw Grok provider diagnostics', () => {
    const client = source('lib/grok.ts')
    const route = source('app/api/grok/chat/route.ts')

    expect(client).not.toContain('API error response body:')
    expect(client).not.toContain('Grok API error: ${error instanceof Error ? error.message')
    expect(route).not.toContain("{ error: error instanceof Error ? error.message : 'Unknown error' }")
    expect(route).toContain("{ error: 'AssistantUnavailable'")
  })

  it('does not expose note categorization diagnostics', () => {
    const route = source('app/api/notes/categorize/route.ts')
    const action = source('lib/internal-ai/actions/notes.ts')

    expect(route).not.toContain('result.error ||')
    expect(route).toContain('NOTE_CATEGORIZATION_FAILED')
    expect(action).not.toContain('llmError)')
    expect(action).toContain('falling back to keywords.')
    const internalAi = source('lib/internal-ai/service.ts')
    expect(internalAi).not.toContain("error: error instanceof Error ? error.message")
    expect(internalAi).toContain("error: 'INTERNAL_ACTION_FAILED'")
    expect(internalAi).toContain("error: 'PROCESSOR_NOT_FOUND'")
    for (const action of [
      source('lib/internal-ai/actions/tasks.ts'),
      source('lib/internal-ai/actions/projects.ts'),
      source('lib/internal-ai/actions/routines.ts'),
      source('lib/internal-ai/actions/settings.ts'),
      source('lib/internal-ai/actions/analytics.ts'),
      source('lib/internal-ai/processors/image.ts'),
      source('lib/internal-ai/processors/file.ts'),
      source('lib/internal-ai/processors/context.ts'),
    ]) {
      expect(action).not.toContain('error instanceof Error ? error.message')
    }
  })

  it('does not expose a fake note-creation action', () => {
    const action = source('lib/internal-ai/actions/notes.ts')
    expect(action).not.toContain("registerAction('create_note'")
    expect(action).not.toContain('Mock implementation')
  })

  it('keeps provider prompts and error bodies out of server logs', () => {
    const openRouter = source('lib/openrouter.ts')
    const groq = source('lib/groq.ts')
    const chutes = source('lib/chutes.ts')
    const dashscope = source('lib/dashscope.ts')
    const routineParser = source('app/api/routines/parse/route.ts')
    const dayPlan = source('lib/ai/day-plan-generator.ts')
    const documentParser = source('app/api/ai/parse-document/route.ts')
    const chatSession = source('app/api/ai/chat-session/route.ts')
    const aiConversations = source('app/api/ai-conversations/route.ts')
    const aiConversationById = source('app/api/ai-conversations/[id]/route.ts')
    const onboarding = source('app/api/onboarding/analyze/route.ts')
    const googleFit = source('lib/google-fit.ts')
    const googleCalendarRoute = source('app/api/calendar/google/route.ts')
    const notion = source('lib/notion.ts')
    const integrationEngine = source('lib/integration-engine.ts')
    const youtubeSearch = source('app/api/youtube/search/route.ts')
    const musicRoutes = [
      source('app/api/music/liked/route.ts'),
      source('app/api/music/history/route.ts'),
      source('app/api/music/playlists/route.ts'),
      source('app/api/music/playlists/[id]/route.ts'),
    ]
    const ytmusicRoutes = [
      source('app/api/ytmusic/top/route.ts'),
      source('app/api/ytmusic/status/route.ts'),
      source('app/api/ytmusic/search/route.ts'),
      source('app/api/ytmusic/recommendations/route.ts'),
      source('app/api/ytmusic/home/route.ts'),
      source('app/api/ytmusic/artist/[id]/route.ts'),
      source('app/api/ytmusic/album/[id]/route.ts'),
      source('app/api/ytmusic/playlists/[id]/tracks/route.ts'),
    ]
    const stripeWebhook = source('app/api/webhooks/stripe/route.ts')
    const lemonWebhook = source('app/api/webhooks/lemonsqueezy/route.ts')
    const eventBus = source('lib/internal-ai/events.ts')
    const legacyFunctions = source('lib/ai-functions.ts')
    const analyticsRoute = source('app/api/analytics/route.ts')
    const appErrorBoundary = source('app/error.tsx')
    const uiErrorBoundary = source('components/ui/error-boundary.tsx')
    const connectorCallbacks = [
      source('app/api/integration/slack/callback/route.ts'),
      source('app/api/integration/notion/callback/route.ts'),
      source('app/api/integration/todoist/callback/route.ts'),
    ]
    const userDataRoutes = [
      source('app/api/books/route.ts'),
      source('app/api/books/[id]/route.ts'),
      source('app/api/tasks/route.ts'),
      source('app/api/tasks/[id]/route.ts'),
      source('app/api/projects/route.ts'),
      source('app/api/projects/[id]/route.ts'),
      source('app/api/goals/route.ts'),
      source('app/api/goals/[id]/route.ts'),
      source('app/api/routines/route.ts'),
      source('app/api/routines/[id]/route.ts'),
      source('app/api/notes/route.ts'),
      source('app/api/notes/[id]/route.ts'),
      source('app/api/checklist/route.ts'),
      source('app/api/checklist/[id]/route.ts'),
      source('app/api/trackers/route.ts'),
      source('app/api/trackers/[id]/route.ts'),
      source('app/api/subjects/route.ts'),
      source('app/api/subjects/[id]/route.ts'),
      source('app/api/gratitudes/route.ts'),
      source('app/api/gratitudes/[id]/route.ts'),
      source('app/api/clients/route.ts'),
      source('app/api/clients/[id]/route.ts'),
      source('app/api/routines/completions/route.ts'),
      source('app/api/trackers/[id]/entries/route.ts'),
      source('app/api/device/presence/route.ts'),
      source('app/api/users/search/route.ts'),
      source('app/api/integration/urgent/route.ts'),
      source('app/api/integration/todoist/callback/route.ts'),
      source('app/api/integration/today/route.ts'),
      source('app/api/user-settings/route.ts'),
      source('app/api/profile/route.ts'),
      source('app/api/onboarding/day-plan/route.ts'),
      source('app/api/user/data/route.ts'),
      source('app/api/activity-history/[id]/route.ts'),
      source('app/api/ai/code-execute/route.ts'),
      source('app/api/stats/productivity/route.ts'),
      source('app/api/fitness/route.ts'),
      source('app/api/business/route.ts'),
      source('app/api/business/deals/route.ts'),
      source('app/api/business/deals/[id]/route.ts'),
      source('app/api/business/analytics/route.ts'),
      source('app/api/artifacts/generate/route.ts'),
      source('app/api/messages/route.ts'),
      source('app/api/music/follow/route.ts'),
      source('app/api/school/grades/route.ts'),
      source('app/api/school/grades/[id]/route.ts'),
      source('app/api/school/courses/route.ts'),
      source('app/api/school/courses/[id]/route.ts'),
      source('app/api/school/analytics/route.ts'),
      source('app/api/templates/route.ts'),
      source('app/api/templates/[id]/route.ts'),
      source('app/api/experiment/today/route.ts'),
      source('app/api/cognitive-twin/sync/route.ts'),
      source('app/api/mcp/tokens/route.ts'),
    ]

    for (const client of [openRouter, groq, chutes, dashscope]) {
      expect(client).not.toContain('lastMessage:')
      expect(client).not.toContain('errorText')
    }
    expect(routineParser).not.toContain("console.error('Failed to parse LLM response as JSON:', cleanedResult)")
    expect(routineParser).not.toContain('groqError')
    expect(routineParser).not.toContain('orError')
    expect(dayPlan).not.toContain('groqError)')
    expect(dayPlan).toContain("{ provider: 'groq' }")
    expect(documentParser).not.toContain("console.error('[Document Parse] Error:', error)")
    expect(chatSession).not.toContain("Error fetching chat session:', error")
    expect(aiConversations).not.toContain("Error fetching AI conversations:', error")
    expect(aiConversations).not.toContain("Error creating AI conversation:', error")
    expect(aiConversationById).not.toContain("Error fetching AI conversation:', error")
    expect(aiConversationById).not.toContain("Error updating AI conversation:', error")
    expect(aiConversationById).not.toContain("Error deleting AI conversation:', error")
    expect(aiConversationById).not.toContain('let payloadSize')
    expect(onboarding).not.toContain('groqError)')
    expect(onboarding).not.toContain("request failed', error")
    expect(googleFit).not.toContain('errorBody)')
    expect(googleFit).not.toContain('Network error:, networkError')
    expect(googleCalendarRoute).not.toContain('calendarError')
    expect(googleCalendarRoute).not.toContain('Error creating calendar event:', 'Google Calendar route must not log raw provider/DB errors')
    expect(notion).not.toContain('database ${dbId}:`, err')
    expect(integrationEngine).not.toContain('notionError)')
    expect(integrationEngine).not.toContain('todoistError)')
    expect(youtubeSearch).not.toContain('songErr)')
    expect(youtubeSearch).not.toContain('videoErr)')
    expect(youtubeSearch).not.toContain('Critical error:, error')
    for (const route of ytmusicRoutes) {
      expect(route).not.toMatch(/console\.(error|warn)\([^\n]*,\s*(error|err|e)\s*\)/)
    }
    for (const route of musicRoutes) {
      expect(route).not.toMatch(/console\.(error|warn)\([^\n]*,\s*(error|err|e)\s*\)/)
    }
    expect(stripeWebhook).not.toContain('verification failed:, err')
    expect(stripeWebhook).not.toContain('Handler error:, error')
    expect(lemonWebhook).not.toContain('Handler error:, error')
    expect(eventBus).not.toContain('], event)')
    expect(legacyFunctions).not.toContain('error.message}`')
    expect(legacyFunctions).toContain("message: 'No se pudo completar la acción.'")
    expect(analyticsRoute).not.toMatch(/console\.error\([^\n]*,\s*(error|err|e|insightError|streakError)\s*\)/)
    expect(appErrorBoundary).not.toContain("console.error('[Novo Error Boundary]', error)")
    expect(uiErrorBoundary).not.toContain('this.state.error?.message')
    expect(uiErrorBoundary).not.toContain('console.error(\'Uncaught error:\', error')
    for (const callback of connectorCallbacks) {
      expect(callback).not.toMatch(/console\.log\([^\n]*(session\.user\.id|team|workspace)/i)
    }
    for (const route of userDataRoutes) {
      expect(route).not.toMatch(/console\.(error|warn)\([^\n]*,\s*(error|err|e|calendarError)\s*\)/)
    }
  })

  it('does not expose OAuth credentials through the browser session', () => {
    const auth = source('lib/auth.ts')
    expect(auth).not.toContain('session.accessToken =')
    expect(auth).not.toContain('session.refreshToken =')
    expect(auth).not.toContain('session.provider =')
  })

  it('keeps calendar webhook content private and owner-scoped', () => {
    const webhook = source('app/api/webhooks/calendar/route.ts')
    expect(webhook).not.toContain('event.summary`')
    expect(webhook).not.toContain('user ID:', 'Calendar webhook logs must not include account identifiers')
    expect(webhook).toContain('deleteMany({')
    expect(webhook).toContain('googleEventId: event.id, userId')
    expect(webhook).toContain('existing.userId !== userId')
  })

  it('does not persist or log raw Twin Agent failures', () => {
    const route = source('app/api/cognitive/agent-actions/route.ts')
    const agent = source('lib/cognitive/twin-agent.ts')

    expect(route).not.toContain("console.error('[twin-agent/run] Error:', err)")
    expect(route).not.toContain("console.error('[twin-agent/logs] Error:', err)")
    expect(agent).not.toContain('String(err)')
    expect(agent).not.toContain("console.error('[TwinAgent] Failed to log action:', err)")
  })

  it('keeps ambient planning and provider call diagnostics out of durable state', () => {
    const ambient = source('lib/cognitive/ambient-twin-runtime.ts')
    const todoist = source('lib/cognitive-reconciliation/todoist-ambient-runner.ts')
    const aiLog = source('lib/ai-call-log.ts')

    expect(ambient).not.toContain('planningError = error instanceof Error ? error.message')
    expect(ambient).toContain("planningError = 'ambient_planning_failed'")
    expect(todoist).not.toContain('error.message :')
    expect(todoist).toContain("failClaim(claim.claimId, 'todoist_ambient_failed')")
    expect(aiLog).not.toContain('error.message.slice(0, 500)')
    expect(aiLog).toContain("errorMessage: 'provider_call_failed'")
  })
})
