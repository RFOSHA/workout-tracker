import type { SupabaseClient } from '@supabase/supabase-js';

// Convert flat workout list to 2D Calendar Grid
export function buildCalendarGrid(workouts: any[], durationWeeks: number, daysPerWeek: number) {
    const grid = Array.from({ length: durationWeeks }, () => Array(daysPerWeek).fill(null));
    workouts.forEach(w => {
        const wIndex = w.week_number - 1;
        const dIndex = w.day_number - 1;
        if (grid[wIndex]) grid[wIndex][dIndex] = w;
    });
    return grid;
}

// Complex logic to update future workouts from the template
export async function updateFutureWorkouts(
    supabase: SupabaseClient, 
    mesoId: string, 
    templates: Record<string, any[]>
) {
    // 1. Find all future incomplete workouts
    const { data: workouts } = await supabase
        .from('workouts')
        .select('id, name')
        .eq('mesocycle_id', mesoId)
        .eq('completed', false);

    if (!workouts?.length) return;

    // 2. Iterate templates (e.g., "Push", "Pull")
    for (const [typeName, exercises] of Object.entries(templates)) {
        const targetIds = workouts.filter(w => w.name === typeName).map(w => w.id);
        
        if (targetIds.length > 0) {
            // Delete existing exercises for these days
            await supabase.from('workout_exercises').delete().in('workout_id', targetIds);

            // Prepare bulk insert
            const payloads: any[] = [];
            targetIds.forEach(wid => {
                exercises.forEach((ex, i) => {
                    const setResults = Array(ex.startSets).fill({ 
                        weight: null, reps: null, 
                        dropsets: ex.isDropset ? [{ weight: null, reps: null }] : [] 
                    });

                    payloads.push({
                        workout_id: wid,
                        exercise_name: ex.name,
                        target_sets: ex.startSets,
                        set_results: setResults,
                        sort_order: i
                    });
                });
            });

            if (payloads.length > 0) {
                await supabase.from('workout_exercises').insert(payloads);
            }
        }
    }
}