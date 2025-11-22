import { ConversationMessage } from '@/types/ai';

export interface KiloAuthResponse {
  hasAuth: boolean;
  kiloUserId?: string;
}

export interface KiloAPIResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

export class KiloAPIClient {
  private static instance: KiloAPIClient;
  private apiKey: string | null = null;

  private constructor() {
    this.apiKey = process.env.KILO_API_KEY || null;
  }

  static getInstance(): KiloAPIClient {
    if (!KiloAPIClient.instance) {
      KiloAPIClient.instance = new KiloAPIClient();
    }
    return KiloAPIClient.instance;
  }

  /**
   * Check if the current user has Kilo authentication
   */
  async checkAuth(): Promise<KiloAuthResponse> {
    try {
      const response = await fetch('/api/auth/check-kilo', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to check Kilo auth: ${response.status}`);
      }

      const data = await response.json();
      return {
        hasAuth: data.hasKiloAuth,
        kiloUserId: data.kiloUserId,
      };
    } catch (error) {
      console.error('Error checking Kilo auth:', error);
      return { hasAuth: false };
    }
  }

  /**
   * Initiate Kilo authentication flow
   */
  initiateAuth(): void {
    window.location.href = '/api/kilo/auth';
  }

  /**
   * Call the Kilo AI API for chat completions
   */
  async generateResponse(
    message: string,
    context: string,
    history: ConversationMessage[] = []
  ): Promise<string> {
    if (!this.apiKey) {
      throw new Error('KILO_API_KEY not configured');
    }

    // Check auth first
    const auth = await this.checkAuth();
    if (!auth.hasAuth) {
      throw new Error('User not authenticated with Kilo');
    }

    // Prepare messages: system context + history + new message
    const messages = [
      { role: 'system', content: context },
      ...history.map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: message }
    ];

    const response = await fetch('https://api.kilo.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: 'grok-code-fast-1',
        messages,
        temperature: 0.7,
        max_tokens: 2048,
        top_p: 1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Kilo API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data: KiloAPIResponse = await response.json();

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('Invalid response format from Kilo API');
    }

    return data.choices[0].message.content || 'Sorry, I could not generate a response.';
  }

  /**
   * Get available Kilo models (if needed)
   */
  async getModels(): Promise<string[]> {
    // This could be expanded if Kilo provides a models endpoint
    return ['grok-code-fast-1'];
  }
}

export const kiloAPI = KiloAPIClient.getInstance();