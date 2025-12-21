import { AIActionResult, IInternalAIService } from '../types';

export const registerRoutineActions = (service: IInternalAIService) => {
    service.registerAction('create_routine', async (payload: any): Promise<AIActionResult> => {
        try {
            // Assuming payload has { name, tasks: [] }
            const response = await fetch('/api/routines', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                throw new Error(`Failed to create routine: ${response.statusText}`);
            }

            const data = await response.json();
            return { success: true, data };
        } catch (error) {
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    });
};
