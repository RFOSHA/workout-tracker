import type { SupabaseClient } from '@supabase/supabase-js';

export interface ProgressPoint {
    mesoName: string;
    mesoDate: string;
    bestWeight: number;
    bestReps: number;
}

// All exercise names the user has logged in any completed workout
export async function fetchTrackedExercises(supabase: SupabaseClient): Promise<string[]> {
    const { data: workouts } = await supabase
        .from('workouts')
        .select('id')
        .eq('completed', true);

    if (!workouts?.length) return [];

    const { data: exercises } = await supabase
        .from('workout_exercises')
        .select('exercise_name')
        .in('workout_id', workouts.map(w => w.id));

    if (!exercises) return [];

    return [...new Set(exercises.map(e => e.exercise_name))].sort();
}

// Best set per mesocycle for a single exercise, sorted oldest → newest
export async function fetchExerciseProgress(
    supabase: SupabaseClient,
    exerciseName: string
): Promise<ProgressPoint[]> {
    // 1. All completed workouts (id + mesocycle_id)
    const { data: workouts } = await supabase
        .from('workouts')
        .select('id, mesocycle_id')
        .eq('completed', true);

    if (!workouts?.length) return [];

    // 2. Mesocycle metadata for those IDs
    const mesoIds = [...new Set(workouts.map(w => w.mesocycle_id).filter(Boolean))];
    const { data: mesocycles } = await supabase
        .from('mesocycles')
        .select('id, name, start_date')
        .in('id', mesoIds);

    if (!mesocycles?.length) return [];

    const mesoMap = new Map(mesocycles.map(m => [m.id, m]));
    const workoutMesoMap = new Map(workouts.map(w => [w.id, w.mesocycle_id]));

    // 3. All instances of this exercise across completed workouts
    const { data: exercises } = await supabase
        .from('workout_exercises')
        .select('set_results, workout_id')
        .in('workout_id', workouts.map(w => w.id))
        .eq('exercise_name', exerciseName);

    if (!exercises?.length) return [];

    // 4. Best set per mesocycle
    const mesoProgress = new Map<string, { meso: any; bestWeight: number; bestReps: number }>();

    exercises.forEach(ex => {
        const mesoId = workoutMesoMap.get(ex.workout_id);
        const meso = mesoId ? mesoMap.get(mesoId) : null;
        if (!meso) return;

        if (Array.isArray(ex.set_results)) {
            ex.set_results.forEach((s: any) => {
                const w = Number(s.weight);
                const r = Number(s.reps);
                if (w > 0 && r > 0) {
                    const cur = mesoProgress.get(meso.id);
                    if (!cur || w > cur.bestWeight || (w === cur.bestWeight && r > cur.bestReps)) {
                        mesoProgress.set(meso.id, { meso, bestWeight: w, bestReps: r });
                    }
                }
            });
        }
    });

    // 5. Sort chronologically
    return Array.from(mesoProgress.values())
        .sort((a, b) => new Date(a.meso.start_date).getTime() - new Date(b.meso.start_date).getTime())
        .map(d => ({
            mesoName: d.meso.name,
            mesoDate: d.meso.start_date,
            bestWeight: d.bestWeight,
            bestReps: d.bestReps
        }));
}
