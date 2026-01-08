<script lang="ts">
  import { onMount } from "svelte";
  import { supabase } from "$lib/supabaseClient";
  import { 
    CheckCircle, Circle, PlayCircle, Calendar, History, ChevronRight, X, 
    Trash2, BarChart2, TrendingUp, Dumbbell, Layers, Filter,
    Pencil, Search, Plus, Zap 
  } from "lucide-svelte";

  // --- STATE ---
  let loading = true;
  let mesocycle: any = null;
  let calendar: any[][] = [];

  // History State
  let allMesocycles: any[] = [];
  let showHistoryModal = false;

  // --- RECAP STATE ---
  let showRecapModal = false;
  let recapLoading = false;
  let recapData: any = null;
  let selectedRecapMuscle = "All";

  // --- PLAN EDITOR STATE (The "Wizard") ---
  let showEditPlanModal = false;
  let planTemplates: Record<string, any[]> = {}; // Map of "Push" -> [Exercises]
  let activeSearch: { type: string, index: number } | null = null;
  let fullLibrary: any[] = [];
  let savingPlan = false;

  // Reactive Chart Data Helper
  $: weeklyChartData = getWeeklyChartData(recapData, selectedRecapMuscle);

  function getWeeklyChartData(data: any, filter: string) {
    if (!data || !data.weeklyBreakdown || data.weeklyBreakdown.length === 0) return { bars: [], max: 10 };
    const bars = data.weeklyBreakdown.map((w: any) => {
        let count = 0;
        if (filter === "All") {
            count = w.total;
        } else {
            count = w.muscles[filter] || 0;
        }
        return { week: w.week, count };
    });
    const max = Math.max(...bars.map((b: any) => b.count)) || 10;
    return { bars, max };
  }

  onMount(async () => {
    await initData();
    window.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (target.tagName !== 'INPUT') {
            activeSearch = null;
        }
    });
  });

  async function initData() {
    const { data: mesos } = await supabase
      .from('mesocycles')
      .select('*')
      .order('start_date', { ascending: false });

    if (!mesos || mesos.length === 0) {
      loading = false;
      return;
    }

    allMesocycles = mesos;
    await loadMesocycle(mesos[0]);
  }

  async function loadMesocycle(selectedMeso: any) {
    loading = true;
    mesocycle = selectedMeso;
    showHistoryModal = false; 
    showRecapModal = false;
    recapData = null; 
    selectedRecapMuscle = "All";

    const { data: workouts } = await supabase
      .from('workouts')
      .select('*')
      .eq('mesocycle_id', selectedMeso.id)
      .order('week_number', { ascending: true })
      .order('day_number', { ascending: true });

    const grid = Array.from({ length: selectedMeso.duration_weeks }, () => 
      Array(selectedMeso.days_per_week).fill(null)
    );

    workouts?.forEach(w => {
      const wIndex = w.week_number - 1; 
      const dIndex = w.day_number - 1;
      if (grid[wIndex]) grid[wIndex][dIndex] = w;
    });

    calendar = grid;
    loading = false;
  }

  // --- PLAN EDITOR LOGIC ---
  async function openPlanEditor() {
    if (!mesocycle) return;
    showEditPlanModal = true;
    planTemplates = {};

    // 1. Get unique workout names
    const { data: workouts } = await supabase
        .from('workouts')
        .select('name, id, completed')
        .eq('mesocycle_id', mesocycle.id)
        .eq('completed', false) // Prefer fetching from future workouts
        .order('week_number', { ascending: true });

    if (!workouts) return;

    // Group by name (e.g. "Push", "Pull")
    const uniqueNames = [...new Set(workouts.map(w => w.name))];

    // 2. Fetch exercises for the *first occurrence* of each type to serve as the template
    for (const name of uniqueNames) {
        const exemplar = workouts.find(w => w.name === name);
        if (exemplar) {
            const { data: exercises } = await supabase
                .from('workout_exercises')
                .select('exercise_name, target_sets, set_results')
                .eq('workout_id', exemplar.id)
                .order('id');
            
            // Map to the format needed for the Wizard UI
            planTemplates[name] = exercises?.map(ex => ({
                name: ex.exercise_name,
                startSets: ex.target_sets,
                // Check if any set has dropsets to determine toggle state
                isDropset: ex.set_results?.some((s: any) => s.dropsets && s.dropsets.length > 0) || false
            })) || [];
        }
    }

    // 3. Lazy load library
    if (fullLibrary.length === 0) {
        const { data: lib } = await supabase.from('exercise_library').select('*').order('name');
        fullLibrary = lib || [];
    }
  }

  function addExerciseToTemplate(typeName: string) {
    planTemplates[typeName] = [
        ...planTemplates[typeName], 
        { name: "", startSets: 3, isDropset: false } 
    ];
  }

  function removeExerciseFromTemplate(typeName: string, index: number) {
    const updated = [...planTemplates[typeName]];
    updated.splice(index, 1);
    planTemplates[typeName] = updated;
  }

  function selectExercise(typeName: string, exIndex: number, name: string) {
    planTemplates[typeName][exIndex].name = name;
    activeSearch = null;
  }

  async function savePlanChanges() {
    if (!confirm("This will update all FUTURE incomplete workouts in this cycle. Continue?")) return;
    savingPlan = true;

    try {
        const { data: futureWorkouts } = await supabase
            .from('workouts')
            .select('id, name')
            .eq('mesocycle_id', mesocycle.id)
            .eq('completed', false);

        if (!futureWorkouts) throw new Error("No workouts found");

        // For each workout type in our template
        for (const [typeName, exercises] of Object.entries(planTemplates)) {
            // Find all future workouts of this type
            const targetIds = futureWorkouts.filter(w => w.name === typeName).map(w => w.id);
            
            if (targetIds.length > 0) {
                // 1. Wipe existing exercises for these workouts
                await supabase.from('workout_exercises').delete().in('workout_id', targetIds);

                // 2. Prepare new exercises
                const payloads: any[] = [];
                targetIds.forEach(wid => {
                    exercises.forEach(ex => {
                        const setResults = Array(ex.startSets).fill({ 
                            weight: null, 
                            reps: null, 
                            dropsets: ex.isDropset ? [{ weight: null, reps: null }] : [] 
                        });

                        payloads.push({
                            workout_id: wid,
                            exercise_name: ex.name,
                            target_sets: ex.startSets,
                            set_results: setResults
                        });
                    });
                });

                // 3. Bulk insert
                if (payloads.length > 0) {
                    const { error } = await supabase.from('workout_exercises').insert(payloads);
                    if (error) throw error;
                }
            }
        }

        showEditPlanModal = false;
        // Reload to reflect changes
        loadMesocycle(mesocycle);

    } catch (e: any) {
        alert("Error saving plan: " + e.message);
    } finally {
        savingPlan = false;
    }
  }

  // --- UTILS ---
  async function deleteMesocycle(id: string, event: Event) {
    event.stopPropagation();
    if (!confirm("Are you sure? This will permanently delete this plan and all its workout history.")) return;
    const { error } = await supabase.from('mesocycles').delete().eq('id', id);
    if (error) { alert("Error: " + error.message); return; }
    allMesocycles = allMesocycles.filter(m => m.id !== id);
    if (mesocycle && mesocycle.id === id) {
        if (allMesocycles.length > 0) loadMesocycle(allMesocycles[0]);
        else { mesocycle = null; calendar = []; showHistoryModal = false; }
    }
  }

  // RECAP LOGIC (Existing)
  async function loadRecap() {
    if (recapData) { showRecapModal = true; return; }
    recapLoading = true; showRecapModal = true;
    try {
        const { data: workoutIdsData } = await supabase.from('workouts').select('id, week_number').eq('mesocycle_id', mesocycle.id);
        if (!workoutIdsData || workoutIdsData.length === 0) { recapLoading = false; return; }
        const workoutIdMap = new Map(workoutIdsData.map(w => [w.id, w.week_number]));
        const ids = workoutIdsData.map(w => w.id);
        const { data: exercises } = await supabase.from('workout_exercises').select('exercise_name, set_results, workout_id').in('workout_id', ids);
        if (!exercises) { recapLoading = false; return; }
        const { data: library } = await supabase.from('exercise_library').select('name, muscle_group');
        const muscleMap = new Map(library?.map(l => [l.name, l.muscle_group]) || []);
        let totalVolume = 0;
        const muscleCounts: Record<string, number> = {};
        const weeklyDataMap: Record<number, { total: number, muscles: Record<string, number> }> = {};
        for(let i = 1; i <= mesocycle.duration_weeks; i++) weeklyDataMap[i] = { total: 0, muscles: {} };
        const exerciseHistory: Record<string, { week: number, bestSet: { weight: number, reps: number } }[]> = {};
        exercises.forEach(ex => {
            const weekNum = workoutIdMap.get(ex.workout_id) || 0;
            const muscle = muscleMap.get(ex.exercise_name) || 'Other';
            if (!weeklyDataMap[weekNum]) weeklyDataMap[weekNum] = { total: 0, muscles: {} };
            let validSets = 0; let maxWeightForSession = 0; let repsForMaxWeight = 0;
            if (Array.isArray(ex.set_results)) {
                ex.set_results.forEach((s: any) => {
                    const r = Number(s.reps); const w = Number(s.weight);
                    if (!isNaN(r) && r > 0) {
                        validSets++;
                        if (!isNaN(w) && w > 0) totalVolume += (w * r);
                        if (w > maxWeightForSession) { maxWeightForSession = w; repsForMaxWeight = r; } 
                        else if (w === maxWeightForSession && r > repsForMaxWeight) { repsForMaxWeight = r; }
                    }
                });
            }
            if (validSets > 0) {
                muscleCounts[muscle] = (muscleCounts[muscle] || 0) + validSets;
                weeklyDataMap[weekNum].total += validSets;
                weeklyDataMap[weekNum].muscles[muscle] = (weeklyDataMap[weekNum].muscles[muscle] || 0) + validSets;
                if (!exerciseHistory[ex.exercise_name]) exerciseHistory[ex.exercise_name] = [];
                exerciseHistory[ex.exercise_name].push({ week: weekNum, bestSet: { weight: maxWeightForSession, reps: repsForMaxWeight } });
            }
        });
        const progressStats = Object.keys(exerciseHistory).map(name => {
            const history = exerciseHistory[name].sort((a,b) => a.week - b.week);
            if (history.length < 2) return null;
            const start = history[0]; const end = history[history.length - 1];
            if (start.week === end.week) return null;
            return { name, start: start.bestSet, end: end.bestSet, deltaWeight: end.bestSet.weight - start.bestSet.weight, deltaReps: end.bestSet.reps - start.bestSet.reps };
        }).filter(Boolean);
        const sortedMuscles = Object.entries(muscleCounts).sort(([, a], [, b]) => b - a).map(([name, count]) => ({ name, count }));
        const weeklyBreakdown = Object.entries(weeklyDataMap).map(([week, data]) => ({ week: Number(week), ...data })).sort((a, b) => a.week - b.week);
        recapData = { totalVolume, muscleStats: sortedMuscles, weeklyBreakdown, progress: progressStats };
    } catch (e) { console.error(e); alert("Error generating recap"); } finally { recapLoading = false; }
  }

  function getDateForSlot(weekIndex: number, dayIndex: number) {
    if (!mesocycle) return "";
    const startDate = new Date(mesocycle.start_date);
    const daysToAdd = (weekIndex * mesocycle.days_per_week) + dayIndex;
    startDate.setDate(startDate.getDate() + daysToAdd);
    return startDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }
  function getWeekRange(weekIndex: number) {
    if (!mesocycle) return "";
    const startDate = new Date(mesocycle.start_date);
    const startOffset = weekIndex * mesocycle.days_per_week;
    startDate.setDate(startDate.getDate() + startOffset);
    const startStr = startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + (mesocycle.days_per_week - 1));
    const endStr = endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${startStr} - ${endStr}`;
  }
  function formatDate(dateStr: string) { return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }); }
  function formatNumber(num: number) { return new Intl.NumberFormat('en-US').format(num); }
</script>

<div class="min-h-screen bg-gray-900 text-white p-4 pb-32">
  
  {#if loading && !mesocycle}
    <div class="text-center text-gray-500 mt-10">Loading schedule...</div>
  {:else if !mesocycle}
    <div class="text-center mt-20">
      <h2 class="text-xl font-bold mb-4">No Active Mesocycle</h2>
      <a href="/mesocycle/new" class="bg-blue-600 px-6 py-2 rounded-full font-bold">Create Plan</a>
    </div>
  {:else}
    
    <div class="mb-8 border-b border-gray-800 pb-4 flex justify-between items-start">
      <div>
        <h1 class="text-2xl font-bold text-blue-400">{mesocycle.name}</h1>
        <div class="flex items-center gap-2 text-gray-400 text-sm mt-1">
          <Calendar size={14} />
          <span>{mesocycle.duration_weeks} Weeks</span>
          <span class="text-gray-600">•</span>
          <span class="text-xs uppercase tracking-wide bg-gray-800 px-2 py-0.5 rounded">
             {mesocycle === allMesocycles[0] ? 'Current' : 'Archived'}
          </span>
        </div>
      </div>

      <div class="flex gap-2">
          <button 
            on:click={openPlanEditor}
            class="bg-gray-800 p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
            title="Edit Plan"
          >
            <Pencil size={20} />
          </button>

          <button 
            on:click={loadRecap}
            class="bg-blue-900/30 border border-blue-500/30 p-2 rounded-lg text-blue-400 hover:bg-blue-900/50 transition-colors"
            title="View Recap"
          >
            <BarChart2 size={20} />
          </button>
          
          <button 
            on:click={() => showHistoryModal = true}
            class="bg-gray-800 p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
            title="View Past Cycles"
          >
            <History size={20} />
          </button>
      </div>
    </div>

    {#if loading}
         <div class="text-center text-gray-500 py-10">Loading workouts...</div>
    {:else}
        <div class="space-y-6 animate-fade-in">
        {#each calendar as week, wIndex}
            <div class="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
                <div class="flex justify-between items-end mb-3">
                    <h3 class="text-xs font-bold text-gray-500 uppercase tracking-widest">
                    Week {wIndex + 1}
                    </h3>
                    <span class="text-[10px] text-gray-600 font-mono bg-gray-900 px-2 py-1 rounded">
                        {getWeekRange(wIndex)}
                    </span>
                </div>

                <div class="grid grid-cols-1 gap-3">
                    {#each week as day, dIndex}
                        {@const dateString = getDateForSlot(wIndex, dIndex)}

                        {#if day}
                            <a 
                                href="/workout/{day.id}"
                                class="relative group block p-3 rounded-lg border transition-all
                                {day.completed 
                                    ? 'bg-green-900/10 border-green-900/30 text-gray-300' 
                                    : day.started_at 
                                    ? 'bg-amber-900/10 border-amber-600/30 text-white' 
                                    : 'bg-gray-800 border-gray-700 hover:border-gray-500'}"
                            >
                                <div class="flex items-center justify-between">
                                    <div class="flex items-center gap-4">
                                        <div class="shrink-0">
                                            {#if day.completed}
                                                <CheckCircle class="text-green-500" size={22} />
                                            {:else if day.started_at}
                                                <PlayCircle class="text-amber-500" size={22} />
                                            {:else}
                                                <Circle class="text-gray-600" size={22} />
                                            {/if}
                                        </div>

                                        <div>
                                            <span class="block font-bold text-sm text-white">{day.name}</span>
                                            <div class="flex gap-2 text-xs opacity-60 mt-0.5">
                                                <span class="text-blue-300">{dateString}</span>
                                                <span>•</span>
                                                <span>Day {day.day_number}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div class="text-xs font-bold opacity-60">
                                        {#if day.completed} Done
                                        {:else if day.started_at} Resume
                                        {:else} Start
                                        {/if}
                                    </div>
                                </div>
                            </a>
                        {:else}
                            <div class="p-3 rounded-lg border border-gray-800 border-dashed text-gray-600 flex items-center justify-between opacity-70">
                                <div class="flex items-center gap-4">
                                    <div class="w-[22px] flex justify-center">
                                        <div class="w-1.5 h-1.5 rounded-full bg-gray-700"></div>
                                    </div>
                                    <div>
                                        <span class="block text-sm font-medium italic">Rest Day</span>
                                        <span class="text-xs text-gray-700">{dateString}</span>
                                    </div>
                                </div>
                            </div>
                        {/if}
                    {/each}
                </div>
            </div>
        {/each}
        </div>
    {/if}

  {/if}

  {#if showEditPlanModal}
    <div class="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex justify-center items-center p-4" on:click={() => showEditPlanModal = false}>
        <div class="w-full max-w-3xl bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden" on:click|stopPropagation>
            <div class="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-800/50">
                <div>
                    <h2 class="text-2xl font-bold flex items-center gap-2 text-white">
                        <Pencil size={24} class="text-blue-400"/> Edit Plan
                    </h2>
                    <p class="text-sm text-gray-400 mt-1">Modifying templates will update all future workouts.</p>
                </div>
                <button on:click={() => showEditPlanModal = false} class="text-gray-500 hover:text-white"><X size={24} /></button>
            </div>

            <div class="flex-1 overflow-y-auto p-6 space-y-8">
                {#each Object.entries(planTemplates) as [typeName, exercises]}
                    <div class="bg-gray-800 border border-gray-700 rounded-xl overflow-visible relative">
                        <div class="bg-gray-700/50 p-3 border-b border-gray-700 flex justify-between items-center">
                            <h3 class="font-bold text-white text-sm">{typeName}</h3>
                            <div class="grid grid-cols-[50px_50px_20px_20px] gap-2 items-center text-center text-[10px] font-bold uppercase text-gray-400 tracking-wider">
                                <span>Sets</span>
                                <span>Drop</span>
                                <span></span><span></span>
                            </div>
                        </div>

                        <div class="p-3 space-y-2">
                            {#if exercises.length === 0}
                                <div class="text-center py-4 text-gray-500 text-sm italic">No exercises.</div>
                            {/if}

                            {#each exercises as ex, exIdx}
                                <div class="grid grid-cols-[1fr_50px_50px_20px_20px] gap-2 items-center">
                                    
                                    <div class="relative w-full">
                                        <input 
                                            type="text" 
                                            placeholder="Search..." 
                                            bind:value={ex.name}
                                            on:focus={() => activeSearch = { type: typeName, index: exIdx }}
                                            class="w-full bg-gray-900 border border-gray-600 rounded p-2 text-sm text-white focus:border-blue-500 outline-none placeholder-gray-600"
                                        />
                                        {#if activeSearch?.type === typeName && activeSearch?.index === exIdx}
                                            {@const results = ex.name.length > 0 
                                                    ? fullLibrary.filter(item => item.name.toLowerCase().includes(ex.name.toLowerCase())).slice(0, 6)
                                                    : fullLibrary.slice(0, 50)}
                                                <div class="absolute top-full left-0 min-w-[300px] bg-gray-800 border border-gray-600 rounded-lg mt-1 z-50 shadow-2xl overflow-y-auto max-h-60">

                                                
                                                {#each results as item}
                                                    <button 
                                                        on:mousedown={() => selectExercise(typeName, exIdx, item.name)}
                                                        class="w-full flex justify-between items-center p-3 hover:bg-gray-700 text-left"
                                                    >
                                                        <span class="text-sm text-gray-200">{item.name}</span>
                                                        <span class="text-[10px] uppercase text-gray-500 border border-gray-700 px-1.5 rounded">{item.muscle_group}</span>
                                                    </button>
                                                {/each}
                                            </div>
                                        {/if}
                                    </div>

                                    <input type="number" bind:value={ex.startSets} class="w-full bg-gray-900 border border-gray-600 rounded p-2 text-center text-sm text-white outline-none" />
                                    
                                    <div class="flex justify-center">
                                        <button on:click={() => ex.isDropset = !ex.isDropset} class="p-2 rounded transition-colors {ex.isDropset ? 'text-yellow-400 bg-yellow-400/10' : 'text-gray-600 hover:text-gray-400'}">
                                            <Zap size={16} fill={ex.isDropset ? "currentColor" : "none"} />
                                        </button>
                                    </div>

                                    <button on:click={() => removeExerciseFromTemplate(typeName, exIdx)} class="flex items-center justify-center text-gray-500 hover:text-red-500 transition-colors h-full">
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            {/each}
                            <button on:click={() => addExerciseToTemplate(typeName)} class="w-full py-2 border border-dashed border-gray-600 text-gray-400 rounded-lg text-sm hover:border-yellow-500 hover:text-yellow-400 transition-colors flex items-center justify-center gap-2 mt-2">
                                <Plus size={16} /> Add Exercise
                            </button>
                        </div>
                    </div>
                {/each}
            </div>

            <div class="p-6 border-t border-gray-800 bg-gray-800/50 flex gap-4">
                <button on:click={() => showEditPlanModal = false} class="px-6 py-3 rounded-xl bg-gray-700 hover:bg-gray-600 text-gray-200 font-medium">Cancel</button>
                <button on:click={savePlanChanges} disabled={savingPlan} class="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-xl shadow-lg disabled:opacity-50">
                    {savingPlan ? 'Updating Schedule...' : 'Save Changes'}
                </button>
            </div>
        </div>
    </div>
  {/if}

  {#if showHistoryModal}
    <div class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex justify-end" on:click={() => showHistoryModal = false}>
        <div class="w-full max-w-sm bg-gray-900 h-full border-l border-gray-800 p-6 flex flex-col shadow-2xl animate-slide-in-right" on:click|stopPropagation>
            <div class="flex justify-between items-center mb-8">
                <h2 class="text-xl font-bold flex items-center gap-2">
                    <History size={20} class="text-blue-400"/> Program History
                </h2>
                <button on:click={() => showHistoryModal = false} class="text-gray-500 hover:text-white">
                    <X size={24} />
                </button>
            </div>
            <div class="flex-1 overflow-y-auto space-y-3">
                {#each allMesocycles as m}
                    <div 
                        role="button"
                        tabindex="0"
                        on:click={() => loadMesocycle(m)}
                        on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && loadMesocycle(m)}
                        class="w-full text-left p-4 rounded-xl border transition-all group relative cursor-pointer outline-none focus:ring-2 focus:ring-blue-500
                        {mesocycle && mesocycle.id === m.id 
                            ? 'bg-blue-900/20 border-blue-500/50' 
                            : 'bg-gray-800 border-gray-700 hover:border-gray-500'}"
                    >
                        <div class="flex justify-between items-start">
                            <div>
                                <span class="block font-bold text-white mb-1 group-hover:text-blue-400 transition-colors">{m.name}</span>
                                <span class="text-xs text-gray-500 font-mono">
                                    {formatDate(m.start_date)} - {formatDate(m.end_date)}
                                </span>
                            </div>
                            <div class="flex items-center gap-2">
                                {#if mesocycle && mesocycle.id === m.id}
                                    <div class="bg-blue-500 w-2 h-2 rounded-full"></div>
                                {/if}
                                <button 
                                    on:click={(e) => deleteMesocycle(m.id, e)}
                                    class="text-gray-600 hover:text-red-500 p-1.5 rounded-md hover:bg-gray-700 transition-colors z-10"
                                    title="Delete Plan"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                        {#if mesocycle && mesocycle.id !== m.id}
                            <ChevronRight size={16} class="absolute right-12 top-1/2 -translate-y-1/2 text-gray-600 opacity-0 group-hover:opacity-100 transition-all" />
                        {/if}
                    </div>
                {/each}
                <a href="/mesocycle/new" class="block w-full text-center py-4 mt-8 border-2 border-dashed border-gray-700 rounded-xl text-gray-500 hover:text-white hover:border-gray-500 transition-all">
                    + Start New Cycle
                </a>
            </div>
        </div>
    </div>
  {/if}
  
  {#if showRecapModal}
    <div class="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex justify-center items-end sm:items-center" on:click={() => showRecapModal = false}>
        <div class="w-full sm:max-w-2xl bg-gray-900 sm:rounded-2xl border-t sm:border border-gray-800 p-6 flex flex-col shadow-2xl animate-fade-in-up max-h-[90vh] overflow-hidden" on:click|stopPropagation>
            <div class="flex justify-between items-center mb-6 shrink-0">
                <h2 class="text-2xl font-bold flex items-center gap-2 text-white">
                    <BarChart2 size={24} class="text-blue-400"/> Cycle Recap
                </h2>
                <button on:click={() => showRecapModal = false} class="bg-gray-800 p-1 rounded-full text-gray-500 hover:text-white">
                    <X size={24} />
                </button>
            </div>

            {#if recapLoading}
                <div class="flex-1 flex items-center justify-center p-12 text-gray-500">
                    Calculating stats...
                </div>
            {:else if recapData}
                <div class="flex-1 overflow-y-auto pr-2 space-y-8">
                    <div class="grid grid-cols-1 gap-4">
                        <div class="bg-gradient-to-br from-gray-800 to-gray-800/50 p-5 rounded-xl border border-gray-700">
                            <div class="flex items-center gap-3 mb-2">
                                <div class="bg-blue-900/50 p-2 rounded-lg text-blue-400"><Layers size={20}/></div>
                                <span class="text-sm text-gray-400 uppercase tracking-widest font-bold">Total Volume</span>
                            </div>
                            <div class="text-4xl font-black text-white tracking-tight">
                                {formatNumber(recapData.totalVolume)} <span class="text-lg text-gray-500 font-medium">lbs</span>
                            </div>
                        </div>
                    </div>
                     <div>
                        <div class="flex justify-between items-end mb-4">
                            <h3 class="text-lg font-bold text-white flex items-center gap-2">
                                <Calendar size={18} class="text-blue-400"/> Weekly Sets
                            </h3>
                            <div class="relative">
                                <select 
                                    bind:value={selectedRecapMuscle}
                                    class="appearance-none bg-gray-800 text-xs text-white border border-gray-600 rounded px-3 py-1 pr-8 focus:outline-none focus:border-blue-500"
                                >
                                    <option value="All">All Muscles</option>
                                    {#each recapData.muscleStats as m}
                                        <option value={m.name}>{m.name}</option>
                                    {/each}
                                </select>
                                <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
                                    <Filter size={12} />
                                </div>
                            </div>
                        </div>
                        <div class="bg-gray-800/30 rounded-xl p-4 border border-gray-700/50 h-48 flex items-end justify-between gap-2">
                            {#each weeklyChartData.bars as w}
                                {@const heightPercent = weeklyChartData.max > 0 ? (w.count / weeklyChartData.max) * 100 : 0}
                                <div class="flex-1 flex flex-col items-center gap-1 group h-full justify-end">
                                    <span class="text-[10px] text-gray-400 font-bold">{w.count} Sets</span>
                                    <div 
                                        class="w-full bg-blue-600 rounded-t hover:bg-blue-500 transition-all relative group-hover:shadow-[0_0_10px_rgba(37,99,235,0.5)]" 
                                        style="height: {heightPercent}%; min-height: 1px;"
                                    ></div>
                                    <span class="text-[10px] text-gray-500 font-mono">W{w.week}</span>
                                </div>
                            {/each}
                        </div>
                    </div>
                    <div>
                        <h3 class="text-lg font-bold text-white mb-4 flex items-center gap-2">
                            <Dumbbell size={18} class="text-purple-400"/> Sets per Muscle Group
                        </h3>
                        <div class="space-y-3">
                            {#each recapData.muscleStats as m}
                                {@const maxVal = recapData.muscleStats[0].count}
                                {@const widthPercent = (m.count / maxVal) * 100}
                                <div>
                                    <div class="flex justify-between text-xs mb-1 font-bold">
                                        <span class="text-gray-300">{m.name}</span>
                                        <span class="text-purple-300">{m.count} Sets</span>
                                    </div>
                                    <div class="h-3 w-full bg-gray-800 rounded-full overflow-hidden">
                                        <div class="h-full bg-purple-600 rounded-full" style="width: {widthPercent}%"></div>
                                    </div>
                                </div>
                            {/each}
                        </div>
                    </div>
                    {#if recapData.progress && recapData.progress.length > 0}
                        <div>
                            <h3 class="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <TrendingUp size={18} class="text-green-400"/> Lift Progress
                            </h3>
                            <div class="bg-gray-800/50 rounded-xl border border-gray-700 overflow-hidden">
                                <div class="grid grid-cols-[1fr_80px_80px] gap-2 p-3 border-b border-gray-700 text-xs font-bold text-gray-500 uppercase">
                                    <span>Exercise</span>
                                    <span class="text-center">Start</span>
                                    <span class="text-center">End</span>
                                </div>
                                {#each recapData.progress as p}
                                    <div class="grid grid-cols-[1fr_80px_80px] gap-2 p-3 border-b border-gray-800 last:border-0 items-center hover:bg-gray-800/50 transition-colors">
                                        <div class="font-medium text-sm text-gray-200">{p.name}</div>
                                        <div class="text-center text-xs">
                                            <div class="text-gray-400">{p.start.weight} lbs</div>
                                            <div class="text-gray-600">{p.start.reps} reps</div>
                                        </div>
                                        <div class="text-center text-xs">
                                            <div class="font-bold {p.deltaWeight >= 0 ? 'text-green-400' : 'text-red-400'}">
                                                {p.end.weight} lbs
                                            </div>
                                            {#if p.deltaWeight !== 0}
                                                <div class="text-[10px] {p.deltaWeight > 0 ? 'text-green-500' : 'text-red-500'}">
                                                    {p.deltaWeight > 0 ? '+' : ''}{p.deltaWeight} lbs
                                                </div>
                                            {:else}
                                                <div class="text-gray-600">{p.end.reps} reps</div>
                                                 {#if p.deltaReps !== 0}
                                                    <div class="text-[10px] {p.deltaReps > 0 ? 'text-green-500' : 'text-red-500'}">
                                                        {p.deltaReps > 0 ? '+' : ''}{p.deltaReps} reps
                                                    </div>
                                                 {/if}
                                            {/if}
                                        </div>
                                    </div>
                                {/each}
                            </div>
                        </div>
                    {/if}
                </div>
            {/if}
        </div>
    </div>
  {/if}

</div>