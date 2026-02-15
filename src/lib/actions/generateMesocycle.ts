// --- CREATION ACTIONS ---
import type { SupabaseClient } from '@supabase/supabase-js';

export function addDays(dateStr: string, days: number) {
    const result = new Date(dateStr);
    result.setDate(result.getDate() + days);
    return result.toISOString().split('T')[0];
}

export async function createMesocyclePlan(
    supabase: SupabaseClient,
    userId: string,
    config: any,
    schedule: any[],
    deloadConfig: any,
    exercisesPerType: Record<string, any[]>
) {
    const totalWeeks = config.totalCycles + (deloadConfig.enabled ? deloadConfig.duration : 0);

    // 1. Create Mesocycle
    const { data: mesoData, error: mesoError } = await supabase
        .from('mesocycles')
        .insert({
            user_id: userId,
            name: config.mesoName,
            start_date: config.startDate,
            end_date: addDays(config.startDate, (config.microcycleDays * totalWeeks) - 1),
            days_per_week: config.microcycleDays,
            total_weeks: totalWeeks,
            duration_weeks: totalWeeks
        })
        .select()
        .single();

    if (mesoError) throw mesoError;
    const mesoId = mesoData.id;

    let workoutsPayload = [];
    let workoutMeta: any[] = [];
    let runningDate = new Date(config.startDate);

    // 2. Build Workouts (Standard Cycles)
    for (let cycle = 1; cycle <= config.totalCycles; cycle++) {
        const totalSteps = Math.max(config.totalCycles - 1, 1);
        const progress = (cycle - 1) / totalSteps; 

        for (let day = 0; day < config.microcycleDays; day++) {
            const dayPlan = schedule[day];
            if (dayPlan.type === 'lift' && dayPlan.workoutName) {
                workoutsPayload.push({
                    mesocycle_id: mesoId,
                    user_id: userId,
                    name: dayPlan.workoutName,
                    scheduled_date: runningDate.toISOString().split('T')[0],
                    week_number: cycle,
                    day_number: day + 1,
                    completed: false,
                });
                workoutMeta.push({
                    templateName: dayPlan.workoutName,
                    progress: progress,
                    isDeload: false
                });
            }
            runningDate.setDate(runningDate.getDate() + 1);
        }
    }

    // 3. Build Workouts (Deload Cycles)
    if (deloadConfig.enabled) {
        for (let d = 0; d < deloadConfig.duration; d++) {
            const currentWeek = config.totalCycles + d + 1;
            const weekSettings = deloadConfig.weeks[d]; 
            
            for (let day = 0; day < config.microcycleDays; day++) {
                const dayPlan = schedule[day];
                if (dayPlan.type === 'lift' && dayPlan.workoutName) {
                    const daySettings = weekSettings.find((s: any) => s.dayIndex === dayPlan.dayIndex);
                    workoutsPayload.push({
                        mesocycle_id: mesoId,
                        user_id: userId,
                        name: dayPlan.workoutName + " (Deload)",
                        scheduled_date: runningDate.toISOString().split('T')[0],
                        week_number: currentWeek,
                        day_number: day + 1,
                        completed: false,
                    });
                    workoutMeta.push({
                        templateName: dayPlan.workoutName,
                        progress: 0, 
                        isDeload: true,
                        deloadSettings: daySettings
                    });
                }
                runningDate.setDate(runningDate.getDate() + 1);
            }
        }
    }

    const { data: createdWorkouts, error: workoutError } = await supabase.from('workouts').insert(workoutsPayload).select('id');
    if (workoutError) throw workoutError;

    let allExercisesToInsert: any[] = [];

    // 4. Build Exercises
    createdWorkouts.forEach((workout: any, index: number) => {
        const meta = workoutMeta[index];
        const template = exercisesPerType[meta.templateName];

        if (template && template.length > 0) {
            template.forEach((ex: any) => {
                let calculatedSets;
                let noteData = null;
                let configData = {};

                if (meta.isDeload && meta.deloadSettings) {
                    const s = meta.deloadSettings;
                    if (s.reduceSets > 0) {
                        const reductionMultiplier = (100 - s.reduceSets) / 100;
                        calculatedSets = Math.max(1, Math.round(ex.endSets * reductionMultiplier));
                    } else {
                        calculatedSets = ex.startSets;
                    }

                    let noteParts = [];
                    if (s.reduceWeight > 0) noteParts.push(`Weight -${s.reduceWeight}%`);
                    if (s.reduceReps > 0) noteParts.push(`Reps -${s.reduceReps}%`);
                    if (noteParts.length > 0) {
                        noteData = { text: `📉 DELOAD TARGETS:\n• ${noteParts.join('\n• ')}`, date: Date.now() };
                    }
                    configData = { deload: { reduceWeightPercent: s.reduceWeight, reduceRepsPercent: s.reduceReps } };

                } else {
                    const setDiff = ex.endSets - ex.startSets;
                    calculatedSets = Math.round(ex.startSets + (setDiff * meta.progress));
                }

                const initialDropsets = ex.isDropset ? [{ weight: null, reps: null }] : [];

                allExercisesToInsert.push({
                    workout_id: workout.id,
                    exercise_name: ex.name,
                    target_sets: calculatedSets,
                    notes: noteData,
                    config: configData,
                    set_results: Array(calculatedSets).fill({ weight: null, reps: null, dropsets: initialDropsets })
                });
            });
        }
    });

    if (allExercisesToInsert.length > 0) {
        const { error: exError } = await supabase.from('workout_exercises').insert(allExercisesToInsert);
        if (exError) throw exError;
    }
}