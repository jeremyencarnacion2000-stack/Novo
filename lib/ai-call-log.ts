import { prisma } from '@/lib/prisma'

// Evidence layer for autonomous AI operations: every real call to a model
// provider (Groq, Gemini, OpenRouter) that drives a production decision gets
// recorded here — model, tokens, latency, success. Wrap the call with
// `logAICall` at the point where the provider is actually invoked.

export interface AICallParams {
  userId: string
  provider: 'gemini' | 'groq' | 'openrouter'
  model: string
  purpose: string
}

export async function logAICall<T extends { tokensIn?: number; tokensOut?: number }>(
  params: AICallParams,
  fn: () => Promise<T>
): Promise<T> {
  const start = Date.now()
  try {
    const result = await fn()
    await prisma.aICallLog.create({
      data: {
        userId: params.userId,
        provider: params.provider,
        model: params.model,
        purpose: params.purpose,
        tokensIn: result.tokensIn,
        tokensOut: result.tokensOut,
        latencyMs: Date.now() - start,
        success: true,
      },
    }).catch(err => console.error('[AICallLog] Failed to persist success log:', err))
    return result
  } catch (error) {
    await prisma.aICallLog.create({
      data: {
        userId: params.userId,
        provider: params.provider,
        model: params.model,
        purpose: params.purpose,
        latencyMs: Date.now() - start,
        success: false,
        // Provider responses can contain prompts, account identifiers or
        // transport diagnostics. Persist only a stable operational code.
        errorMessage: 'provider_call_failed',
      },
    }).catch(err => console.error('[AICallLog] Failed to persist failure log:', err))
    throw error
  }
}
