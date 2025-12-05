// Standardized toast messages for consistent user feedback

export const toastMessages = {
    // Tasks
    task: {
        created: 'Task created successfully',
        updated: 'Task updated',
        deleted: 'Task deleted',
        completed: 'Task completed! 🎉',
        error: 'Failed to save task',
    },

    // Projects
    project: {
        created: 'Project created successfully',
        updated: 'Project updated',
        deleted: 'Project deleted',
        error: 'Failed to save project',
    },

    // Routines
    routine: {
        created: 'Routine created successfully',
        updated: 'Routine updated',
        deleted: 'Routine deleted',
        imported: 'Routine imported successfully',
        exported: 'Routine exported successfully',
        error: 'Failed to save routine',
    },

    //School
    school: {
        courseCreated: 'Course added successfully',
        courseUpdated: 'Course updated',
        courseDeleted: 'Course deleted',
        gradeAdded: 'Grade recorded successfully',
        gradeUpdated: 'Grade updated',
        gradeDeleted: 'Grade deleted',
        error: 'Failed to save changes',
    },

    // Calendar
    calendar: {
        eventCreated: 'Event added to calendar',
        eventUpdated: 'Event updated',
        eventDeleted: 'Event removed',
        error: 'Failed to load calendar events',
    },

    // Integration
    integration: {
        syncSuccess: 'Successfully synced across modules',
        syncError: 'Failed to sync changes',
    },

    // General
    general: {
        saveSuccess: 'Changes saved',
        saveError: 'Failed to save changes',
        deleteSuccess: 'Deleted successfully',
        deleteError: 'Failed to delete',
        copySuccess: 'Copied to clipboard',
        loading: 'Loading...',
    },
} as const;
