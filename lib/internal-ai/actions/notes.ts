import { AIActionResult, IInternalAIService } from '../types';
import { groqAPI } from '@/lib/groq';

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
    service.registerAction('categorize_note', async (payload: any): Promise<AIActionResult> => {
        try {
            const { content } = payload;
            if (!content || typeof content !== 'string') {
                return { success: false, error: 'Content is required and must be a string' };
            }

            try {
                const raw = (await groqAPI.generateResponse(content, '', [], CATEGORIZE_SYSTEM_PROMPT, 'openai/gpt-oss-20b')).content;
                const cleaned = raw.replace(/<think>[\s\S]*?<\/think>/g, '').replace(/```json\n?|\n?```/g, '').trim();
                const data = JSON.parse(cleaned);
                if (Array.isArray(data.tags) && typeof data.color === 'string') {
                    return { success: true, data };
                }
            } catch {
                console.error('[categorize_note] LLM categorization failed; falling back to keywords.');
            }

            return { success: true, data: categorizeWithKeywords(content) };
        } catch {
            return {
                success: false,
                error: 'NOTE_CATEGORIZATION_FAILED'
            };
        }
    });
};
