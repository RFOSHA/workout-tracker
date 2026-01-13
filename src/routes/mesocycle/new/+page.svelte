<script lang="ts">
  import { onMount } from "svelte";
  import { supabase } from "$lib/supabaseClient";
  import { goto } from "$app/navigation";
  import { ArrowRight, Calendar, Dumbbell, Layers, CheckCircle, Plus, Trash2, TrendingUp, Zap, X, ShieldAlert, Percent } from "lucide-svelte";

  // --- STATE ---
  let step = 1;
  let loading = false;
  let exerciseLibrary: any[] = [];

  // Dropdown State
  let activeSearch: { t: number, e: number } | null = null;

  // Custom Exercise Creation State
  let showCustomExerciseModal = false;
  let customExerciseName = "";
  let customExerciseMuscle = "";
  let pendingCustomContext: { t: number, e: number } | null = null;

  const MUSCLE_GROUPS = [
    'Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 
    'Quads', 'Hamstrings', 'Calves', 'Abs', 'Forearms', 'Glutes'
  ];

  // STEP 1: CONFIGURATION
  let config = {
    microcycleDays: 7,      
    liftingDays: 5,         
    restDays: 2,           
    workoutTypes: 3,       
    totalCycles: 6,         
    startDate: new Date().toISOString().split('T')[0],
    mesoName: ""
  };

  // STEP 2 & 3
  let workoutDefinitions: string[] = [];
  let selectedGroups: string[][] = [];
  let schedule: { dayIndex: number; type: 'rest' | 'lift'; workoutName?: string }[] = [];

  // STEP 4
  let exercisesPerType: Record<string, { name: string; startSets: number; endSets: number; isDropset: boolean }[]> = {};

  // STEP 5: DELOAD CONFIG
  interface DeloadDaySettings {
    dayIndex: number;
    workoutName: string;
    reduceSets: number;   // % reduction (0-100)
    reduceWeight: number; // % reduction (0-100)
    reduceReps: number;   // % reduction (0-100)
  }

  let deloadConfig = {
    enabled: false,
    duration: 1, // 1 or 2 weeks
    weeks: [] as DeloadDaySettings[][] 
  };

  // --- LIFECYCLE ---
  onMount(async () => {
    await fetchExercises();
    window.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (target.tagName !== 'INPUT' && !target.closest('.custom-exercise-modal')) {
            activeSearch = null;
        }
    });
  });

  // --- LOGIC ---

  async function fetchExercises() {
    const { data } = await supabase
        .from('exercise_library')
        .select('name, muscle_group')
        .order('name');
    if (data) exerciseLibrary = data;
  }

  function triggerCustomExercise(name: string, typeIndex: number, exIndex: number) {
    customExerciseName = name;
    const activeMuscles = selectedGroups[typeIndex];
    customExerciseMuscle = activeMuscles.length > 0 ? activeMuscles[0] : '';
    pendingCustomContext = { t: typeIndex, e: exIndex };
    activeSearch = null;
    showCustomExerciseModal = true;
  }

  async function saveCustomExercise() {
    if (!customExerciseName || !customExerciseMuscle) return;
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { error } = await supabase.from('exercise_library').insert({
            name: customExerciseName,
            muscle_group: customExerciseMuscle,
            user_id: user.id
        });
        if (error) throw error;

        const newEx = { name: customExerciseName, muscle_group: customExerciseMuscle };
        exerciseLibrary = [...exerciseLibrary, newEx].sort((a,b) => a.name.localeCompare(b.name));

        if (pendingCustomContext) {
            const { t, e } = pendingCustomContext;
            exercisesPerType[workoutDefinitions[t]][e].name = customExerciseName;
        }

        showCustomExerciseModal = false;
        pendingCustomContext = null;

    } catch (err: any) {
        alert("Error saving exercise: " + err.message);
    }
  }

  function goToStep2() {
    if ((config.liftingDays + config.restDays) !== config.microcycleDays) {
      alert(`Math error: Lifting (${config.liftingDays}) + Rest (${config.restDays}) must equal Cycle (${config.microcycleDays}).`);
      return;
    }
    if (workoutDefinitions.length !== config.workoutTypes) {
        workoutDefinitions = Array(config.workoutTypes).fill("");
    }
    if (selectedGroups.length !== config.workoutTypes) {
        selectedGroups = Array.from({ length: config.workoutTypes }, () => []);
    }
    step = 2;
  }

  function toggleMuscleGroup(workoutIndex: number, muscle: string) {
    const currentList = selectedGroups[workoutIndex];
    if (currentList.includes(muscle)) {
        selectedGroups[workoutIndex] = currentList.filter(m => m !== muscle);
    } else {
        selectedGroups[workoutIndex] = [...currentList, muscle];
    }
  }

  function goToStep3() {
    if (workoutDefinitions.some(n => !n.trim())) {
      alert("Please name all your workout types.");
      return;
    }
    if (schedule.length !== config.microcycleDays) {
        schedule = Array.from({ length: config.microcycleDays }, (_, i) => ({
            dayIndex: i + 1,
            type: 'rest',
            workoutName: undefined
        }));
    }
    step = 3;
  }

  function goToStep4() {
    workoutDefinitions.forEach(type => {
        if (!exercisesPerType[type]) {
            exercisesPerType[type] = []; 
        }
    });
    step = 4;
  }

  function goToStep5() {
    updateDeloadWeeks();
    step = 5;
  }

  // Regenerate deload config structure if duration/schedule changes
  function updateDeloadWeeks() {
    const currentWeeks = deloadConfig.weeks;
    const newWeeks = [];

    for (let w = 0; w < deloadConfig.duration; w++) {
        const existingWeek = currentWeeks[w] || [];
        
        const weekConfig = schedule
            .filter(day => day.type === 'lift' && day.workoutName)
            .map(day => {
                const prevConfig = existingWeek.find(d => d.dayIndex === day.dayIndex);
                
                return {
                    dayIndex: day.dayIndex,
                    workoutName: day.workoutName!,
                    reduceSets: prevConfig ? prevConfig.reduceSets : 50, // Default 50%
                    reduceWeight: prevConfig ? prevConfig.reduceWeight : 0,
                    reduceReps: prevConfig ? prevConfig.reduceReps : 0
                };
            });
        
        newWeeks.push(weekConfig);
    }
    deloadConfig.weeks = newWeeks;
  }

  function addExerciseToType(typeName: string) {
    exercisesPerType[typeName] = [
        ...exercisesPerType[typeName], 
        { name: "", startSets: 3, endSets: 5, isDropset: false } 
    ];
  }

  function removeExerciseFromType(typeName: string, index: number) {
    const updated = [...exercisesPerType[typeName]];
    updated.splice(index, 1);
    exercisesPerType[typeName] = updated;
  }

  function toggleDropset(typeName: string, index: number) {
    exercisesPerType[typeName][index].isDropset = !exercisesPerType[typeName][index].isDropset;
  }

  function selectExercise(typeName: string, exIndex: number, name: string) {
    exercisesPerType[typeName][exIndex].name = name;
    activeSearch = null;
  }

  async function generateMesocycle() {
    loading = true;
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("You must be logged in.");

        const totalWeeks = config.totalCycles + (deloadConfig.enabled ? deloadConfig.duration : 0);

        // 1. Create Mesocycle
        const { data: mesoData, error: mesoError } = await supabase
            .from('mesocycles')
            .insert({
                user_id: user.id,
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
                        user_id: user.id,
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
                        // Fix: use dayPlan.dayIndex to find settings
                        const daySettings = weekSettings.find(s => s.dayIndex === dayPlan.dayIndex);

                        workoutsPayload.push({
                            mesocycle_id: mesoId,
                            user_id: user.id,
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

        const { data: createdWorkouts, error: workoutError } = await supabase
            .from('workouts')
            .insert(workoutsPayload)
            .select('id');
        if (workoutError) throw workoutError;

        let allExercisesToInsert: any[] = [];

        // 4. Build Exercises
        createdWorkouts.forEach((workout, index) => {
            const meta = workoutMeta[index];
            const template = exercisesPerType[meta.templateName];

            if (template && template.length > 0) {
                template.forEach(ex => {
                    let calculatedSets;
                    let noteData = null;
                    let configData = {}; // New Config Object

                    if (meta.isDeload && meta.deloadSettings) {
                        const s = meta.deloadSettings;
                        
                        // Calculate Sets
                        if (s.reduceSets > 0) {
                            const reductionMultiplier = (100 - s.reduceSets) / 100;
                            calculatedSets = Math.max(1, Math.round(ex.endSets * reductionMultiplier));
                        } else {
                            calculatedSets = ex.startSets;
                        }

                        // Generate Note Text (Visual Only)
                        let noteParts = [];
                        if (s.reduceWeight > 0) noteParts.push(`Weight -${s.reduceWeight}%`);
                        if (s.reduceReps > 0) noteParts.push(`Reps -${s.reduceReps}%`);
                        
                        if (noteParts.length > 0) {
                            noteData = {
                                text: `📉 DELOAD TARGETS:\n• ${noteParts.join('\n• ')}`,
                                date: Date.now()
                            };
                        }

                        // Store Logic in 'config' column
                        configData = {
                            deload: {
                                reduceWeightPercent: s.reduceWeight,
                                reduceRepsPercent: s.reduceReps
                            }
                        };

                    } else {
                        // Normal Progression
                        const setDiff = ex.endSets - ex.startSets;
                        calculatedSets = Math.round(ex.startSets + (setDiff * meta.progress));
                    }

                    const initialDropsets = ex.isDropset ? [{ weight: null, reps: null }] : [];

                    allExercisesToInsert.push({
                        workout_id: workout.id,
                        exercise_name: ex.name,
                        target_sets: calculatedSets,
                        notes: noteData,   // User-visible text
                        config: configData, // System logic data
                        set_results: Array(calculatedSets).fill({ 
                            weight: null, 
                            reps: null, 
                            dropsets: initialDropsets 
                        })
                    });
                });
            }
        });

        if (allExercisesToInsert.length > 0) {
            const { error: exError } = await supabase.from('workout_exercises').insert(allExercisesToInsert);
            if (exError) throw exError;
        }

        goto('/');
    } catch (err: any) {
        alert("Error creating plan: " + err.message);
        console.error(err);
    } finally {
        loading = false;
    }
  }

  function addDays(dateStr: string, days: number) {
    const result = new Date(dateStr);
    result.setDate(result.getDate() + days);
    return result.toISOString().split('T')[0];
  }
</script>

<div class="min-h-screen bg-gray-900 text-white p-6 pb-32">
  
  <header class="mb-8">
    <h1 class="text-3xl font-bold">Build Your Plan</h1>
    <p class="text-gray-400">Step {step} of 5</p>
    <div class="h-1 w-full bg-gray-800 mt-4 rounded-full overflow-hidden">
      <div class="h-full bg-blue-500 transition-all duration-300" style="width: {(step/5)*100}%"></div>
    </div>
  </header>

  {#if step === 1}
    <div class="max-w-xl mx-auto space-y-6 animate-fade-in">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-bold text-gray-500 uppercase mb-2">Cycle Name</label>
              <input type="text" bind:value={config.mesoName} placeholder="e.g. Winter Bulk" class="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 focus:border-blue-500 outline-none" />
            </div>
            <div>
                <label class="block text-xs font-bold text-gray-500 uppercase mb-2">Start Date</label>
                <input type="date" bind:value={config.startDate} class="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 focus:border-blue-500 outline-none" />
            </div>
          </div>
          <hr class="border-gray-800" />
          <div class="space-y-4">
            <h3 class="font-bold text-lg flex items-center gap-2">
                <Calendar size={20} class="text-blue-400"/> Microcycle Setup
            </h3>
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <label class="block text-xs text-gray-400 mb-1">Days in a "Week"</label>
                    <input type="number" bind:value={config.microcycleDays} class="w-full bg-gray-800 p-3 rounded border border-gray-700" />
                </div>
                <div>
                    <label class="block text-xs text-gray-400 mb-1">Total Cycles</label>
                    <input type="number" bind:value={config.totalCycles} class="w-full bg-gray-800 p-3 rounded border border-gray-700" />
                </div>
            </div>
            <div class="grid grid-cols-3 gap-4">
                <div>
                    <label class="block text-xs text-gray-400 mb-1">Lifting Days</label>
                    <input type="number" bind:value={config.liftingDays} class="w-full bg-gray-800 p-3 rounded border border-gray-700" />
                </div>
                <div>
                    <label class="block text-xs text-gray-400 mb-1">Rest Days</label>
                    <input type="number" bind:value={config.restDays} class="w-full bg-gray-800 p-3 rounded border border-gray-700" />
                </div>
                <div>
                    <label class="block text-xs text-blue-400 font-bold mb-1">Unique Types</label>
                    <input type="number" bind:value={config.workoutTypes} class="w-full bg-gray-800 p-3 rounded border border-blue-500/50" />
                </div>
            </div>
          </div>
          <button on:click={goToStep2} class="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl mt-8 flex justify-center items-center gap-2">
            Define Workouts <ArrowRight size={20} />
          </button>
    </div>
  {/if}

  {#if step === 2}
    <div class="max-w-xl mx-auto animate-fade-in pb-20">
      <h2 class="text-xl font-bold mb-4 flex items-center gap-2">
        <Layers size={20} class="text-green-400"/> Name Your Routines
      </h2>
      <div class="space-y-6"> 
        {#each workoutDefinitions as _, i}
            <div class="bg-gray-800 p-4 rounded-xl border border-gray-700">
                <div class="flex items-center gap-4 mb-3">
                    <span class="text-gray-500 font-mono w-6 text-right">{i+1}.</span>
                    <input 
                        type="text" 
                        bind:value={workoutDefinitions[i]} 
                        placeholder={`Workout Type #${i+1} (e.g. Push)`}
                        class="flex-1 bg-gray-900 border border-gray-600 rounded-lg p-3 focus:border-green-500 outline-none"
                        autofocus={i===0}
                    />
                </div>

                <div class="pl-10">
                    <p class="text-[10px] text-gray-400 uppercase tracking-widest mb-2 font-bold">Target Muscles</p>
                    <div class="flex flex-wrap gap-2">
                        {#each MUSCLE_GROUPS as muscle}
                            <button 
                                on:click={() => toggleMuscleGroup(i, muscle)}
                                class="text-xs px-3 py-1.5 rounded-full border transition-all
                                  {selectedGroups[i].includes(muscle) 
                                    ? 'bg-blue-600 border-blue-500 text-white' 
                                    : 'bg-gray-900 border-gray-700 text-gray-500 hover:border-gray-500'}"
                            >
                                {muscle}
                            </button>
                        {/each}
                    </div>
                </div>
            </div>
        {/each}

      </div>
      <div class="flex gap-4 mt-8">
        <button on:click={() => step = 1} class="px-6 py-4 rounded-xl bg-gray-800 text-gray-400">Back</button>
        <button on:click={goToStep3} class="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold py-4 rounded-xl flex justify-center items-center gap-2">
            Schedule Days <ArrowRight size={20} />
        </button>
      </div>
    </div>
  {/if}

  {#if step === 3}
    <div class="max-w-2xl mx-auto animate-fade-in">
        <h2 class="text-xl font-bold mb-4 flex items-center gap-2">
            <Dumbbell size={20} class="text-purple-400"/> Schedule Your Microcycle
          </h2>
          <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {#each schedule as day, i}
              <div class="bg-gray-800 border border-gray-700 rounded-lg p-3">
                <div class="flex justify-between items-center mb-2">
                    <span class="text-xs font-bold text-gray-500 uppercase tracking-widest">Day {day.dayIndex}</span>
                    <span class="text-xs {day.type === 'lift' ? 'bg-purple-900 text-purple-200' : 'bg-gray-700 text-gray-300'} px-2 py-0.5 rounded">
                        {day.type === 'lift' ? 'Lift' : 'Rest'}
                    </span>
                </div>
                <select 
                    bind:value={day.workoutName}
                    on:change={(e) => { day.type = e.currentTarget.value ? 'lift' : 'rest'; }}
                    class="w-full bg-gray-900 border border-gray-600 rounded p-2 text-sm text-white focus:ring-2 focus:ring-purple-500 outline-none"
                >
                    <option value="">-- Rest --</option>
                    {#each workoutDefinitions as def}
                        <option value={def}>{def}</option>
                    {/each}
                </select>
               </div>
            {/each}
          </div>
          <div class="flex gap-4 mt-8">
            <button on:click={() => step = 2} class="px-6 py-4 rounded-xl bg-gray-800 text-gray-400">Back</button>
            <button on:click={goToStep4} class="flex-1 bg-purple-600 hover:bg-purple-500 text-white font-bold py-4 rounded-xl flex justify-center items-center gap-2">
                Set Progression <ArrowRight size={20} />
            </button>
          </div>
    </div>
  {/if}

  {#if step === 4}
    <div class="max-w-3xl mx-auto animate-fade-in pb-20">
      
      <h2 class="text-xl font-bold mb-2 flex items-center gap-2">
        <TrendingUp size={20} class="text-yellow-400"/> Define Progression
      </h2>
      <p class="text-gray-400 text-sm mb-6">
        Search for exercises, set volume, and mark Drop Sets.
      </p>

      <div class="space-y-8">
        {#each workoutDefinitions as typeName, i}
          
          {@const activeMuscles = selectedGroups[i]}
          {@const baseLibrary = activeMuscles.length > 0 
              ? exerciseLibrary.filter(ex => activeMuscles.includes(ex.muscle_group))
              : exerciseLibrary}

          <div class="bg-gray-800 border border-gray-700 rounded-xl overflow-visible relative">
            <div class="bg-gray-700/50 p-3 border-b border-gray-700 grid grid-cols-[20px_1fr_50px_50px_20px_20px] gap-2 items-center">
                <span></span> 
                <div>
                    <h3 class="font-bold text-white text-sm">{typeName}</h3>
                    <p class="text-[10px] text-gray-400">{activeMuscles.length > 0 ? activeMuscles.join(', ') : 'All Exercises'}</p>
                </div>
                <span class="text-center text-[10px] font-bold uppercase text-gray-400 tracking-wider">Start</span>
                <span class="text-center text-[10px] font-bold uppercase text-gray-400 tracking-wider">End</span>
                <span></span><span></span> 
            </div>

            <div class="p-3 space-y-2">
                {#if exercisesPerType[typeName]?.length === 0}
                    <div class="text-center py-4 text-gray-500 text-sm italic">No exercises added yet.</div>
                {/if}

                {#each exercisesPerType[typeName] as ex, exIdx}
                    
                    {@const searchResults = ex.name.length > 0 
                        ? baseLibrary.filter(item => item.name.toLowerCase().includes(ex.name.toLowerCase())).slice(0, 6)
                        : baseLibrary.slice(0, 50)}

                    <div class="grid grid-cols-[20px_1fr_50px_50px_20px_20px] gap-2 items-center">
                        <span class="text-gray-500 text-xs font-mono text-center">{exIdx + 1}</span>
                        
                        <div class="relative w-full">
                            <input 
                                type="text" 
                                placeholder="Search..." 
                                bind:value={ex.name}
                                on:focus={() => activeSearch = { t: i, e: exIdx }}
                                class="w-full bg-gray-900 border border-gray-600 rounded p-2 text-sm text-white focus:border-blue-500 outline-none placeholder-gray-600"
                            />

                            {#if activeSearch?.t === i && activeSearch?.e === exIdx}
                                <div class="absolute top-full left-0 min-w-[300px] max-w-[400px] bg-gray-800 border border-gray-600 rounded-lg mt-1 z-50 shadow-2xl overflow-y-auto max-h-60 animate-fade-in">
                                    
                                    {#each searchResults as item}
                                        <button 
                                            on:mousedown={() => selectExercise(typeName, exIdx, item.name)}
                                            class="w-full flex justify-between items-center p-3 hover:bg-gray-700 text-left transition-colors border-b border-gray-700 last:border-0 group"
                                        >
                                            <span class="text-sm text-gray-200 group-hover:text-white font-medium pr-4 leading-snug">{item.name}</span>
                                            <span class="shrink-0 text-[10px] uppercase tracking-wider font-bold bg-gray-900 text-gray-500 px-2 py-1 rounded border border-gray-700 whitespace-nowrap group-hover:border-gray-500 group-hover:text-gray-300 transition-colors">
                                                {item.muscle_group}
                                            </span>
                                        </button>
                                    {/each}

                                    {#if ex.name.trim().length > 0 && !searchResults.some(r => r.name.toLowerCase() === ex.name.toLowerCase())}
                                        <button 
                                            on:mousedown={() => triggerCustomExercise(ex.name, i, exIdx)}
                                            class="w-full p-3 bg-blue-900/30 text-blue-300 hover:bg-blue-900/50 hover:text-white text-left text-sm font-bold border-t border-blue-800/50 flex items-center gap-2"
                                        >
                                            <Plus size={16} /> Create "{ex.name}"
                                        </button>
                                    {/if}

                                </div>
                            {/if}
                        </div>

                        <input type="number" bind:value={ex.startSets} class="w-full bg-gray-900 border border-gray-600 rounded p-2 text-center text-sm text-white focus:border-blue-500 outline-none" />
                        <input type="number" bind:value={ex.endSets} class="w-full bg-gray-900 border border-gray-600 rounded p-2 text-center text-sm text-white focus:border-blue-500 outline-none" />
                        <div class="flex justify-center">
                            <button on:click={() => toggleDropset(typeName, exIdx)} class="p-2 rounded transition-colors {ex.isDropset ? 'text-yellow-400 bg-yellow-400/10' : 'text-gray-600 hover:text-gray-400'}"><Zap size={16} fill={ex.isDropset ? "currentColor" : "none"} /></button>
                        </div>
                        <button on:click={() => removeExerciseFromType(typeName, exIdx)} class="flex items-center justify-center text-gray-500 hover:text-red-500 transition-colors h-full"><Trash2 size={16} /></button>
                    </div>
                {/each}
                <button on:click={() => addExerciseToType(typeName)} class="w-full py-2 border border-dashed border-gray-600 text-gray-400 rounded-lg text-sm hover:border-yellow-500 hover:text-yellow-400 transition-colors flex items-center justify-center gap-2 mt-2"><Plus size={16} /> Add Exercise</button>
            </div>
          </div>
        {/each}
      </div>

      <div class="flex gap-4 mt-8">
        <button on:click={() => step = 3} class="px-6 py-4 rounded-xl bg-gray-800 text-gray-400">Back</button>
        <button on:click={goToStep5} class="flex-1 bg-purple-600 hover:bg-purple-500 text-white font-bold py-4 rounded-xl flex justify-center items-center gap-2">
            Deload Settings <ArrowRight size={20} />
        </button>
      </div>
    </div>
  {/if}

  {#if step === 5}
    <div class="max-w-2xl mx-auto animate-fade-in pb-20">
        <h2 class="text-xl font-bold mb-6 flex items-center gap-2">
            <ShieldAlert size={20} class="text-amber-400"/> Deload Strategy
        </h2>

        <div class="bg-gray-800 border border-gray-700 rounded-xl p-6 mb-8">
            <label class="flex items-center gap-4 cursor-pointer mb-6 border-b border-gray-700 pb-6">
                <input type="checkbox" bind:checked={deloadConfig.enabled} on:change={updateDeloadWeeks} class="w-6 h-6 rounded bg-gray-900 border-gray-600 text-amber-500 focus:ring-amber-500">
                <div>
                    <span class="block font-bold text-white text-lg">Include Deload Phase?</span>
                    <span class="text-sm text-gray-400">Adds recovery weeks at the end of the mesocycle.</span>
                </div>
            </label>

            {#if deloadConfig.enabled}
                <div class="space-y-8 animate-fade-in">
                    
                    <div>
                        <label class="block text-xs font-bold text-gray-500 uppercase mb-3">Deload Duration</label>
                        <div class="flex gap-2">
                            <button 
                                on:click={() => { deloadConfig.duration = 1; updateDeloadWeeks(); }}
                                class="flex-1 py-3 rounded-lg border transition-all {deloadConfig.duration === 1 ? 'bg-amber-600/20 border-amber-500 text-amber-400 font-bold' : 'bg-gray-900 border-gray-700 text-gray-400'}"
                            >
                                1 Week
                            </button>
                            <button 
                                on:click={() => { deloadConfig.duration = 2; updateDeloadWeeks(); }}
                                class="flex-1 py-3 rounded-lg border transition-all {deloadConfig.duration === 2 ? 'bg-amber-600/20 border-amber-500 text-amber-400 font-bold' : 'bg-gray-900 border-gray-700 text-gray-400'}"
                            >
                                2 Weeks
                            </button>
                        </div>
                    </div>

                    <div class="space-y-6">
                        {#each deloadConfig.weeks as weekConfig, wIndex}
                            <div class="bg-gray-900/30 border border-gray-700 rounded-xl overflow-hidden">
                                <div class="bg-gray-800/50 px-4 py-2 border-b border-gray-700 font-bold text-amber-500 text-sm uppercase tracking-wide">
                                    Week {wIndex + 1} Settings
                                </div>
                                <div class="p-4 space-y-4">
                                    {#each weekConfig as daySettings}
                                        <div class="bg-gray-800 p-4 rounded-lg border border-gray-700">
                                            <div class="flex justify-between items-center mb-3">
                                                <span class="font-bold text-white">{daySettings.workoutName}</span>
                                                <span class="text-xs text-gray-500 font-mono">Day {daySettings.dayIndex}</span>
                                            </div>
                                            
                                            <div class="space-y-3">
                                                <div class="flex justify-between items-center">
                                                    <label class="text-xs text-gray-400 font-bold uppercase tracking-wider">Sets Reduction</label>
                                                    <div class="relative w-24">
                                                        <input 
                                                            type="number" 
                                                            bind:value={daySettings.reduceSets} 
                                                            class="w-full bg-gray-900 border border-gray-600 rounded p-2 pr-6 text-sm text-center focus:border-amber-500 outline-none"
                                                        />
                                                        <Percent size={12} class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500" />
                                                    </div>
                                                </div>
                                                <div class="flex justify-between items-center">
                                                    <label class="text-xs text-gray-400 font-bold uppercase tracking-wider">Weight Reduction</label>
                                                    <div class="relative w-24">
                                                        <input 
                                                            type="number" 
                                                            bind:value={daySettings.reduceWeight} 
                                                            class="w-full bg-gray-900 border border-gray-600 rounded p-2 pr-6 text-sm text-center focus:border-amber-500 outline-none"
                                                        />
                                                        <Percent size={12} class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500" />
                                                    </div>
                                                </div>
                                                <div class="flex justify-between items-center">
                                                    <label class="text-xs text-gray-400 font-bold uppercase tracking-wider">Reps Reduction</label>
                                                    <div class="relative w-24">
                                                        <input 
                                                            type="number" 
                                                            bind:value={daySettings.reduceReps} 
                                                            class="w-full bg-gray-900 border border-gray-600 rounded p-2 pr-6 text-sm text-center focus:border-amber-500 outline-none"
                                                        />
                                                        <Percent size={12} class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500" />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    {/each}
                                </div>
                            </div>
                        {/each}
                    </div>

                </div>
            {/if}
        </div>

        <div class="flex gap-4 mt-8">
            <button on:click={() => step = 4} class="px-6 py-4 rounded-xl bg-gray-800 text-gray-400">Back</button>
            <button on:click={generateMesocycle} disabled={loading} class="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold py-4 rounded-xl flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                {#if loading} Creating Plan... {:else} Finish & Generate <CheckCircle size={20} /> {/if}
            </button>
        </div>
    </div>
  {/if}

  {#if showCustomExerciseModal}
    <div class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 custom-exercise-modal">
        <div class="bg-gray-800 rounded-2xl shadow-2xl max-w-sm w-full border border-gray-700 p-6 animate-fade-in-down">
            <div class="flex justify-between items-center mb-6">
                <h3 class="text-xl font-bold text-white">New Custom Exercise</h3>
                <button on:click={() => showCustomExerciseModal = false} class="text-gray-500 hover:text-white"><X size={20} /></button>
            </div>

            <div class="mb-4">
                <label class="block text-xs font-bold text-gray-500 uppercase mb-2">Exercise Name</label>
                <input type="text" bind:value={customExerciseName} class="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-white focus:border-blue-500 outline-none" />
            </div>

            <div class="mb-6">
                <label class="block text-xs font-bold text-gray-500 uppercase mb-2">Target Muscle</label>
                <div class="grid grid-cols-2 gap-2">
                    {#each MUSCLE_GROUPS as m}
                        <button 
                            on:click={() => customExerciseMuscle = m}
                            class="text-xs py-2 px-1 rounded-lg border text-center transition-all
                            {customExerciseMuscle === m 
                                ? 'bg-blue-600 border-blue-500 text-white font-bold' 
                                : 'bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-500'}"
                        >
                            {m}
                        </button>
                    {/each}
                </div>
            </div>

            <button on:click={saveCustomExercise} class="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-xl shadow-lg">
                Save & Select Exercise
            </button>
        </div>
    </div>
  {/if}

</div>