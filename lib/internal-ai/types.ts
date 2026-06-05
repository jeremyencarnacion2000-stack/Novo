export type AIActionType =
    | 'create_task'
    | 'update_task'
    | 'delete_task'
    | 'create_project'
    | 'create_routine'
    | 'create_checklist'
    | 'create_habit'
    | 'analyze_image'
    | 'analyze_file'
    | 'generate_suggestion'
    | 'categorize_note';

export interface AIActionPayload {
    [key: string]: any;
}

export interface AIActionResult<T = any> {
    success: boolean;
    data?: T;
    error?: string;
    metadata?: {
        executionTime: number;
        confidence?: number;
        source?: 'rule' | 'model' | 'heuristic';
    };
}

export interface AIProcessor {
    id: string;
    name: string;
    process: (input: any, context?: any) => Promise<AIActionResult>;
    supports: (inputType: string) => boolean;
}

export interface AIEvent {
    id: string;
    type: AIActionType;
    timestamp: number;
    payload: AIActionPayload;
    result?: AIActionResult;
    userId: string;
}

export interface IInternalAIService {
    registerAction(type: AIActionType | string, handler: (payload: any) => Promise<AIActionResult>): void;
    registerProcessor(type: string, processor: (input: any) => Promise<AIActionResult>): void;
    execute(type: AIActionType | string, payload: AIActionPayload, userId?: string): Promise<AIActionResult>;
    process(processorType: string, input: any, userId?: string): Promise<AIActionResult>;
}
