import { rest } from 'msw';

// Mock handlers for external APIs
export const handlers = [
  // Grok API mocks
  rest.post('https://api.x.ai/v1/chat/completions', (req, res, ctx) => {
    return res(
      ctx.json({
        id: 'chatcmpl-mock',
        object: 'chat.completion',
        created: Date.now(),
        model: 'grok-1',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'This is a mocked response from Grok AI.',
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 20,
          total_tokens: 30,
        },
      })
    );
  }),

];