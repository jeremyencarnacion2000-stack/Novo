import { ConversationMessage } from '@/types/ai';
import Replicate from 'replicate';

export interface ReplicateFunctionCall {
  name: string;
  args: Record<string, any>;
}

export interface ReplicateAPIResponse {
  output: string;
}

export class ReplicateAPIClient {
  private static instance: ReplicateAPIClient;
  private replicate: Replicate | null = null;

  private constructor() {}

  static getInstance(): ReplicateAPIClient {
    if (!ReplicateAPIClient.instance) {
      ReplicateAPIClient.instance = new ReplicateAPIClient();
    }
    return ReplicateAPIClient.instance;
  }

  /**
     * Call Replicate API
     */
  async generateResponse(
    message: string,
    context: string,
    history: ConversationMessage[] = [],
    systemPrompt?: string
  ): Promise<{ content: string; functionCalls: ReplicateFunctionCall[] }> {
    if (!this.replicate) {
      const REPLICATE_API_KEY = process.env.NEXT_PUBLIC_REPLICATE_API_KEY;
      if (!REPLICATE_API_KEY) {
        throw new Error('NEXT_PUBLIC_REPLICATE_API_KEY is required for Replicate API');
      }
      this.replicate = new Replicate({
        auth: REPLICATE_API_KEY,
      });
    }

    // Build conversation history for Replicate
    let conversationText = '';

    // Add system prompt
    if (systemPrompt) {
      conversationText += `System: ${systemPrompt}\n\n`;
    }

    // Add history
    history.forEach(h => {
      const role = h.role === 'user' ? 'User' : 'Assistant';
      conversationText += `${role}: ${h.content}\n`;
    });

    // Add current message
    conversationText += `User: ${message}\nAssistant:`;

    try {
      // Use Gemini 3 Pro model for chat
      const output = await this.replicate.run(
        "google/gemini-3-pro",
        {
          input: {
            prompt: conversationText,
            max_tokens: 1024,
            temperature: 0.7,
            top_p: 0.9,
            system_prompt: systemPrompt || "Eres un asistente útil que responde en español.",
          }
        }
      );

      let content = '';
      if (typeof output === 'string') {
        content = output;
      } else if (Array.isArray(output)) {
        content = output.join('');
      } else {
        content = String(output);
      }

      // For now, no function calls support in this simple implementation
      const functionCalls: ReplicateFunctionCall[] = [];

      return { content: content || 'Lo siento, no pude generar una respuesta.', functionCalls };
    } catch (error) {
      console.error('Replicate API error:', error);
      throw new Error(`Replicate API error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
     * Get available Replicate models
     */
  async getModels(): Promise<string[]> {
    return ['google/gemini-3-pro'];
  }
}

export const replicateAPI = ReplicateAPIClient.getInstance();