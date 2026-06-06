export interface PredefinedTemplate {
    id: string;
    name: string;
    description: string;
    tags: string[];
    config: {
        microcycleDays: number;
        liftingDays: number;
        restDays: number;
        workoutTypes: number;
        totalCycles: number;
    };
    schedule: { dayIndex: number; type: 'rest' | 'lift'; workoutName?: string }[];
    exercisesPerType: Record<string, { name: string; startSets: number; endSets: number; isDropset: boolean; progressionType: 'linear' | 'manual'; manualSets: number[] }[]>;
}

const createEx = (name: string, startSets = 3, endSets = 5) => ({
    name, startSets, endSets, isDropset: false, progressionType: 'linear' as const, manualSets: []
});

export const PREDEFINED_TEMPLATES: PredefinedTemplate[] = [
    {
        id: 'full-body-3',
        name: 'Full Body (3 Days)',
        description: 'Hits the entire body 3 times a week. Excellent for beginners to intermediate lifters balancing recovery.',
        tags: ['Beginner', 'Hypertrophy', '3 Days'],
        config: { microcycleDays: 7, liftingDays: 3, restDays: 4, workoutTypes: 2, totalCycles: 6 },
        schedule: [
            { dayIndex: 1, type: 'lift', workoutName: 'Full Body A' },
            { dayIndex: 2, type: 'rest' },
            { dayIndex: 3, type: 'lift', workoutName: 'Full Body B' },
            { dayIndex: 4, type: 'rest' },
            { dayIndex: 5, type: 'lift', workoutName: 'Full Body A' },
            { dayIndex: 6, type: 'rest' },
            { dayIndex: 7, type: 'rest' }
        ],
        exercisesPerType: {
            'Full Body A': [
                createEx('Barbell Squat', 3, 5),
                createEx('Bench Press', 3, 5),
                createEx('Barbell Row', 3, 5),
                createEx('Lateral Raises', 2, 4),
                createEx('Bicep Curls', 2, 4)
            ],
            'Full Body B': [
                createEx('Deadlift', 3, 5),
                createEx('Overhead Press', 3, 5),
                createEx('Pull Up', 3, 5),
                createEx('Leg Curls', 3, 5),
                createEx('Tricep Pushdown', 2, 4)
            ]
        }
    },
    {
        id: 'upper-lower-4',
        name: 'Upper / Lower (4 Days)',
        description: 'Classic 4-day split dividing the body into upper and lower days. Great balance of frequency and recovery.',
        tags: ['Intermediate', 'Hypertrophy', '4 Days'],
        config: { microcycleDays: 7, liftingDays: 4, restDays: 3, workoutTypes: 4, totalCycles: 6 },
        schedule: [
            { dayIndex: 1, type: 'lift', workoutName: 'Upper A' },
            { dayIndex: 2, type: 'lift', workoutName: 'Lower A' },
            { dayIndex: 3, type: 'rest' },
            { dayIndex: 4, type: 'lift', workoutName: 'Upper B' },
            { dayIndex: 5, type: 'lift', workoutName: 'Lower B' },
            { dayIndex: 6, type: 'rest' },
            { dayIndex: 7, type: 'rest' }
        ],
        exercisesPerType: {
            'Upper A': [
                createEx('Bench Press', 3, 5),
                createEx('Barbell Row', 3, 5),
                createEx('Overhead Press', 3, 4),
                createEx('Lat Pulldown', 3, 4),
                createEx('Bicep Curls', 2, 4)
            ],
            'Lower A': [
                createEx('Barbell Squat', 3, 5),
                createEx('Romanian Deadlift', 3, 5),
                createEx('Leg Press', 3, 4),
                createEx('Calf Raises', 3, 5)
            ],
            'Upper B': [
                createEx('Incline DB Press', 3, 5),
                createEx('Cable Row', 3, 5),
                createEx('Lateral Raises', 3, 5),
                createEx('Face Pulls', 2, 4),
                createEx('Tricep Pushdown', 2, 4)
            ],
            'Lower B': [
                createEx('Deadlift', 3, 5),
                createEx('Front Squat', 3, 5),
                createEx('Leg Curls', 3, 4),
                createEx('Seated Calf Raises', 3, 5)
            ]
        }
    },
    {
        id: 'ppl-6',
        name: 'Push / Pull / Legs (6 Days)',
        description: 'High volume, 6-day routine. Perfect for advanced lifters looking to maximize hypertrophy.',
        tags: ['Advanced', 'Hypertrophy', '6 Days'],
        config: { microcycleDays: 7, liftingDays: 6, restDays: 1, workoutTypes: 3, totalCycles: 6 },
        schedule: [
            { dayIndex: 1, type: 'lift', workoutName: 'Push' },
            { dayIndex: 2, type: 'lift', workoutName: 'Pull' },
            { dayIndex: 3, type: 'lift', workoutName: 'Legs' },
            { dayIndex: 4, type: 'lift', workoutName: 'Push' },
            { dayIndex: 5, type: 'lift', workoutName: 'Pull' },
            { dayIndex: 6, type: 'lift', workoutName: 'Legs' },
            { dayIndex: 7, type: 'rest' }
        ],
        exercisesPerType: {
            'Push': [
                createEx('Bench Press', 3, 5),
                createEx('Overhead Press', 3, 5),
                createEx('Incline DB Press', 3, 4),
                createEx('Lateral Raises', 3, 5),
                createEx('Tricep Pushdown', 3, 4)
            ],
            'Pull': [
                createEx('Barbell Row', 3, 5),
                createEx('Lat Pulldown', 3, 5),
                createEx('Face Pulls', 3, 4),
                createEx('Barbell Curls', 3, 5),
                createEx('Hammer Curls', 2, 4)
            ],
            'Legs': [
                createEx('Barbell Squat', 3, 5),
                createEx('Romanian Deadlift', 3, 5),
                createEx('Leg Press', 3, 4),
                createEx('Leg Curls', 3, 4),
                createEx('Calf Raises', 4, 6)
            ]
        }
    },
    {
        id: 'bro-split-5',
        name: 'Bro Split (5 Days)',
        description: 'Dedicate each day to a single muscle group to absolutely fry it. Classic bodybuilding split.',
        tags: ['Intermediate', 'Bodybuilding', '5 Days'],
        config: { microcycleDays: 7, liftingDays: 5, restDays: 2, workoutTypes: 5, totalCycles: 6 },
        schedule: [
            { dayIndex: 1, type: 'lift', workoutName: 'Chest' },
            { dayIndex: 2, type: 'lift', workoutName: 'Back' },
            { dayIndex: 3, type: 'lift', workoutName: 'Legs' },
            { dayIndex: 4, type: 'lift', workoutName: 'Shoulders' },
            { dayIndex: 5, type: 'lift', workoutName: 'Arms' },
            { dayIndex: 6, type: 'rest' },
            { dayIndex: 7, type: 'rest' }
        ],
        exercisesPerType: {
            'Chest': [
                createEx('Bench Press', 3, 5),
                createEx('Incline DB Press', 3, 5),
                createEx('Cable Crossovers', 3, 5),
                createEx('Pec Deck', 3, 4)
            ],
            'Back': [
                createEx('Deadlift', 3, 5),
                createEx('Lat Pulldown', 3, 5),
                createEx('Barbell Row', 3, 5),
                createEx('Pull Up', 3, 4)
            ],
            'Legs': [
                createEx('Barbell Squat', 3, 5),
                createEx('Leg Press', 3, 5),
                createEx('Leg Extensions', 3, 5),
                createEx('Leg Curls', 3, 5)
            ],
            'Shoulders': [
                createEx('Overhead Press', 3, 5),
                createEx('Lateral Raises', 4, 6),
                createEx('Front Raises', 3, 4),
                createEx('Reverse Pec Deck', 3, 5)
            ],
            'Arms': [
                createEx('Barbell Curls', 3, 5),
                createEx('Skull Crushers', 3, 5),
                createEx('Hammer Curls', 3, 4),
                createEx('Tricep Pushdown', 3, 5)
            ]
        }
    },
    {
        id: 'phul-4',
        name: 'PHUL (Power Hypertrophy Upper Lower)',
        description: 'Combines strength and hypertrophy days. Great for powerbuilding and setting PRs.',
        tags: ['Intermediate', 'Powerbuilding', '4 Days'],
        config: { microcycleDays: 7, liftingDays: 4, restDays: 3, workoutTypes: 4, totalCycles: 6 },
        schedule: [
            { dayIndex: 1, type: 'lift', workoutName: 'Power Upper' },
            { dayIndex: 2, type: 'lift', workoutName: 'Power Lower' },
            { dayIndex: 3, type: 'rest' },
            { dayIndex: 4, type: 'lift', workoutName: 'Hypertrophy Upper' },
            { dayIndex: 5, type: 'lift', workoutName: 'Hypertrophy Lower' },
            { dayIndex: 6, type: 'rest' },
            { dayIndex: 7, type: 'rest' }
        ],
        exercisesPerType: {
            'Power Upper': [
                createEx('Bench Press', 3, 5),
                createEx('Barbell Row', 3, 5),
                createEx('Overhead Press', 3, 4),
                createEx('Lat Pulldown', 3, 4)
            ],
            'Power Lower': [
                createEx('Barbell Squat', 3, 5),
                createEx('Deadlift', 3, 5),
                createEx('Leg Press', 3, 5),
                createEx('Leg Curls', 3, 4)
            ],
            'Hypertrophy Upper': [
                createEx('Incline DB Press', 3, 5),
                createEx('Cable Row', 3, 5),
                createEx('Lateral Raises', 3, 5),
                createEx('Bicep Curls', 3, 5),
                createEx('Tricep Pushdown', 3, 5)
            ],
            'Hypertrophy Lower': [
                createEx('Front Squat', 3, 5),
                createEx('Romanian Deadlift', 3, 5),
                createEx('Leg Extensions', 3, 5),
                createEx('Calf Raises', 3, 5)
            ]
        }
    },
    {
        id: 'arnold-6',
        name: 'Arnold Split (6 Days)',
        description: 'Intense 6-day split popularized by Arnold. Groups Chest/Back, Shoulders/Arms, and Legs.',
        tags: ['Advanced', 'Bodybuilding', '6 Days'],
        config: { microcycleDays: 7, liftingDays: 6, restDays: 1, workoutTypes: 3, totalCycles: 6 },
        schedule: [
            { dayIndex: 1, type: 'lift', workoutName: 'Chest & Back' },
            { dayIndex: 2, type: 'lift', workoutName: 'Shoulders & Arms' },
            { dayIndex: 3, type: 'lift', workoutName: 'Legs' },
            { dayIndex: 4, type: 'lift', workoutName: 'Chest & Back' },
            { dayIndex: 5, type: 'lift', workoutName: 'Shoulders & Arms' },
            { dayIndex: 6, type: 'lift', workoutName: 'Legs' },
            { dayIndex: 7, type: 'rest' }
        ],
        exercisesPerType: {
            'Chest & Back': [
                createEx('Bench Press', 3, 5),
                createEx('Pull Up', 3, 5),
                createEx('Incline DB Press', 3, 5),
                createEx('Barbell Row', 3, 5),
                createEx('DB Pullover', 2, 4)
            ],
            'Shoulders & Arms': [
                createEx('Overhead Press', 3, 5),
                createEx('Lateral Raises', 3, 5),
                createEx('Barbell Curls', 3, 5),
                createEx('Tricep Pushdown', 3, 5)
            ],
            'Legs': [
                createEx('Barbell Squat', 3, 5),
                createEx('Romanian Deadlift', 3, 5),
                createEx('Leg Press', 3, 5),
                createEx('Calf Raises', 4, 6)
            ]
        }
    }
];

export function generateTemplateDeload(schedule: any[]) {
    const weekSettings = schedule
        .filter(day => day.type === 'lift' && day.workoutName)
        .map(day => ({
            dayIndex: day.dayIndex,
            workoutName: day.workoutName!,
            reduceSets: 50,
            reduceWeight: 0,
            reduceReps: 0
        }));
    return {
        enabled: true,
        duration: 1,
        weeks: [weekSettings]
    };
}