import { z } from 'zod'
import {projectHintSchema,localConnectionsSchema} from '@/lib/ai/project-links'

export const companionCapabilitiesSchema = z.object({
  deviceConnect:z.boolean(), aiChat:z.boolean(), twinRead:z.boolean(),
  integrationsRead:z.boolean(), activityRead:z.boolean(), activityWrite:z.boolean(),
  workContextRead:z.boolean(), workContextWrite:z.boolean(),
}).strict()
export type CompanionCapabilities = z.infer<typeof companionCapabilitiesSchema>

export function companionCapabilities(scopes: ReadonlySet<string>): CompanionCapabilities {
  return {deviceConnect:scopes.has('device:connect'), aiChat:scopes.has('ai:chat'),
    twinRead:scopes.has('twin:read'), integrationsRead:scopes.has('integrations:read'),
    activityRead:scopes.has('device:activity:read'), activityWrite:scopes.has('device:activity:write'),
    workContextRead:scopes.has('device:work-context:read'), workContextWrite:scopes.has('device:work-context:write')}
}

export const companionDeviceViewSchema = z.object({
  id:z.string().uuid(), name:z.string().trim().min(1).max(80), platform:z.literal('windows'),
  connectedAt:z.string().datetime(), lastVerifiedAt:z.string().datetime(),
  revokedAt:z.string().datetime().nullable(), scopes:z.array(z.string().max(120)),
}).strict()
export type CompanionDeviceView = z.infer<typeof companionDeviceViewSchema>

export const companionAuthorizationSchema = z.object({
  version:z.literal(1), state:z.enum(['connected', 'permission_required', 'revoked']),
  user:z.object({id:z.string().min(1), displayName:z.string().nullable()}).strict(),
  device:companionDeviceViewSchema.nullable(), capabilities:companionCapabilitiesSchema,
}).strict()
export type CompanionAuthorization = z.infer<typeof companionAuthorizationSchema>

export const companionChatRequestSchema = z.object({
  requestId:z.string().uuid(), conversationId:z.string().min(1).max(200).nullable(),
  conversationRevision:z.number().int().nonnegative().nullable(),
  message:z.string().trim().min(1).max(12_000), model:z.string().trim().min(1).max(120), twinMode:z.boolean(),
  localContext:z.string().max(16_000).optional(),
  projectHints:z.array(projectHintSchema).max(32).optional(),
  localConnections:localConnectionsSchema.optional(),
}).strict().refine(input => (input.conversationId === null) === (input.conversationRevision === null), {
  message:'conversation_and_revision_required_together', path:['conversationRevision'],
})
export type CompanionChatRequest = z.infer<typeof companionChatRequestSchema>

export const novoChatModelSchema = z.object({id:z.string().min(1).max(120), label:z.string().min(1).max(120), allowsTwinMode:z.boolean()}).strict()
export type NovoChatModel = z.infer<typeof novoChatModelSchema>

// Existing activity phases only. No raw provider messages, arbitrary tool
// names, tokens or private context are allowed in transport error/phase fields.
export const companionPhaseSchema = z.enum(['initializing', 'retrieving_context', 'interpreting_signals', 'composing_response', 'completed', 'failed', 'cancelled'])
export const companionChatErrorSchema = z.enum(['unauthorized', 'permission_required', 'device_revoked', 'model_unavailable', 'twin_permission_required', 'revision_conflict', 'request_conflict', 'turn_active', 'provider_unavailable', 'stream_interrupted', 'cancelled', 'request_expired', 'chat_disabled', 'internal_error'])
const requestId = z.string().uuid()
export const companionChatEventSchema = z.discriminatedUnion('type', [
  z.object({type:z.literal('metadata'), requestId, conversationId:z.string().min(1).max(200), revision:z.number().int().nonnegative(), userMessageId:z.string().uuid()}).strict(),
  z.object({type:z.literal('phase'), requestId, phase:companionPhaseSchema}).strict(),
  z.object({type:z.literal('delta'), requestId, text:z.string()}).strict(),
  z.object({type:z.literal('complete'), requestId, assistantMessageId:z.string().uuid(), revision:z.number().int().nonnegative(), modelId:z.string().min(1).max(120)}).strict(),
  z.object({type:z.literal('error'), requestId, code:companionChatErrorSchema}).strict(),
])
export type CompanionChatEvent = z.infer<typeof companionChatEventSchema>
