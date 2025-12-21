import { AIActionType, AIActionPayload, AIActionResult, IInternalAIService } from './types';
import { aiEventBus } from './events';
import { registerTaskActions } from './actions/tasks';
import { registerProjectActions } from './actions/projects';
import { registerRoutineActions } from './actions/routines';
import { registerNoteActions } from './actions/notes';
import { registerSettingsActions } from './actions/settings';
import { registerAnalyticsActions } from './actions/analytics';
import { registerImageProcessor } from './processors/image';
import { registerContextProcessor } from './processors/context';
import { registerFileProcessor } from './processors/file';

// Helper for ID generation
const generateId = () => Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

// Placeholder for action handlers - will be imported dynamically or registered
const actionHandlers: Record<string, (payload: any) => Promise<AIActionResult>> = {};

// Placeholder for processors
const processors: Record<string, (input: any) => Promise<AIActionResult>> = {};

export class InternalAIService implements IInternalAIService {
    private static instance: InternalAIService;

    private constructor() { }

    public static getInstance(): InternalAIService {
        if (!InternalAIService.instance) {
            InternalAIService.instance = new InternalAIService();
            const instance = InternalAIService.instance;

            // Initialize actions
            registerTaskActions(instance);
            registerProjectActions(instance);
            registerRoutineActions(instance);
            registerNoteActions(instance);
            registerSettingsActions(instance);
            registerAnalyticsActions(instance);

            // Initialize processors
            registerImageProcessor(instance);
            registerContextProcessor(instance);
            registerFileProcessor(instance);
        }
        return InternalAIService.instance;
    }

    public registerAction(type: AIActionType, handler: (payload: any) => Promise<AIActionResult>) {
        actionHandlers[type] = handler;
    }

    public registerProcessor(type: string, processor: (input: any) => Promise<AIActionResult>) {
        processors[type] = processor;
    }

    public async execute(type: AIActionType, payload: AIActionPayload, userId: string = 'system'): Promise<AIActionResult> {
        const startTime = Date.now();
        const eventId = generateId();

        try {
            const handler = actionHandlers[type];

            if (!handler) {
                throw new Error(`No handler registered for action type: ${type}`);
            }

            const result = await handler(payload);

            // Enrich result metadata
            result.metadata = {
                ...result.metadata,
                executionTime: Date.now() - startTime
            };

            // Emit success event
            aiEventBus.emit({
                id: eventId,
                type,
                timestamp: Date.now(),
                payload,
                result,
                userId
            });

            return result;

        } catch (error) {
            const errorResult: AIActionResult = {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                metadata: {
                    executionTime: Date.now() - startTime
                }
            };

            // Emit error event
            aiEventBus.emit({
                id: eventId,
                type,
                timestamp: Date.now(),
                payload,
                result: errorResult,
                userId
            });

            return errorResult;
        }
    }

    public async process(processorType: string, input: any, userId: string = 'system'): Promise<AIActionResult> {
        const processor = processors[processorType];
        if (!processor) {
            return { success: false, error: `Processor not found: ${processorType}` };
        }
        return processor(input);
    }
}

export const internalAI = InternalAIService.getInstance();
