import { AIActionResult, IInternalAIService } from '../types';

export const registerTaskActions = (service: IInternalAIService) => {
    service.registerAction('create_task', async (payload: any): Promise<AIActionResult> => {
        try {
            const response = await fetch('/api/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                throw new Error(`Failed to create task: ${response.statusText}`);
            }

            const data = await response.json();
            return { success: true, data };
        } catch {
            return { success: false, error: 'TASK_CREATE_FAILED' };
        }
    });

    service.registerAction('update_task', async (payload: any): Promise<AIActionResult> => {
        try {
            const { id, ...updates } = payload;
            if (!id) throw new Error('Task ID is required for update');

            const response = await fetch(`/api/tasks/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates),
            });

            if (!response.ok) {
                throw new Error(`Failed to update task: ${response.statusText}`);
            }

            const data = await response.json();
            return { success: true, data };
        } catch {
            return { success: false, error: 'TASK_UPDATE_FAILED' };
        }
    });

    service.registerAction('delete_task', async (payload: any): Promise<AIActionResult> => {
        try {
            const { id } = payload;
            if (!id) throw new Error('Task ID is required for deletion');

            const response = await fetch(`/api/tasks/${id}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                throw new Error(`Failed to delete task: ${response.statusText}`);
            }

            return { success: true, data: { id } };
        } catch {
            return { success: false, error: 'TASK_DELETE_FAILED' };
        }
    });
};
