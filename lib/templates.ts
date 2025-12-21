export const defaultTemplates = [
    {
        id: 'morning-routine',
        name: 'Miracle Morning',
        description: 'Start your day with purpose using the SAVERS method.',
        type: 'routine',
        category: 'Productivity',
        content: {
            tasks: [
                { text: 'Silence / Meditation', duration: 10 },
                { text: 'Affirmations', duration: 5 },
                { text: 'Visualization', duration: 5 },
                { text: 'Exercise', duration: 20 },
                { text: 'Reading', duration: 20 },
                { text: 'Scribing / Journaling', duration: 10 }
            ]
        }
    },
    {
        id: 'deep-work-session',
        name: 'Deep Work Session',
        description: '4-hour intense focus block with breaks.',
        type: 'routine',
        category: 'Productivity',
        content: {
            tasks: [
                { text: 'Deep Work Block 1', duration: 90 },
                { text: 'Recharge Break', duration: 15 },
                { text: 'Deep Work Block 2', duration: 90 },
                { text: 'Cool Down', duration: 15 }
            ]
        }
    },
    {
        id: 'software-project',
        name: 'Software Project Launch',
        description: 'Standard phases for shipping a new feature.',
        type: 'project',
        category: 'Business',
        content: {
            tasks: [
                { title: 'Requirements Gathering', status: 'todo' },
                { title: 'Design & Prototyping', status: 'todo' },
                { title: 'Implementation', status: 'todo' },
                { title: 'Testing & QA', status: 'todo' },
                { title: 'Deployment', status: 'todo' }
            ]
        }
    },
    {
        id: 'fitness-tracker',
        name: 'Weight Loss Tracker',
        description: 'Track daily weight and calories.',
        type: 'tracker',
        category: 'Health',
        content: {
            name: 'Weight',
            unit: 'kg',
            goal: 70
        }
    }
]
