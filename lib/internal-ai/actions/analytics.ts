import { AIActionResult, IInternalAIService } from '../types';
import { getAnalyticsData, calculateProductivityMetrics } from '@/lib/analytics-server';

export const registerAnalyticsActions = (service: IInternalAIService) => {
    service.registerAction('get_weekly_summary', async (payload: any): Promise<AIActionResult> => {
        try {
            const { userId } = payload;
            if (!userId) {
                return { success: false, error: 'User ID is required' };
            }

            const data = await getAnalyticsData(userId, 7);

            // Summarize the data
            const summary = data.dailyData.reduce((acc, day) => {
                acc.tasks += day.tasksCompleted;
                acc.routines += day.routinesCompleted;
                acc.habits += day.habitsCompleted;
                acc.totalTime += day.totalTimeSpent;
                return acc;
            }, { tasks: 0, routines: 0, habits: 0, totalTime: 0 });

            return {
                success: true,
                data: {
                    period: 'Last 7 days',
                    summary,
                    details: data.dailyData
                }
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to get weekly summary'
            };
        }
    });

    service.registerAction('get_productivity_analysis', async (payload: any): Promise<AIActionResult> => {
        try {
            const { userId } = payload;
            if (!userId) {
                return { success: false, error: 'User ID is required' };
            }

            const metrics = await calculateProductivityMetrics(userId, 30);

            return {
                success: true,
                data: metrics
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to analyze productivity'
            };
        }
    });
};
