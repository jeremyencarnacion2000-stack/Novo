import { ConversationMessage } from '@/types/ai';

export interface GrokAPIResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

export class GrokAPIClient {
  private static instance: GrokAPIClient;
  private apiKey: string | null = null;

  private constructor() {
    this.apiKey = process.env.GROK_API_KEY || null;
  }

  static getInstance(): GrokAPIClient {
    if (!GrokAPIClient.instance) {
      GrokAPIClient.instance = new GrokAPIClient();
    }
    return GrokAPIClient.instance;
  }

  /**
   * Call the xAI Grok API for chat completions
   */
  async generateResponse(
    message: string,
    context: string,
    history: ConversationMessage[] = []
  ): Promise<string> {
    if (!this.apiKey) {
      throw new Error('GROK_API_KEY not configured');
    }

    // Prepare messages: system context + history + new message
    const messages = [
      { role: 'system', content: context },
      ...history.map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: message }
    ];

    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: 'grok-beta', // or 'grok-2' depending on available models
        messages,
        temperature: 0.7,
        max_tokens: 2048,
        top_p: 1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Grok API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data: GrokAPIResponse = await response.json();

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('Invalid response format from Grok API');
    }

    return data.choices[0].message.content || 'Sorry, I could not generate a response.';
  }

  /**
   * Get available Grok models
   */
  async getModels(): Promise<string[]> {
    // xAI provides these models (as of current knowledge)
    return ['grok-beta', 'grok-2'];
  }
}

export const grokAPI = GrokAPIClient.getInstance();