import type { SupabaseClient } from '@supabase/supabase-js';

export function getWeeklyChartData(data: any, filter: string) {
    if (!data?.weeklyBreakdown?.length) return { bars: [], max: 10 };
    
    const bars = data.weeklyBreakdown.map((w: any) => ({
        week: w.week,
        count: filter === "All" ? w.total : (w.muscles[filter] || 0)
    }));
    
    const max = Math.max(...bars.map((b: any) => b.count)) || 10;
    return { bars, max };
}

export async function fetchRecapData(supabase: SupabaseClient, mesoId: string) {
    console.log("Fetching recap for Meso ID:", mesoId);

    // 1. Fetch Meso Duration
    const { data: meso, error: mesoError } = await supabase
        .from('mesocycles')
        .select('duration_weeks')
        .eq('id', mesoId)
        .single();
    
    if (mesoError || !meso) {
        console.error("Recap Error: Mesocycle not found", mesoError);
        return null;
    }

    // 2. Fetch Workouts
    const { data: workouts } = await supabase
        .from('workouts')
        .select('id, week_number')
        .eq('mesocycle_id', mesoId);

    if (!workouts || workouts.length === 0) {
        console.error("Recap Error: No workouts found");
        return null;
    }

    const workoutIdMap = new Map(workouts.map(w => [w.id, w.week_number]));
    const ids = workouts.map(w => w.id);

    // 3. Fetch Exercises
    const { data: exercises } = await supabase
        .from('workout_exercises')
        .select('exercise_name, set_results, workout_id')
        .in('workout_id', ids);

    if (!exercises) return null;

    // 4. Fetch Library (for Muscle Groups)
    const { data: library } = await supabase.from('exercise_library').select('name, muscle_group');
    const muscleMap = new Map(library?.map(l => [l.name, l.muscle_group]) || []);

    // 5. Perform Calculations
    let totalVolume = 0;
    const muscleCounts: Record<string, number> = {};
    const weeklyDataMap: Record<number, any> = {};
    const exerciseHistory: Record<string, any[]> = {};

    // Initialize weeks
    for (let i = 1; i <= meso.duration_weeks; i++) {
        weeklyDataMap[i] = { total: 0, muscles: {} };
    }

    exercises.forEach(ex => {
        const week = workoutIdMap.get(ex.workout_id) || 0;
        const muscle = muscleMap.get(ex.exercise_name) || 'Other';
        if (!weeklyDataMap[week]) weeklyDataMap[week] = { total: 0, muscles: {} };

        let validSets = 0;
        let maxWeight = 0;
        let maxReps = 0;

        if (Array.isArray(ex.set_results)) {
            ex.set_results.forEach((s: any) => {
                const r = Number(s.reps);
                const w = Number(s.weight);
                if (r > 0) {
                    validSets++;
                    if (w > 0) totalVolume += (w * r);
                    if (w > maxWeight || (w === maxWeight && r > maxReps)) {
                        maxWeight = w;
                        maxReps = r;
                    }
                }
            });
        }

        if (validSets > 0) {
            muscleCounts[muscle] = (muscleCounts[muscle] || 0) + validSets;
            weeklyDataMap[week].total += validSets;
            weeklyDataMap[week].muscles[muscle] = (weeklyDataMap[week].muscles[muscle] || 0) + validSets;
            
            if (!exerciseHistory[ex.exercise_name]) exerciseHistory[ex.exercise_name] = [];
            exerciseHistory[ex.exercise_name].push({ week, bestSet: { weight: maxWeight, reps: maxReps } });
        }
    });

    // 6. Format Output
    const progress = Object.keys(exerciseHistory).map(name => {
        const hist = exerciseHistory[name].sort((a, b) => a.week - b.week);
        if (hist.length < 2) return null;
        const start = hist[0].bestSet;
        const end = hist[hist.length - 1].bestSet;
        return {
            name, start, end,
            deltaWeight: end.weight - start.weight,
            deltaReps: end.reps - start.reps
        };
    }).filter(Boolean);

    const sortedMuscles = Object.entries(muscleCounts)
        .sort(([, a], [, b]) => b - a)
        .map(([name, count]) => ({ name, count }));

    const weeklyBreakdown = Object.entries(weeklyDataMap)
        .map(([week, data]) => ({ week: Number(week), ...data }))
        .sort((a: any, b: any) => a.week - b.week);

    console.log("Recap Generated Successfully");

    return {
        totalVolume,
        muscleStats: sortedMuscles,
        weeklyBreakdown,
        progress
    };
}