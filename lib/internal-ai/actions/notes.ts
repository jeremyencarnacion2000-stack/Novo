import { AIActionResult, IInternalAIService } from '../types';
import { groqAPI } from '@/lib/groq';

// Helper for ID generation
const generateId = () => Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

const CATEGORIZE_SYSTEM_PROMPT = `Categorize the note below. Return ONLY valid JSON, no markdown:
{ "tags": string[] (pick 1-3 from: urgent, work, personal, shopping, idea, general), "color": string (a Tailwind bg class, e.g. "bg-red-100 dark:bg-red-900/20") }
Pick "urgent" only if the note genuinely conveys time pressure, not just because a deadline word appears in passing.`;

function categorizeWithKeywords(content: string) {
    const lowerContent = content.toLowerCase();
    const tags: string[] = [];
    let color = 'bg-background';

    if (lowerContent.includes('urgent') || lowerContent.includes('asap') || lowerContent.includes('deadline')) {
        tags.push('urgent');
        color = 'bg-red-100 dark:bg-red-900/20';
    }
    if (lowerContent.includes('work') || lowerContent.includes('meeting') || lowerContent.includes('project')) {
        tags.push('work');
        color = 'bg-blue-100 dark:bg-blue-900/20';
    }
    if (lowerContent.includes('home') || lowerContent.includes('house') || lowerContent.includes('family')) {
        tags.push('personal');
        color = 'bg-green-100 dark:bg-green-900/20';
    }
    if (lowerContent.includes('buy') || lowerContent.includes('groceries') || lowerContent.includes('shop')) {
        tags.push('shopping');
        color = 'bg-yellow-100 dark:bg-yellow-900/20';
    }
    if (lowerContent.includes('idea') || lowerContent.includes('think') || lowerContent.includes('remember')) {
        tags.push('idea');
        color = 'bg-purple-100 dark:bg-purple-900/20';
    }
    if (tags.length === 0) tags.push('general');

    return { tags, color };
}

export const registerNoteActions = (service: IInternalAIService) => {
    // Assuming we might have note creation in the future, 
    // currently mapping to a generic placeholder or existing API if available.
    // For now, we'll just log it as a success for the demo of "Internal AI" capabilities.

    service.registerAction('create_note', async (payload: any): Promise<AIActionResult> => {
        // Mock implementation until /api/notes is fully standardized
        return {
            success: true,
            data: {
                id: generateId(),
                ...payload,
                createdAt: new Date().toISOString()
            }
        };
    });

    service.registerAction('categorize_note', async (payload: any): Promise<AIActionResult> => {
        try {
            const { content } = payload;
            if (!content || typeof content !== 'string') {
                return { success: false, error: 'Content is required and must be a string' };
            }

            try {
                const raw = (await groqAPI.generateResponse(content, '', [], CATEGORIZE_SYSTEM_PROMPT, 'qwen/qwen3-32b')).content;
                const cleaned = raw.replace(/<think>[\s\S]*?<\/think>/g, '').replace(/```json\n?|\n?```/g, '').trim();
                const data = JSON.parse(cleaned);
                if (Array.isArray(data.tags) && typeof data.color === 'string') {
                    return { success: true, data };
                }
            } catch (llmError) {
                console.error('[categorize_note] LLM categorization failed, falling back to keywords:', llmError);
            }

            return { success: true, data: categorizeWithKeywords(content) };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to categorize note'
            };
        }
    });
};
