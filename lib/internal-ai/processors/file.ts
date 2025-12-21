import { AIActionResult, IInternalAIService } from '../types';

export const registerFileProcessor = (service: IInternalAIService) => {
    service.registerProcessor('file_analysis', async (input: any): Promise<AIActionResult> => {
        try {
            const { content, type } = input;

            if (type === 'json') {
                try {
                    const parsed = JSON.parse(content);
                    return {
                        success: true,
                        data: {
                            valid: true,
                            keys: Object.keys(parsed),
                            summary: `Valid JSON with ${Object.keys(parsed).length} top-level keys.`
                        }
                    };
                } catch (e) {
                    return {
                        success: false,
                        error: 'Invalid JSON format'
                    };
                }
            }

            return {
                success: true,
                data: {
                    length: content.length,
                    preview: content.substring(0, 100)
                }
            };
        } catch (error) {
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    });
};
