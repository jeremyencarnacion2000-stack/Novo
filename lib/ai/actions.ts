export type AIActionType =
    | 'CREATE_ROUTINE'
    | 'UPDATE_ROUTINE'
    | 'DELETE_ROUTINE'
    | 'START_WORKOUT'
    | 'FINISH_WORKOUT'
    | 'CREATE_TASK'
    | 'UPDATE_TASK'
    | 'DELETE_TASK'
    | 'CREATE_NOTE'
    | 'UPDATE_NOTE'
    | 'ANALYZE_PROGRESS'
    | 'SYSTEM_QUERY';

export interface BaseAction {
    type: AIActionType;
    payload: any;
}

// --- Routines ---
export interface CreateRoutineAction extends BaseAction {
    type: 'CREATE_ROUTINE';
    payload: {
        name: string;
        description: string;
        daysOfWeek: string[];
        exercises: {
            name: string;
            sets: number;
            reps: string;
            muscleGroup: string;
        }[];
    };
}

export interface UpdateRoutineAction extends BaseAction {
    type: 'UPDATE_ROUTINE';
    payload: {
        id: string;
        updates: Partial<{
            name: string;
            description: string;
            daysOfWeek: string[];
            isActive: boolean;
        }>;
    };
}

export interface DeleteRoutineAction extends BaseAction {
    type: 'DELETE_ROUTINE';
    payload: {
        id: string;
    };
}

// --- Workouts ---
export interface StartWorkoutAction extends BaseAction {
    type: 'START_WORKOUT';
    payload: {
        routineId: string;
    };
}

export interface FinishWorkoutAction extends BaseAction {
    type: 'FINISH_WORKOUT';
    payload: {
        workoutLogId: string;
        duration: number;
        exercises: {
            exerciseName: string;
            setsDone: number;
            repsDone?: string;
            weight?: number;
            notes?: string;
        }[];
    };
}

// --- Tasks ---
export interface CreateTaskAction extends BaseAction {
    type: 'CREATE_TASK';
    payload: {
        title: string;
        category: 'Training' | 'Study' | 'Personal' | 'Work';
        priority: number; // 1 (Low) to 3 (High)
        dueDate?: string;
    };
}

export interface UpdateTaskAction extends BaseAction {
    type: 'UPDATE_TASK';
    payload: {
        id: string;
        updates: Partial<{
            title: string;
            status: 'todo' | 'in-progress' | 'done';
            priority: number;
            dueDate: string;
        }>;
    };
}

export interface DeleteTaskAction extends BaseAction {
    type: 'DELETE_TASK';
    payload: {
        id: string;
    };
}

// --- Notes ---
export interface CreateNoteAction extends BaseAction {
    type: 'CREATE_NOTE';
    payload: {
        title: string;
        content: string;
        tags: string[];
    };
}

export interface UpdateNoteAction extends BaseAction {
    type: 'UPDATE_NOTE';
    payload: {
        id: string;
        updates: Partial<{
            title: string;
            content: string;
            tags: string[];
        }>;
    };
}

// --- Analysis ---
export interface AnalyzeProgressAction extends BaseAction {
    type: 'ANALYZE_PROGRESS';
    payload: {
        period: 'week' | 'month' | 'year';
        focus?: 'workouts' | 'tasks' | 'all';
    };
}

// --- System Query ---
export interface SystemQueryAction extends BaseAction {
    type: 'SYSTEM_QUERY';
    payload: {
        entity: 'routines' | 'tasks' | 'workouts' | 'notes' | 'stats';
        filters?: Record<string, any>;
    };
}

export type AIAction =
    | CreateRoutineAction
    | UpdateRoutineAction
    | DeleteRoutineAction
    | StartWorkoutAction
    | FinishWorkoutAction
    | CreateTaskAction
    | UpdateTaskAction
    | DeleteTaskAction
    | CreateNoteAction
    | UpdateNoteAction
    | AnalyzeProgressAction
    | SystemQueryAction;
