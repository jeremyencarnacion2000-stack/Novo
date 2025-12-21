import { AIActionResult, IInternalAIService } from '../types';

export const registerSettingsActions = (service: IInternalAIService) => {
    service.registerAction('update_settings', async (payload: any): Promise<AIActionResult> => {
        try {
            // This would typically interact with the settings context or API
            // Since settings are often client-side context, this might need to dispatch an event
            // or call an API if settings are persisted.

            const response = await fetch('/api/user-settings', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ preferences: payload }),
            });

            if (!response.ok) {
                throw new Error(`Failed to update settings: ${response.statusText}`);
            }

            return { success: true, data: payload };
        } catch (error) {
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    });
};
