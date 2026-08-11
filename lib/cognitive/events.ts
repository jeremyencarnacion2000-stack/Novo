import { prisma } from '@/lib/prisma'

export const novoLoopEvents = [
  'onboarding_started', 'context_added', 'first_plan_generated', 'first_recommendation_viewed',
  'first_recommendation_accepted', 'first_action_started', 'first_action_completed',
  'checkout_viewed', 'checkout_opened', 'checkout_completed', 'subscription_activated',
  'payment_failed', 'subscription_cancelled',
  'objective_created', 'state_checkin_completed', 'plan_generated', 'recommendation_viewed',
  'recommendation_explanation_opened', 'recommendation_accepted', 'recommendation_modified',
  'recommendation_postponed', 'recommendation_dismissed', 'recommended_action_started',
  'recommended_action_completed', 'recommended_action_abandoned', 'recommended_action_failed',
  'intervention_marked_helpful', 'intervention_marked_unhelpful',
  'intervention_marked_intrusive',
  'integration_action_requested', 'integration_action_succeeded', 'integration_action_failed',
  'ai_run_started', 'ai_first_activity_event', 'ai_first_visible_token', 'ai_tool_started', 'ai_confirmation_requested',
  'ai_run_completed', 'ai_run_failed', 'ai_run_cancelled',
  'ai_run_reconnected', 'ai_polling_fallback', 'ai_run_retry',
  'mcp_tool_invoked', 'mcp_tool_completed', 'mcp_authorization_rejected',
] as const

export type NovoLoopEvent = (typeof novoLoopEvents)[number]

export async function trackNovoLoopEvent(userId: string, eventType: NovoLoopEvent, eventData: Record<string, unknown> = {}) {
  // Do not place sensitive task bodies, journal entries, OAuth data, or model
  // prompts in this generic analytics stream.
  await prisma.analyticsEvent.create({
    data: { userId, eventType, eventData: JSON.stringify(eventData) },
  })
}
