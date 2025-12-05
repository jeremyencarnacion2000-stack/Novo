import { z } from 'zod'

export const clientSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address').optional().nullable(),
  phone: z.string().optional().nullable(),
  status: z.enum(['active', 'inactive']).default('active'),
})

export const updateClientSchema = clientSchema.partial()
