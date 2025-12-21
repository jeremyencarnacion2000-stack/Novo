import { AIActionResult, IInternalAIService } from '../types';

export const registerProjectActions = (service: IInternalAIService) => {
  service.registerAction('create_project', async (payload: any): Promise<AIActionResult> => {
    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Failed to create project: ${response.statusText}`);
      }

      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Add more project actions as needed (update, delete)
};
