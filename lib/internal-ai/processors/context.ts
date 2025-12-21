import { AIActionResult, IInternalAIService } from '../types';

export const registerContextProcessor = (service: IInternalAIService) => {
    service.registerProcessor('context_analysis', async (input: any): Promise<AIActionResult> => {
        try {
            const { currentPath, timeOfDay, recentActions } = input;

            const suggestions = [];

            // Time-based suggestions
            if (timeOfDay >= 9 && timeOfDay < 11) {
                suggestions.push({
                    type: 'action',
                    label: 'Check Tasks',
                    action: 'list_tasks',
                    confidence: 0.8
                });
            }

            // Path-based suggestions
            if (currentPath === '/music') {
                suggestions.push({
                    type: 'action',
                    label: 'Play Focus Playlist',
                    action: 'play_music',
                    confidence: 0.9
                });
            }

            return {
                success: true,
                data: {
                    suggestions
                }
            };
        } catch (error) {
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    });
};
