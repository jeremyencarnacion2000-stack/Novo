export interface Goal {
    id: string;
    title: string;
    description: string | null;
    status: 'active' | 'completed' | 'paused';
    timeframe: 'year' | 'quarter' | 'month';
    deadline: string | null;
    progress: number;
    userId: string;
    updatedAt: Date;
    completed?: boolean; // Added for local UI toggle if needed
}
