// src/lib/actions/mesoActions.ts
import type { SupabaseClient } from '@supabase/supabase-js';

export async function deleteMesocycleFromDB(supabase: SupabaseClient, id: string) {
    const { error } = await supabase.from('mesocycles').delete().eq('id', id);
    if (error) throw error;
}

export async function fetchPlanTemplates(supabase: SupabaseClient, mesocycleId: string) {
    const planTemplates: Record<string, any[]> = {};
    
    // 1. Get unique incomplete workouts
    const { data: workouts } = await supabase
        .from('workouts')
        .select('name, id, completed')
        .eq('mesocycle_id', mesocycleId)
        .eq('completed', false) 
        .order('week_number', { ascending: true });

    if (!workouts) return planTemplates;

    const uniqueNames = [...new Set(workouts.map(w => w.name))];

    // 2. Fetch exercise blueprint for each unique workout
    for (const name of uniqueNames) {
        const exemplar = workouts.find(w => w.name === name);
        if (exemplar) {
            const { data: exercises } = await supabase
                .from('workout_exercises')
                .select('exercise_name, target_sets, set_results')
                .eq('workout_id', exemplar.id)
                .order('sort_order', { ascending: true });

            planTemplates[name] = exercises?.map(ex => ({
                name: ex.exercise_name,
                startSets: ex.target_sets,
                isDropset: ex.set_results?.some((s: any) => s.dropsets && s.dropsets.length > 0) || false
            })) || [];
        }
    }
    
    return planTemplates;
}