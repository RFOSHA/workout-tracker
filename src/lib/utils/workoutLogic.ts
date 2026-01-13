// src/lib/utils/workoutLogic.ts
import type { SupabaseClient } from '@supabase/supabase-js';

// 1. Pure Math Helper (No changes needed)
export function calculateNextStep(prevWeight: number | null, prevReps: number | null, currentWeek: number) {
    if (!currentWeek || currentWeek <= 1) return { weight: null, reps: null };
    
    let newWeight = prevWeight;
    let newReps = prevReps;
    
    if (newReps !== null && newReps > 0 && currentWeek > 1) newReps = newReps + 1;
    
    if (newWeight !== null && newWeight > 0 && currentWeek > 1) {
        let increase = 0;
        let rounding = 5;
        if (newWeight > 100) { increase = newWeight * 0.025; rounding = 5; } 
        else if (newWeight >= 50) { increase = newWeight * 0.05; rounding = 5; } 
        else { increase = newWeight * 0.10; rounding = 2.5; }
        newWeight = Math.round((newWeight + increase) / rounding) * rounding;
    }
    return { weight: newWeight, reps: newReps };
}

// 2. Database Helper: Get Past Workouts
export async function getPreviousWorkouts(supabase: SupabaseClient, names: string[], currentId: string) {
    if (names.length === 0) return {};
    const { data } = await supabase
        .from('workout_exercises')
        .select(`exercise_name, set_results, workouts!inner ( completed_at )`)
        .in('exercise_name', names)
        .neq('workout_id', currentId)
        .not('workouts.completed_at', 'is', null)
        .order('id', { ascending: false });

    if (!data) return {};
    const historyMap: Record<string, any> = {};
    data.forEach((row: any) => {
        if (!historyMap[row.exercise_name]) {
            historyMap[row.exercise_name] = { set_results: row.set_results };
        }
    });
    return historyMap;
}

// 3. Database Helper: Get Notes
export async function getMesocycleNotes(supabase: SupabaseClient, names: string[], mesoId: string, currentWorkoutId: string) {
    if (!names.length || !mesoId) return {};
    
    const { data: workoutsInMeso } = await supabase
        .from('workouts')
        .select('id, week_number')
        .eq('mesocycle_id', mesoId)
        .order('week_number', { ascending: true });
    
    if (!workoutsInMeso) return {};
    
    const workoutIdMap = new Map(workoutsInMeso.map(w => [w.id, w.week_number]));
    const ids = workoutsInMeso.map(w => w.id);
    
    const { data: noteRows } = await supabase
        .from('workout_exercises')
        .select('exercise_name, notes, workout_id')
        .in('exercise_name', names)
        .in('workout_id', ids)
        .not('notes', 'is', null);

    const map: Record<string, any[]> = {};
    noteRows?.forEach((row: any) => {
        if (!map[row.exercise_name]) map[row.exercise_name] = [];
        let noteText = "";
        let noteDate = "";
        if (row.notes && typeof row.notes === 'object') {
            noteText = row.notes.text;
            noteDate = row.notes.date;
        }
        if (noteText && row.workout_id !== currentWorkoutId) { 
             map[row.exercise_name].push({
                week: workoutIdMap.get(row.workout_id),
                text: noteText,
                date: noteDate
             });
        }
    });
    
    for (const key in map) { 
        map[key].sort((a, b) => (a.date || 0) - (b.date || 0)); 
    }
    return map;
}

// 4. Main Function: Orchestrate Data Loading
export async function getWorkoutData(supabase: SupabaseClient, workoutId: string) {
    // A. Fetch Basic Workout Info
    const { data: wData } = await supabase.from('workouts').select('*').eq('id', workoutId).single();
    if (!wData) return null;
    const workout = wData;

    // B. Start Workout if needed
    if (!workout.started_at) {
        await supabase.from('workouts').update({ started_at: new Date().toISOString() }).eq('id', workoutId);
    }

    // C. Fetch Exercises for CURRENT Workout
    const { data: exData } = await supabase
        .from('workout_exercises')
        .select('*')
        .eq('workout_id', workoutId)
        .order('sort_order', { ascending: true })
        .order('id', { ascending: true });

    let exercises = [];

    if (exData) {
        const exerciseNames = exData.map((e: any) => e.exercise_name || "");
        
        // D. Fetch History (Previous Workouts)
        const [historyMap, mesoNotesMap] = await Promise.all([
            getPreviousWorkouts(supabase, exerciseNames, workoutId),
            getMesocycleNotes(supabase, exerciseNames, workout.mesocycle_id, workoutId)
        ]);

        // E. Process Exercises
        exercises = exData.map(ex => {
            let currentResults = ex.set_results ? [...ex.set_results] : []; 
            const targetCount = ex.target_sets || 0;

            while (currentResults.length < targetCount) {
                currentResults.push({ weight: null, reps: null, dropsets: [] });
            }

            const prevData = historyMap[ex.exercise_name];
            const prevStats = prevData?.set_results;
            
            // 1. EXTRACT DELOAD CONFIG FROM NEW COLUMN
            let deloadConfig = null;
            if (ex.config && ex.config.deload) {
                deloadConfig = ex.config.deload;
            }

            // Extract notes purely for display
            let currentNoteText = "";
            if (ex.notes && typeof ex.notes === 'object') {
                currentNoteText = ex.notes.text || "";
            }

            currentResults = currentResults.map((item: any, idx: number) => {
                // ... (item initialization) ...

                if (prevStats && prevStats[idx]) {
                    const prevSet = prevStats[idx];
                    
                    // 2. APPLY LOGIC (Check new deloadConfig source)
                    if (deloadConfig) {
                        // --- DELOAD PATH ---
                        let suggestedWeight = prevSet.weight;
                        let suggestedReps = prevSet.reps;

                        if (suggestedWeight && deloadConfig.reduceWeightPercent > 0) {
                            const factor = (100 - deloadConfig.reduceWeightPercent) / 100;
                            suggestedWeight = Math.floor((suggestedWeight * factor) / 5) * 5;
                            if (suggestedWeight === 0 && prevSet.weight > 0) suggestedWeight = 5; 
                        }

                        if (suggestedReps && deloadConfig.reduceRepsPercent > 0) {
                            const factor = (100 - deloadConfig.reduceRepsPercent) / 100;
                            suggestedReps = Math.floor(suggestedReps * factor);
                            if (suggestedReps < 1) suggestedReps = 1;
                        }

                        item.suggestedWeight = suggestedWeight;
                        item.suggestedReps = suggestedReps;
                        item._hasSuggestion = true;

                    } else {
                        // --- STANDARD PATH ---
                        const suggestion = calculateNextStep(prevSet.weight, prevSet.reps, Number(workout.week_number));
                        item.suggestedWeight = suggestion.weight;
                        item.suggestedReps = suggestion.reps;
                        if (item.suggestedWeight !== null || item.suggestedReps !== null) {
                            item._hasSuggestion = true;
                        }
                    }
                    
                    // Override
                    if (item.target_weight) item.suggestedWeight = item.target_weight;
                    if (item.target_reps) item.suggestedReps = item.target_reps;
                }
                return item;
            });

            return { 
              ...ex, 
              set_results: currentResults, 
              currentNote: currentNoteText,
              noteHistory: mesoNotesMap[ex.exercise_name] || [],
              showNotes: !!currentNoteText
            };
        });
    }

    return { workout, exercises };
}

export async function updateExerciseSets(supabase: SupabaseClient, exercise: any) {
    // Map the UI state to a clean DB object
    const cleanResults = exercise.set_results.map((s: any) => {
        // Calculate hits based on suggestions (if they exist)
        const hitWeight = (s.weight !== null && s.suggestedWeight != null) 
            ? (s.weight >= s.suggestedWeight) 
            : false;
            
        const hitReps = (s.reps !== null && s.suggestedReps != null) 
            ? (s.reps >= s.suggestedReps) 
            : false;

        return {
            weight: s.weight,
            reps: s.reps,
            dropsets: s.dropsets,
            target_weight: s.suggestedWeight || null,
            target_reps: s.suggestedReps || null,
            hit_weight: hitWeight,
            hit_reps: hitReps
        };
    });

    // Perform the update
    return await supabase
        .from('workout_exercises')
        .update({ set_results: cleanResults })
        .eq('id', exercise.id);
}

export async function addExerciseToFuture(
    supabase: SupabaseClient, 
    mesoId: string, 
    dayNumber: number, 
    currentWeek: number, 
    exerciseName: string, 
    targetSets: number
) {
    // Find future workouts of same type (e.g. Day 1)
    const { data: futureWorkouts } = await supabase
        .from('workouts')
        .select('id')
        .eq('mesocycle_id', mesoId)
        .eq('day_number', dayNumber)
        .gt('week_number', currentWeek);

    if (futureWorkouts?.length) {
        const initialSets = Array(targetSets).fill({ weight: null, reps: null, dropsets: [] });
        
        const payloads = futureWorkouts.map(w => ({
            workout_id: w.id,
            exercise_name: exerciseName,
            target_sets: targetSets,
            set_results: initialSets,
            sort_order: 99 // Append to end
        }));

        await supabase.from('workout_exercises').insert(payloads);
    }
}