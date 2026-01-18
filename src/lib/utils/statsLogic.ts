// src/lib/utils/statsLogic.ts
import type { SupabaseClient } from '@supabase/supabase-js';

export async function fetchLifetimeStats(supabase: SupabaseClient) {
    // 1. Fetch all completed workouts
    const { data: workouts } = await supabase
        .from('workouts')
        .select('id, completed_at')
        .eq('completed', true)
        .order('completed_at', { ascending: true });

    if (!workouts || workouts.length === 0) return null;

    const workoutIds = workouts.map(w => w.id);
    const totalWorkouts = workouts.length;
    
    // First workout date
    const firstWorkout = new Date(workouts[0].completed_at);
    const daysActive = Math.ceil((Date.now() - firstWorkout.getTime()) / (1000 * 60 * 60 * 24));

    // 2. Fetch Library for Muscle Group Mapping
    const { data: library } = await supabase
        .from('exercise_library')
        .select('name, muscle_group');
    const muscleMap = new Map(library?.map(l => [l.name, l.muscle_group]) || []);

    // 3. Fetch All Exercises History
    // Note: For very large datasets, you might paginate this, but for a personal tracker this is fine.
    const { data: exercises } = await supabase
        .from('workout_exercises')
        .select('exercise_name, set_results')
        .in('workout_id', workoutIds);

    if (!exercises) return null;

    // 4. Aggregate Data
    let totalVolume = 0;
    let totalSets = 0;
    const muscleCounts: Record<string, number> = {};
    const personalRecords: Record<string, { weight: number, reps: number }> = {};

    exercises.forEach(ex => {
        const muscle = muscleMap.get(ex.exercise_name) || 'Other';
        let validSetsForExercise = 0;

        if (Array.isArray(ex.set_results)) {
            ex.set_results.forEach((s: any) => {
                const r = Number(s.reps);
                const w = Number(s.weight);

                if (r > 0 && w > 0) {
                    validSetsForExercise++;
                    totalVolume += (w * r);

                    // PR Check
                    const currentPR = personalRecords[ex.exercise_name];
                    // Simple PR logic: Max Weight. Tie-breaker: Max Reps.
                    if (!currentPR || w > currentPR.weight || (w === currentPR.weight && r > currentPR.reps)) {
                        personalRecords[ex.exercise_name] = { weight: w, reps: r };
                    }
                }
            });
        }

        if (validSetsForExercise > 0) {
            totalSets += validSetsForExercise;
            muscleCounts[muscle] = (muscleCounts[muscle] || 0) + validSetsForExercise;
        }
    });

    // 5. Sort & Format
    const muscleStats = Object.entries(muscleCounts)
        .sort(([, a], [, b]) => b - a)
        .map(([name, count]) => ({ name, count }));

    const prs = Object.entries(personalRecords)
        .map(([name, stats]) => ({ name, ...stats }))
        .sort((a, b) => a.name.localeCompare(b.name));

    return {
        totalWorkouts,
        totalVolume,
        totalSets,
        daysActive,
        muscleStats,
        prs
    };
}