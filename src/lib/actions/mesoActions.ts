// src/lib/actions/mesoActions.ts
import type { SupabaseClient } from '@supabase/supabase-js';

export async function deleteMesocycleFromDB(supabase: SupabaseClient, id: string) {
    const { error } = await supabase.from('mesocycles').delete().eq('id', id);
    if (error) throw error;
}

// export async function fetchPlanTemplates(supabase: SupabaseClient, mesocycleId: string) {
//     const planTemplates: Record<string, any[]> = {};
    
//     // 1. Get unique incomplete workouts
//     const { data: workouts } = await supabase
//         .from('workouts')
//         .select('name, id, completed')
//         .eq('mesocycle_id', mesocycleId)
//         .eq('completed', false) 
//         .order('week_number', { ascending: true });

//     if (!workouts || workouts.length === 0) return planTemplates;

//     // 2. Identify the first instance (exemplar) of each unique workout
//     const uniqueNames = [...new Set(workouts.map(w => w.name))];
//     const exemplarIds = uniqueNames.map(name => workouts.find(w => w.name === name)!.id);

//     // 3. Fetch ALL exercises for ALL exemplars in ONE network request
//     const { data: exercises } = await supabase
//         .from('workout_exercises')
//         .select('exercise_name, target_sets, set_results, workout_id')
//         .in('workout_id', exemplarIds)
//         .order('sort_order', { ascending: true });

//     // 4. Map them back to the correct template
//     for (const name of uniqueNames) {
//         const exemplarId = workouts.find(w => w.name === name)!.id;
//         const templateExercises = exercises?.filter(ex => ex.workout_id === exemplarId) || [];
        
//         planTemplates[name] = templateExercises.map(ex => ({
//             name: ex.exercise_name,
//             startSets: ex.target_sets,
//             isDropset: ex.set_results?.some((s: any) => s.dropsets && s.dropsets.length > 0) || false
//         }));
//     }
    
//     return planTemplates;
// }

export async function fetchPlanTemplates(supabase: SupabaseClient, mesocycleId: string) {
    const planTemplates: Record<string, any> = {};
    
    // 1. Get unique incomplete workouts
    const { data: workouts } = await supabase
        .from('workouts')
        .select('name, id, completed, week_number')
        .eq('mesocycle_id', mesocycleId)
        .eq('completed', false) 
        .order('week_number', { ascending: true });

    if (!workouts || workouts.length === 0) return planTemplates;

    const uniqueNames = [...new Set(workouts.map(w => w.name))];
    const workoutIds = workouts.map(w => w.id);

    // 2. Fetch ALL exercises for ALL remaining workouts in ONE network request
    const { data: exercises } = await supabase
        .from('workout_exercises')
        .select('exercise_name, target_sets, set_results, workout_id, sort_order')
        .in('workout_id', workoutIds)
        .order('sort_order', { ascending: true });

    // 3. Map them back to the correct template
    for (const name of uniqueNames) {
        const typeWorkouts = workouts.filter(w => w.name === name);
        const exemplarId = typeWorkouts[0].id;
        const exemplarExercises = exercises?.filter(ex => ex.workout_id === exemplarId) || [];
        
        const templateExercises = exemplarExercises.map(ex => {
            // Build an array of sets specifically mapped to each remaining workout
            const setsArray = typeWorkouts.map(tw => {
                const match = exercises?.find(e => e.workout_id === tw.id && e.exercise_name === ex.exercise_name);
                return match ? match.target_sets : ex.target_sets;
            });

            return {
                name: ex.exercise_name,
                isDropset: ex.set_results?.some((s: any) => s.dropsets && s.dropsets.length > 0) || false,
                manualSets: setsArray
            };
        });
        
        planTemplates[name] = {
            remainingWorkouts: typeWorkouts.map(w => ({ id: w.id, week: w.week_number })),
            exercises: templateExercises
        };
    }
    
    return planTemplates;
}