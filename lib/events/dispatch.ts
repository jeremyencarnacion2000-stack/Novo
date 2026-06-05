export type FocusCompletedEvent = {
    data: {
        userId: string;
        focusSessionId: string;
        duration: number; // minutes
        quality?: number; // 1-5
    };
};

export type TaskUpdatedEvent = {
    data: {
        userId: string;
        taskId: string;
        status: 'todo' | 'in-progress' | 'done';
    };
};

export type DayClosedEvent = {
    data: {
        userId: string;
        date: string;
    };
};

export const events = {
    "focus.completed": {} as FocusCompletedEvent,
    "task.updated": {} as TaskUpdatedEvent,
    "day.closed": {} as DayClosedEvent,
};
