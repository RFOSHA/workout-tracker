// src/lib/actions/workoutActions.ts
import type { SupabaseClient } from '@supabase/supabase-js';

// --- SET ACTIONS ---

export async function updateExerciseSets(supabase: SupabaseClient, exercise: any) {
    // 1. Clean the results to ensure we save exactly what we expect
    // This mimics the original logic which mapped UI fields (suggestedWeight) to DB fields (target_weight)
    const cleanResults = exercise.set_results.map((s: any) => {
        // Calculate hit status (optional, but good for data integrity)
        const hitWeight = (s.weight !== null && s.suggestedWeight != null) 
            ? (s.weight >= s.suggestedWeight) 
            : false;
            
        const hitReps = (s.reps !== null && s.suggestedReps != null) 
            ? (s.reps >= s.suggestedReps) 
            : false;

        return {
            weight: s.weight, // <--- Ensure this is being captured
            reps: s.reps,     // <--- Ensure this is being captured
            dropsets: s.dropsets || [],
            // Map the suggestion back to target so it persists
            target_weight: s.suggestedWeight || s.target_weight || null,
            target_reps: s.suggestedReps || s.target_reps || null,
            hit_weight: hitWeight,
            hit_reps: hitReps
        };
    });

    console.log("Saving sets for", exercise.exercise_name, cleanResults); // Debug Log

    // 2. Perform the update
    const { error } = await supabase
        .from('workout_exercises')
        .update({ 
            set_results: cleanResults,
            target_sets: cleanResults.length 
        })
        .eq('id', exercise.id);

    if (error) {
        console.error("Save Error:", error);
        throw error;
    }
}

export async function deleteSet(supabase: SupabaseClient, exercise: any, setIndex: number) {
    // 1. Optimistic removal
    const updatedSets = exercise.set_results.filter((_: any, idx: number) => idx !== setIndex);
    
    // 2. DB Update
    const { error } = await supabase
        .from('workout_exercises')
        .update({ 
            set_results: updatedSets,
            target_sets: updatedSets.length 
        })
        .eq('id', exercise.id);

    if (error) throw error;
    return updatedSets; // Return new array to update UI
}

// --- EXERCISE ACTIONS ---

export async function saveNote(supabase: SupabaseClient, exerciseId: string, noteText: string) {
    const noteObj = { date: Date.now(), text: noteText };
    const { error } = await supabase
        .from('workout_exercises')
        .update({ notes: noteObj })
        .eq('id', exerciseId);
    if (error) throw error;
}

export async function deleteExercise(supabase: SupabaseClient, exerciseId: string) {
    const { error } = await supabase.from('workout_exercises').delete().eq('id', exerciseId);
    if (error) throw error;
}

export async function moveExerciseOrder(supabase: SupabaseClient, exercises: any[]) {
    // Batch update all sort_orders
    const updates = exercises.map((ex, i) => 
        supabase
            .from('workout_exercises')
            .update({ sort_order: i })
            .eq('id', ex.id)
    );
    const results = await Promise.all(updates);
    const error = results.find(r => r.error)?.error;
    if (error) throw error;
}

export async function addNewExercise(
    supabase: SupabaseClient, 
    workoutId: string, 
    name: string, 
    targetSets: number, 
    orderIndex: number
) {
    const initialSets = Array.from({ length: targetSets }, () => ({ weight: null, reps: null, dropsets: [] }));
    
    const { data, error } = await supabase.from('workout_exercises').insert({ 
        workout_id: workoutId, 
        exercise_name: name, 
        target_sets: targetSets, 
        set_results: initialSets,
        sort_order: orderIndex
    }).select().single();
    
    if (error) throw error;
    return { ...data, set_results: initialSets };
}

export async function addExerciseToFutureWorkouts(
    supabase: SupabaseClient, 
    mesocycleId: string, 
    dayNumber: number, 
    currentWeek: number, 
    name: string, 
    targetSets: number
) {
    const { data: futureWorkouts } = await supabase
        .from('workouts')
        .select('id')
        .eq('mesocycle_id', mesocycleId)
        .eq('day_number', dayNumber)
        .gt('week_number', currentWeek);

    if (futureWorkouts && futureWorkouts.length > 0) {
        const initialSets = Array.from({ length: targetSets }, () => ({ weight: null, reps: null, dropsets: [] }));
        const futurePayload = futureWorkouts.map(w => ({
            workout_id: w.id,
            exercise_name: name,
            target_sets: targetSets,
            set_results: initialSets,
            sort_order: 99 // Append to end
        }));
        await supabase.from('workout_exercises').insert(futurePayload);
    }
}