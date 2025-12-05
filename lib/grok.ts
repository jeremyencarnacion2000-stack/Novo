import { ConversationMessage } from '@/types/ai';

export interface GrokFunctionCall {
  name: string;
  args: Record<string, any>;
}

export interface GrokTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, any>;
      required: string[];
    };
  };
}

export interface GrokAPIResponse {
  choices: Array<{
    message: {
      content: string;
      role: string;
      tool_calls?: Array<{
        id: string;
        type: string;
        function: {
          name: string;
          arguments: string;
        };
      }>;
    };
    finish_reason: string;
  }>;
}

export class GrokAPIClient {
  private static instance: GrokAPIClient;

  private constructor() { }

  static getInstance(): GrokAPIClient {
    if (!GrokAPIClient.instance) {
      GrokAPIClient.instance = new GrokAPIClient();
    }
    return GrokAPIClient.instance;
  }

  async generateResponse(
    message: string,
    context: string,
    history: ConversationMessage[] = [],
    systemPrompt?: string,
    tools?: GrokTool[]
  ): Promise<{ content: string; functionCalls: GrokFunctionCall[] }> {
    const apiKey = process.env.GROK_API_KEY || process.env.XAI_API_KEY;
    console.log('Grok API: Clave API presente:', !!apiKey);
    if (!apiKey) {
      console.warn('GROK_API_KEY missing, returning mock response');
      return {
        content: "I'm sorry, I can't process your request right now because my API key is missing. Please check your configuration.",
        functionCalls: []
      };
    }

    // Build messages array for xAI API
    const messages = [];

    // Add system prompt
    if (systemPrompt) {
      messages.push({
        role: 'system',
        content: systemPrompt
      });
    }

    // Add history
    if (Array.isArray(history) && history.length > 0) {
      history.forEach(h => {
        messages.push({
          role: h.role,
          content: h.content
        });
      });
    }

    // Add current message
    messages.push({
      role: 'user',
      content: message
    });

    try {
      console.log('Grok API: Enviando solicitud', {
        cantidadMensajes: messages.length,
        cantidadHerramientas: tools?.length || 0,
        modelo: 'grok-2-1212'
      });

      const requestBody = {
        model: 'grok-2-1212',
        messages: messages,
        max_tokens: 1024,
        temperature: 0.7,
        stream: false,
        ...(tools && tools.length > 0 && { tools })
      };
      console.log('DEBUG: Request body model:', requestBody.model);

      const response = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(requestBody)
      });

      console.log('DEBUG: API response status:', response.status);
      console.log('DEBUG: API response statusText:', response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('DEBUG: API error response body:', errorText);
        throw new Error(`Grok API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data: GrokAPIResponse = await response.json();

      console.log('Grok API: Respuesta recibida', {
        estado: response.status,
        cantidadOpciones: data.choices?.length || 0,
        contenido: data.choices?.[0]?.message?.content?.slice(0, 100) || 'sin contenido'
      });

      if (!data.choices || data.choices.length === 0) {
        console.log('Grok API: No hay opciones en la respuesta');
        throw new Error('No response from Grok API');
      }

      const content = data.choices[0].message.content || 'Lo siento, no pude generar una respuesta.';

      // Parse tool calls
      const functionCalls: GrokFunctionCall[] = [];
      if (data.choices[0].message.tool_calls) {
        for (const toolCall of data.choices[0].message.tool_calls) {
          if (toolCall.type === 'function') {
            try {
              const args = JSON.parse(toolCall.function.arguments);
              functionCalls.push({
                name: toolCall.function.name,
                args
              });
            } catch (error) {
              console.error('Error parsing tool call arguments:', error);
            }
          }
        }
      }

      return { content, functionCalls };
    } catch (error) {
      console.error('Grok API error:', error);
      console.error('DEBUG: Error type:', typeof error);
      console.error('DEBUG: Error message:', error instanceof Error ? error.message : String(error));
      console.error('DEBUG: Error stack:', error instanceof Error ? error.stack : 'No stack available');
      throw new Error(`Grok API error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getModels(): Promise<string[]> {
    return ['grok-2-1212'];
  }
}

export const grokAPI = GrokAPIClient.getInstance();