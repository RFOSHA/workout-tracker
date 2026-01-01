<script lang="ts">
  import { page } from "$app/stores";
  import { supabase } from "$lib/supabaseClient";
  import { goto } from "$app/navigation";
  import { onMount, onDestroy } from "svelte"; 
  import { CheckCircle, Zap, Trash2, CornerDownRight, CirclePlus, MoreVertical, History, X, TrendingUp, Search, Plus } from "lucide-svelte"; 

  // FIX: Handle undefined ID gracefully
  const workoutId = $page.params.id;

  // --- STATE ---
  let workout: any = null;
  let exercises: any[] = [];
  let loading = true;
  let saving = false;
  let showFinishModal = false;
  
  // Library State (For Add Exercise Modal)
  let exerciseLibrary: any[] = [];
  let newExerciseSearch = ""; // Search input text
  
  // History Modal
  let showHistoryModal = false;
  let historyData: any[] = [];
  let historyLoading = false;
  let historyExerciseName = "";
  
  // Modals
  let showAddExerciseModal = false;
  let newExerciseTarget = 3; 
  let showDeleteExerciseModal = false;
  let exerciseToDeleteIndex: number | null = null;

  // Custom Exercise Creation State
  let showCustomExerciseModal = false;
  let customExerciseName = "";
  let customExerciseMuscle = "";

  const MUSCLE_GROUPS = [
    'Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 
    'Quads', 'Hamstrings', 'Calves', 'Abs', 'Forearms', 'Glutes'
  ];

  // Menus
  let activeMenu: { exIndex: number, setIndex: number } | null = null;

  // --- REACTIVE: Filtered List for Add Modal ---
  // Filters the library based on what user types in "Add Exercise" modal
  $: filteredLibrary = newExerciseSearch.trim().length > 0 
      ? exerciseLibrary.filter(ex => ex.name.toLowerCase().includes(newExerciseSearch.toLowerCase())).slice(0, 10)
      : [];

  onMount(async () => {
    if (!workoutId) { goto('/'); return; }
    await Promise.all([loadWorkoutData(), fetchLibrary()]);
    if (typeof window !== 'undefined') window.addEventListener('click', handleWindowClick);
  });

  onDestroy(() => {
    if (typeof window !== 'undefined') window.removeEventListener('click', handleWindowClick);
  });

  function handleWindowClick() {
    activeMenu = null;
  }

  // --- 0. FETCH LIBRARY ---
  async function fetchLibrary() {
    const { data } = await supabase.from('exercise_library').select('name, muscle_group').order('name');
    if (data) exerciseLibrary = data;
  }

  // --- 1. LOAD DATA & SEED SUGGESTIONS ---
  async function loadWorkoutData() {
    const { data: wData } = await supabase.from('workouts').select('*').eq('id', workoutId).single();
    if (!wData) { loading = false; return; }
    workout = wData;

    if (!workout.started_at) {
      await supabase.from('workouts').update({ started_at: new Date().toISOString() }).eq('id', workoutId);
    }

    const { data: exData } = await supabase.from('workout_exercises').select('*').eq('workout_id', workoutId).order('id', { ascending: true });

    if (exData) {
        const exerciseNames = exData.map((e: any) => e.exercise_name || "");
        const historyMap = await getPreviousWorkouts(exerciseNames, workoutId);

        exercises = exData.map(ex => {
            let currentResults = ex.set_results ? [...ex.set_results] : []; 
            const targetCount = ex.target_sets || 0;

            while (currentResults.length < targetCount) {
                currentResults.push({ weight: null, reps: null, dropsets: [] });
            }

            const prevStats = historyMap[ex.exercise_name];
            
            currentResults = currentResults.map((item, idx) => {
                if (!item || typeof item !== 'object') item = { weight: null, reps: null, dropsets: [] };
                if (!item.dropsets) item.dropsets = [];

                if (prevStats && prevStats[idx]) {
                    const prevSet = prevStats[idx];
                    // FIX: Ensure week_number is a Number
                    console.log(workout)
                    const suggestion = calculateNextStep(prevSet.weight, prevSet.reps, Number(workout.week_number));
                    
                    item.suggestedWeight = suggestion.weight;
                    item.suggestedReps = suggestion.reps;
                    console.log(item)
                    
                    if (item.target_weight) item.suggestedWeight = item.target_weight;
                    if (item.target_reps) item.suggestedReps = item.target_reps;
                    
                    // Only mark as suggestion if we actually have values
                    if (item.suggestedWeight !== null || item.suggestedReps !== null) {
                        item._hasSuggestion = true;
                    }
                }
                return item;
            });

            return { ...ex, set_results: currentResults };
        });
    }

    loading = false;
  }

  async function getPreviousWorkouts(names: string[], currentId: string) {
    if (names.length === 0) return {};

    const { data } = await supabase
        .from('workout_exercises')
        .select(`exercise_name, set_results, workouts!inner ( completed_at )`)
        .in('exercise_name', names)
        .neq('workout_id', currentId)
        .not('workouts.completed_at', 'is', null)
        .order('id', { ascending: false });

    if (!data) return {};

    const historyMap: Record<string, any[]> = {};
    data.forEach((row: any) => {
        if (!historyMap[row.exercise_name]) {
            historyMap[row.exercise_name] = row.set_results;
        }
    });
    return historyMap;
  }

  // --- UPDATED MATH LOGIC ---
  function calculateNextStep(prevWeight: number | null, prevReps: number | null, currentWeek: number) {
    // RULE: If Week 1, do NOT provide suggestions.
    console.log(prevWeight, prevReps, currentWeek)
    if (!currentWeek || currentWeek <= 1) {
        return { weight: null, reps: null };
    }

    let newWeight = prevWeight;
    let newReps = prevReps;

    if (newReps !== null && newReps > 0 && currentWeek > 1) newReps = newReps + 1;

    if (newWeight !== null && newWeight > 0 && currentWeek > 1) {
        let increase = 0;
        let rounding = 5;

        if (newWeight > 100) {
            increase = newWeight * 0.025;
            rounding = 5;
        } else if (newWeight >= 50) {
            increase = newWeight * 0.05;
            rounding = 5;
        } else {
            increase = newWeight * 0.10;
            rounding = 2.5;
        }
        newWeight = Math.round((newWeight + increase) / rounding) * rounding;
    }
    console.log(newWeight, newReps)
    return { weight: newWeight, reps: newReps };
  }

  async function saveSetData(exerciseIndex: number) {
    const ex = exercises[exerciseIndex];
    saving = true;
    
    const cleanResults = ex.set_results.map((s: any) => {
        const hitWeight = (s.weight !== null && s.suggestedWeight !== undefined && s.suggestedWeight !== null) ? (s.weight >= s.suggestedWeight) : false;
        const hitReps = (s.reps !== null && s.suggestedReps !== undefined && s.suggestedReps !== null) ? (s.reps >= s.suggestedReps) : false;

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

    const { error } = await supabase.from('workout_exercises').update({ set_results: cleanResults }).eq('id', ex.id);
    if (error) console.error("Auto-save failed:", error);
    saving = false;
  }

  // --- ACTIONS (Unchanged) ---
  function toggleMenu(event: MouseEvent, exIndex: number, setIndex: number) {
    event.stopPropagation();
    if (activeMenu?.exIndex === exIndex && activeMenu?.setIndex === setIndex) { activeMenu = null; } 
    else { activeMenu = { exIndex, setIndex }; }
  }
  function addDropset(exIndex: number, setIndex: number) {
    exercises[exIndex].set_results[setIndex].dropsets.push({ weight: null, reps: null });
    exercises = exercises; activeMenu = null; 
  }
  function removeDropset(exIndex: number, setIndex: number, dropIndex: number) {
    exercises[exIndex].set_results[setIndex].dropsets.splice(dropIndex, 1);
    exercises = exercises; saveSetData(exIndex);
  }
  function addExtraSet(exIndex: number) {
    exercises[exIndex].set_results.push({ weight: null, reps: null, dropsets: [] });
    exercises = exercises; saveSetData(exIndex);
  }
  function removeSet(exIndex: number, setIndex: number) {
    exercises[exIndex].set_results.splice(setIndex, 1);
    exercises = exercises; saveSetData(exIndex); activeMenu = null; 
  }
  function triggerFinish() { showFinishModal = true; }
  async function confirmFinish() {
    const now = new Date().toISOString();
    const { error } = await supabase.from('workouts').update({ completed: true, completed_at: now }).eq('id', workoutId);
    if (error) { alert(error.message); } else { goto('/'); }
  }
  function promptDeleteExercise(index: number) { exerciseToDeleteIndex = index; showDeleteExerciseModal = true; }
  async function executeDeleteExercise() {
    if (exerciseToDeleteIndex === null) return;
    const ex = exercises[exerciseToDeleteIndex];
    const previousIndex = exerciseToDeleteIndex; showDeleteExerciseModal = false; exerciseToDeleteIndex = null;
    const optimisticList = [...exercises]; optimisticList.splice(previousIndex, 1); exercises = optimisticList;
    const { error } = await supabase.from('workout_exercises').delete().eq('id', ex.id);
    if (error) { alert("Error deleting exercise: " + error.message); loadWorkoutData(); }
  }
  
  async function loadHistory(exerciseName: string) {
    historyExerciseName = exerciseName; showHistoryModal = true; historyLoading = true; historyData = [];
    const { data, error } = await supabase.from('workout_exercises').select(`set_results, workouts ( completed_at, name, week_number, scheduled_date, mesocycles ( name ) )`).eq('exercise_name', exerciseName).neq('workout_id', workoutId);
    if (error) { console.error(error); historyLoading = false; return; }
    const validData = data.filter((item: any) => item.workouts && item.workouts.completed_at);
    let processed = validData.map((entry: any) => ({ 
        date: new Date(entry.workouts.completed_at).toLocaleDateString(), 
        timestamp: new Date(entry.workouts.completed_at).getTime(), 
        workoutName: entry.workouts.name, 
        week: entry.workouts.week_number,
        scheduled: new Date(entry.workouts.scheduled_date).toLocaleDateString(),
        mesoName: entry.workouts.mesocycles?.name || 'Unknown Cycle',
        sets: entry.set_results || [] 
    }));
    processed.sort((a: any, b: any) => b.timestamp - a.timestamp);
    historyData = processed; historyLoading = false;
  }

  // --- NEW: ADD & CUSTOM EXERCISE LOGIC ---
  function openAddExerciseModal() { newExerciseSearch = ""; newExerciseTarget = 3; showAddExerciseModal = true; }
  
  function selectExerciseFromLibrary(exName: string) {
    newExerciseSearch = exName;
  }

  function triggerCustomExercise() {
    customExerciseName = newExerciseSearch;
    customExerciseMuscle = "";
    showAddExerciseModal = false; // Hide add modal
    showCustomExerciseModal = true; // Show create modal
  }

  async function saveCustomExercise() {
    if (!customExerciseName || !customExerciseMuscle) return;
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Save to DB
        const { error } = await supabase.from('exercise_library').insert({
            name: customExerciseName,
            muscle_group: customExerciseMuscle,
            user_id: user.id
        });
        if (error) throw error;

        // Add to local library & select it
        const newEx = { name: customExerciseName, muscle_group: customExerciseMuscle };
        exerciseLibrary = [...exerciseLibrary, newEx].sort((a,b) => a.name.localeCompare(b.name));
        newExerciseSearch = customExerciseName;
        
        showCustomExerciseModal = false;
        showAddExerciseModal = true; // Re-open add modal with name filled
    } catch (err: any) {
        alert("Error saving exercise: " + err.message);
    }
  }

  async function confirmAddExercise() {
    if (!newExerciseSearch.trim()) return; 
    showAddExerciseModal = false; 
    loading = true;
    const initialSets = Array.from({ length: newExerciseTarget }, () => ({ weight: null, reps: null, dropsets: [] }));
    const { data, error } = await supabase.from('workout_exercises').insert({ workout_id: workoutId, exercise_name: newExerciseSearch, target_sets: newExerciseTarget, set_results: initialSets }).select().single();
    if (error) { alert("Error adding exercise: " + error.message); loading = false; return; }
    exercises = [...exercises, { ...data, set_results: initialSets }];
    loading = false;
    setTimeout(() => { window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }); }, 100);
  }
</script>

<div class="min-h-screen bg-gray-900 text-white pb-32">
  
  {#if loading}
    <div class="p-8 text-center text-gray-500">Loading workout...</div>
  {:else if workout}
    
    <div class="bg-gray-800 p-6 border-b border-gray-700 sticky top-0 z-40 shadow-md">
      <div class="flex justify-between items-center max-w-3xl mx-auto">
        <div>
          <h1 class="text-2xl font-bold text-white">{workout.name}</h1>
          <p class="text-gray-400 text-sm">Week {workout.week_number} • Day {workout.day_number}</p>
          <p class="text-gray-400 text-sm">Scheduled: {workout.scheduled_date}</p>
        </div>
        {#if saving}
          <span class="text-xs text-green-400 font-mono animate-pulse">Saving...</span>
        {/if}
      </div>
    </div>

    <div class="max-w-3xl mx-auto p-4 space-y-6">
      {#each exercises as exercise, exIndex}
        <div class="bg-gray-800 rounded-lg border border-gray-700">
          
          <div class="bg-gray-700/50 p-4 border-b border-gray-700 flex justify-between items-center rounded-t-lg">
            <div>
                <h3 class="font-bold text-lg">{exercise.exercise_name}</h3>
                <div class="flex items-center gap-2 mt-1">
                    <span class="text-xs bg-blue-900 text-blue-200 px-2 py-0.5 rounded">
                    Target: {exercise.target_sets} Sets
                    </span>
                    {#if exercise.set_results[0]?._hasSuggestion}
                        <span class="text-[10px] text-gray-400 flex items-center gap-1">
                            <TrendingUp size={12} class="text-gray-500"/> Progression Loaded
                        </span>
                    {/if}
                </div>
            </div>

            <div class="flex gap-2">
                <button on:click={() => loadHistory(exercise.exercise_name)} class="text-gray-400 hover:text-white" title="History"><History size={20} /></button>
                <button on:click={() => promptDeleteExercise(exIndex)} class="text-gray-400 hover:text-red-500" title="Remove"><Trash2 size={20} /></button>
            </div>
          </div>

          <div class="p-4">
            <div class="grid grid-cols-[30px_1fr_1fr_30px] gap-4 mb-2 text-xs text-gray-500 font-bold text-center uppercase tracking-wider">
              <span>Set</span> <span>Lbs</span> <span>Reps</span> <span></span> 
            </div>

            <div class="space-y-4"> 
              {#each exercise.set_results as set, setIndex}
                
                <div class="grid grid-cols-[30px_1fr_1fr_30px] gap-4 items-center relative {activeMenu?.exIndex === exIndex && activeMenu?.setIndex === setIndex ? 'z-50' : 'z-10'}">
                  <div class="text-center font-bold text-gray-500 bg-gray-900 rounded-full w-8 h-8 flex items-center justify-center text-sm">
                    {setIndex + 1}
                  </div>
                  
                  <input
                    type="number"
                    placeholder={set.suggestedWeight || "-"}
                    bind:value={exercises[exIndex].set_results[setIndex].weight}
                    on:blur={() => saveSetData(exIndex)}
                    class="w-full bg-gray-900 border rounded p-3 text-center text-white text-lg outline-none placeholder-gray-600 transition-all duration-300
                    {set.weight !== null && set.suggestedWeight && set.weight >= set.suggestedWeight 
                        ? 'border-green-500 shadow-[0_0_10px_rgba(34,197,94,0.3)]' 
                        : 'border-gray-600 focus:ring-2 focus:ring-blue-500'}"
                  />
                  
                  <input
                    type="number"
                    placeholder={set.suggestedReps || "-"}
                    bind:value={exercises[exIndex].set_results[setIndex].reps}
                    on:blur={() => saveSetData(exIndex)}
                    class="w-full bg-gray-900 border rounded p-3 text-center text-white text-lg outline-none font-bold placeholder-gray-600 transition-all duration-300
                    {set.reps !== null && set.suggestedReps && set.reps >= set.suggestedReps 
                        ? 'border-green-500 shadow-[0_0_10px_rgba(34,197,94,0.3)]' 
                        : 'border-gray-600 focus:ring-2 focus:ring-green-500'}"
                  />

                  <div class="relative flex justify-center">
                    <button on:click={(e) => toggleMenu(e, exIndex, setIndex)} class="text-gray-500 hover:text-white p-2 rounded-full hover:bg-gray-700 transition-colors">
                      <MoreVertical size={20} />
                    </button>
                    {#if activeMenu?.exIndex === exIndex && activeMenu?.setIndex === setIndex}
                      <div class="absolute right-0 top-10 w-48 bg-gray-800 border border-gray-600 rounded-lg shadow-xl z-50 overflow-hidden">
                        <button on:click={() => addDropset(exIndex, setIndex)} class="w-full text-left px-4 py-3 text-sm text-gray-200 hover:bg-gray-700 flex items-center gap-3 border-b border-gray-700">
                          <Zap size={16} class="text-yellow-400" /> Add Dropset
                        </button>
                        <button on:click={() => removeSet(exIndex, setIndex)} class="w-full text-left px-4 py-3 text-sm text-red-400 hover:bg-gray-700 flex items-center gap-3">
                          <Trash2 size={16} /> Delete Set
                        </button>
                      </div>
                    {/if}
                  </div>
                </div>

                {#if set.dropsets && set.dropsets.length > 0}
                  <div class="space-y-2 mt-2"> 
                    {#each set.dropsets as drop, dropIndex}
                      <div class="grid grid-cols-[30px_1fr_1fr_30px] gap-4 items-center">
                        <div class="flex justify-end text-gray-600 pr-1"><CornerDownRight size={16} /></div>
                        <input type="number" placeholder="Drop Lbs" bind:value={exercises[exIndex].set_results[setIndex].dropsets[dropIndex].weight} on:blur={() => saveSetData(exIndex)} class="w-full bg-gray-800 border border-gray-600 border-dashed rounded p-2 text-center text-gray-300 text-sm outline-none" />
                        <input type="number" placeholder="Drop Reps" bind:value={exercises[exIndex].set_results[setIndex].dropsets[dropIndex].reps} on:blur={() => saveSetData(exIndex)} class="w-full bg-gray-800 border border-gray-600 border-dashed rounded p-2 text-center text-gray-300 text-sm outline-none" />
                        <div class="flex justify-center"><button on:click={() => removeDropset(exIndex, setIndex, dropIndex)} class="text-gray-600 hover:text-red-500"><Trash2 size={16} /></button></div>
                      </div>
                    {/each}
                  </div>
                {/if}

              {/each}
            </div>

            <div class="mt-4 pt-4 border-t border-gray-700/50 flex justify-center">
              <button on:click={() => addExtraSet(exIndex)} class="flex items-center gap-2 text-xs font-bold text-blue-400 hover:text-blue-300 uppercase tracking-widest">
                <CirclePlus size={16} /> Add Extra Set
              </button>
            </div>

          </div>
        </div>
      {/each}
      <button on:click={openAddExerciseModal} class="w-full py-4 border-2 border-dashed border-gray-700 text-gray-400 rounded-xl hover:border-blue-500 hover:text-blue-400 hover:bg-gray-800/50 transition-all flex flex-col items-center justify-center gap-2 group">
        <div class="bg-gray-800 p-3 rounded-full group-hover:bg-blue-900/30 transition-colors"><CirclePlus size={24} /></div>
        <span class="font-bold text-sm uppercase tracking-widest">Add Exercise</span>
      </button>
    </div>

    <div class="mt-8 mb-12 p-4 flex justify-center">
      <button on:click={triggerFinish} class="bg-green-600 hover:bg-green-500 text-white font-bold py-4 px-12 rounded-full shadow-xl text-lg transform transition hover:scale-105 w-full max-w-md">
        Finish Workout
      </button>
    </div>

  {/if}

  {#if showFinishModal} <div class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"> <div class="bg-gray-800 rounded-2xl shadow-2xl max-w-sm w-full border border-gray-700 p-6 text-center"> <div class="mx-auto bg-green-900/30 w-16 h-16 rounded-full flex items-center justify-center mb-4"><CheckCircle class="text-green-500" size={32} /></div> <h3 class="text-xl font-bold text-white mb-2">Workout Complete?</h3> <div class="flex gap-3 mt-8"> <button on:click={() => showFinishModal = false} class="flex-1 py-3 px-4 bg-gray-700 hover:bg-gray-600 text-white rounded-xl">Cancel</button> <button on:click={confirmFinish} class="flex-1 py-3 px-4 bg-green-600 hover:bg-green-500 text-white rounded-xl font-bold">Yes, Finish</button> </div> </div> </div> {/if}
  
  {#if showHistoryModal} 
    <div class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" on:click={() => showHistoryModal = false}> 
        <div class="bg-gray-800 rounded-2xl p-6 max-w-md w-full max-h-[80vh] overflow-y-auto" on:click|stopPropagation> 
            <div class="flex justify-between mb-4"><h3 class="text-xl font-bold">{historyExerciseName}</h3><button on:click={() => showHistoryModal = false}><X /></button></div> 
            {#if historyLoading} Loading... {:else} 
                {#each historyData as sess} 
                    <div class="bg-gray-900 p-3 rounded mb-2 border border-gray-800"> 
                        <div class="flex justify-between text-sm text-blue-400 mb-1 font-bold"><span>{sess.date}</span><span>{sess.workoutName}</span></div> 
                        
                        <div class="flex flex-wrap gap-2 text-[10px] text-gray-500 mb-2 uppercase tracking-wide">
                            <span class="bg-gray-800 px-1.5 py-0.5 rounded text-gray-400">{sess.mesoName}</span>
                            <span>•</span>
                            <span>Week {sess.week}</span>
                            <span>•</span>
                            <span>Sched: {sess.scheduled}</span>
                        </div>

                        {#each sess.sets as s, i} 
                            <div class="text-sm flex gap-4 border-t border-gray-800/50 py-1">
                                <span class="w-4 text-gray-600 font-mono text-xs mt-0.5">{i+1}</span> 
                                <span class="text-white font-medium">{s.weight || 0} lbs</span> 
                                <span class="text-green-400 font-bold">{s.reps || 0} reps</span>
                            </div> 
                        {/each} 
                    </div> 
                {/each} 
            {/if} 
        </div> 
    </div> 
  {/if}

  {#if showAddExerciseModal} 
    <div class="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"> 
        <div class="bg-gray-800 p-6 rounded-2xl w-full max-w-sm flex flex-col max-h-[80vh]"> 
            <h3 class="text-xl font-bold mb-4">Add Exercise</h3> 
            
            <div class="relative mb-4">
                <Search size={16} class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input 
                    type="text" 
                    bind:value={newExerciseSearch} 
                    placeholder="Search Library..." 
                    class="w-full bg-gray-900 border border-gray-700 p-3 pl-10 rounded-lg text-white focus:border-blue-500 outline-none" 
                    autofocus
                />
            </div>

            {#if filteredLibrary.length > 0}
                <div class="flex-1 overflow-y-auto mb-4 space-y-1 border border-gray-800 rounded-lg p-1 bg-gray-900/50 min-h-0">
                    {#each filteredLibrary as item}
                        <button 
                            on:click={() => selectExerciseFromLibrary(item.name)}
                            class="w-full text-left p-3 rounded-md hover:bg-gray-700/50 flex justify-between items-center transition-colors group"
                        >
                            <span class="text-sm text-gray-200 group-hover:text-white font-medium">{item.name}</span>
                            <span class="text-[10px] uppercase font-bold tracking-wider text-gray-500 bg-gray-800 border border-gray-700 px-2 py-0.5 rounded-full group-hover:border-gray-500 group-hover:text-gray-400">
                                {item.muscle_group}
                            </span>
                        </button>
                    {/each}
                </div>
            {:else if newExerciseSearch.trim().length > 0}
                <div class="text-center py-4 text-sm text-gray-500 italic mb-4">
                    No matches found. 
                    <button on:click={triggerCustomExercise} class="text-blue-400 hover:underline">Create Custom Exercise?</button>
                </div>
            {/if}

            <div class="flex gap-3 mt-auto pt-2 border-t border-gray-700">
                <button on:click={() => showAddExerciseModal = false} class="flex-1 bg-gray-700 hover:bg-gray-600 py-3 rounded-lg font-medium transition-colors">Cancel</button>
                <button on:click={confirmAddExercise} class="flex-1 bg-blue-600 hover:bg-blue-500 py-3 rounded-lg font-bold shadow-lg transition-transform active:scale-95">Add</button>
            </div> 
        </div> 
    </div> 
  {/if}

  {#if showCustomExerciseModal}
    <div class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 custom-exercise-modal">
        <div class="bg-gray-800 rounded-2xl shadow-2xl max-w-sm w-full border border-gray-700 p-6 animate-fade-in-down">
            <div class="flex justify-between items-center mb-6">
                <h3 class="text-xl font-bold text-white">New Custom Exercise</h3>
                <button on:click={() => { showCustomExerciseModal = false; showAddExerciseModal = true; }} class="text-gray-500 hover:text-white"><X size={20} /></button>
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

  {#if showDeleteExerciseModal} <div class="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"> <div class="bg-gray-800 p-6 rounded-2xl w-full max-w-sm text-center"> <h3 class="text-xl font-bold mb-4">Delete Exercise?</h3> <div class="flex gap-3"><button on:click={() => showDeleteExerciseModal = false} class="flex-1 bg-gray-700 py-3 rounded">Cancel</button><button on:click={executeDeleteExercise} class="flex-1 bg-red-600 py-3 rounded">Delete</button></div> </div> </div> {/if}
</div>

<style>
  input[type=number]::-webkit-outer-spin-button,
  input[type=number]::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  input[type=number] {
    -moz-appearance: textfield;
  }
</style>