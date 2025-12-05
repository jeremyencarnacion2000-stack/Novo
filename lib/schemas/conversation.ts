import { z } from 'zod'

export const conversationMessageSchema = z.object({
  role: z.string().min(1, 'Message role is required'),
  content: z.string().min(1, 'Message content is required'),
  createdAt: z.string().datetime('Invalid date').optional(),
})

export const createConversationSchema = z.object({
  title: z.string().min(1, 'Title is required').optional(),
  messages: z.array(conversationMessageSchema).optional().default([]),
})

export const getConversationsSchema = z.object({
  skip: z.coerce.number().int().min(0).optional().default(0),
  take: z.coerce.number().int().min(1).optional().default(20),
})

export const updateConversationSchema = createConversationSchema.partial()