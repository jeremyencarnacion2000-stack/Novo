export type AIActionType =
    | 'CREATE_ROUTINE'
    | 'UPDATE_ROUTINE'
    | 'DELETE_ROUTINE'
    | 'START_WORKOUT'
    | 'FINISH_WORKOUT'
    | 'CREATE_TASK'
    | 'CREATE_TASKS'
    | 'UPDATE_TASK'
    | 'DELETE_TASK'
    | 'DELETE_ALL_TASKS'
    | 'CREATE_NOTE'
    | 'UPDATE_NOTE'
    | 'ANALYZE_PROGRESS'
    | 'SYSTEM_QUERY'
    | 'CREATE_PROJECT'
    | 'UPDATE_PROJECT'
    | 'DELETE_PROJECT'
    | 'CREATE_COURSE'
    | 'UPDATE_COURSE'
    | 'DELETE_COURSE'
    | 'ADD_GRADE'
    | 'UPDATE_GRADE'
    | 'DELETE_GRADE'
    | 'CREATE_CHECKLIST'
    | 'CREATE_HABIT'
    | 'CREATE_EVENT'
    | 'CREATE_TRACKER'
    | 'SEND_EMAIL'
    | 'GENERATE_FILE'
    | 'UPDATE_COGNITIVE_STATE'
    | 'COGNITIVE_PIPELINE';

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
        confirmed?: boolean;
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

export interface CreateTasksAction extends BaseAction {
    type: 'CREATE_TASKS';
    payload: {
        tasks: {
            title: string;
            category: 'Training' | 'Study' | 'Personal' | 'Work';
            priority: number;
            dueDate?: string;
        }[];
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
        confirmed?: boolean;
    };
}

export interface DeleteAllTasksAction extends BaseAction {
    type: 'DELETE_ALL_TASKS';
    payload: {};
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

export interface CreateEventAction extends BaseAction {
    type: 'CREATE_EVENT';
    payload: {
        title: string;
        description?: string;
        start: string; // ISO
        end: string; // ISO
        allDay?: boolean;
    };
}

export interface CreateTrackerAction extends BaseAction {
    type: 'CREATE_TRACKER';
    payload: {
        name: string;
        type: 'habit' | 'metric';
        unit: string;
        goal: number;
    };
}

// --- Gmail ---
export interface SendEmailAction extends BaseAction {
    type: 'SEND_EMAIL';
    payload: {
        to: string;
        subject: string;
        body: string;
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

// --- Projects ---
export interface CreateProjectAction extends BaseAction {
    type: 'CREATE_PROJECT';
    payload: {
        title: string;
        description: string;
        status: 'not-started' | 'in-progress' | 'completed';
        priority: 'low' | 'medium' | 'high';
        dueDate?: string;
        tags: string[];
    };
}

export interface UpdateProjectAction extends BaseAction {
    type: 'UPDATE_PROJECT';
    payload: {
        id: string;
        updates: Partial<{
            title: string;
            description: string;
            status: 'not-started' | 'in-progress' | 'completed';
            priority: 'low' | 'medium' | 'high';
            dueDate: string;
            progress: number;
            tags: string[];
        }>;
    };
}

export interface DeleteProjectAction extends BaseAction {
    type: 'DELETE_PROJECT';
    payload: {
        id: string;
        confirmed?: boolean;
    };
}

// --- School ---
export interface CreateCourseAction extends BaseAction {
    type: 'CREATE_COURSE';
    payload: {
        name: string;
        code?: string;
        credits?: number;
        semester: string;
        year: number;
        professor?: string;
        color?: string;
    };
}

export interface UpdateCourseAction extends BaseAction {
    type: 'UPDATE_COURSE';
    payload: {
        id: string;
        updates: Partial<{
            name: string;
            code: string;
            credits: number;
            semester: string;
            year: number;
            professor: string;
            color: string;
        }>;
    };
}

export interface DeleteCourseAction extends BaseAction {
    type: 'DELETE_COURSE';
    payload: {
        id: string;
        confirmed?: boolean;
    };
}

export interface AddGradeAction extends BaseAction {
    type: 'ADD_GRADE';
    payload: {
        courseId: string;
        name: string;
        score: number;
        maxScore: number;
        weight: number;
        category: 'Exam' | 'Assignment' | 'Quiz' | 'Project' | 'Participation';
        date: string;
    };
}

export interface UpdateGradeAction extends BaseAction {
    type: 'UPDATE_GRADE';
    payload: {
        id: string;
        updates: Partial<{
            name: string;
            score: number;
            maxScore: number;
            weight: number;
            category: string;
            date: string;
        }>;
    };
}

export interface DeleteGradeAction extends BaseAction {
    type: 'DELETE_GRADE';
    payload: {
        id: string;
        confirmed?: boolean;
    };
}

export interface UpdateCognitiveStateAction extends BaseAction {
    type: 'UPDATE_COGNITIVE_STATE';
    payload: {
        fatigueEstimate?: 'low' | 'medium' | 'high' | 'critical';
        productivityScore?: number;
        focusTimeToday?: number;
        moodSignal?: string;
        triggerRecovery?: boolean;
        musicRecommendation?: {
            mood: string;
            searchQuery: string;
        };
        styleRecommendation?: {
            context: string;
            suggestion: string;
            colorPsychology: string;
        };
    };
}

export interface CognitivePipelineAction extends BaseAction {
    type: 'COGNITIVE_PIPELINE';
    payload: {
        actions: Array<{
            type: AIActionType;
            payload: any;
        }>;
    };
}

// --- System Query ---
export interface SystemQueryAction extends BaseAction {
    type: 'SYSTEM_QUERY';
    payload: {
        entity: 'routines' | 'tasks' | 'workouts' | 'notes' | 'stats' | 'projects' | 'courses' | 'grades';
        filters?: Record<string, any>;
    };
}

export interface GenerateFileAction extends BaseAction {
    type: 'GENERATE_FILE';
    payload: {
        filename: string;
        content: string;
        mimeType: string;
    };
}

export type AIAction =
    | CreateRoutineAction
    | UpdateRoutineAction
    | DeleteRoutineAction
    | StartWorkoutAction
    | FinishWorkoutAction
    | CreateTaskAction
    | CreateTasksAction
    | UpdateTaskAction
    | DeleteTaskAction
    | DeleteAllTasksAction
    | CreateNoteAction
    | UpdateNoteAction
    | CreateEventAction
    | CreateTrackerAction
    | SendEmailAction
    | AnalyzeProgressAction
    | SystemQueryAction
    | CreateProjectAction
    | UpdateProjectAction
    | DeleteProjectAction
    | CreateCourseAction
    | UpdateCourseAction
    | DeleteCourseAction
    | AddGradeAction
    | UpdateGradeAction
    | DeleteGradeAction
    | GenerateFileAction
    | UpdateCognitiveStateAction
    | CognitivePipelineAction;

