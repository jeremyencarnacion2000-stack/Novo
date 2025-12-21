export type AIPermission =
    | 'routine:read'
    | 'routine:write'
    | 'workout:log'
    | 'task:read'
    | 'task:write'
    | 'note:read'
    | 'note:write'
    | 'analyze:data'
    | 'system:query';

export const ACTION_PERMISSIONS: Record<string, AIPermission[]> = {
    CREATE_ROUTINE: ['routine:write'],
    UPDATE_ROUTINE: ['routine:write'],
    DELETE_ROUTINE: ['routine:write'],
    START_WORKOUT: ['workout:log'],
    FINISH_WORKOUT: ['workout:log'],
    CREATE_TASK: ['task:write'],
    UPDATE_TASK: ['task:write'],
    DELETE_TASK: ['task:write'],
    CREATE_NOTE: ['note:write'],
    UPDATE_NOTE: ['note:write'],
    ANALYZE_PROGRESS: ['analyze:data'],
    SYSTEM_QUERY: ['system:query'],
};
