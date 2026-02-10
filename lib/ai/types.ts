export type AIActionType =
    | 'CREATE_TASK'
    | 'CREATE_ROUTINE'
    | 'CREATE_NOTE'
    | 'DELETE_ALL_TASKS'
    | 'SYSTEM_QUERY';

export interface AIAction {
    name: AIActionType;
    payload: any;
}

export type AIResponse =
    | { type: 'MESSAGE'; content: string }
    | { type: 'PROPOSAL'; action: AIAction; requiresConfirmation: true }
    | { type: 'CONFIRMATION_REQUIRED'; action: AIAction }
    | { type: 'RESULT'; status: 'SUCCESS' | 'ERROR'; message?: string; data?: any };

export interface AIBlock {
    id: string;
    type: 'text' | 'markdown' | 'analysis' | 'plan' | 'confirmation' | 'result' | 'suggestion' | 'explanation';
    content: any;
    status?: 'pending' | 'success' | 'error';
}
