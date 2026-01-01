<script lang="ts">
  import { onMount } from "svelte";
  import { supabase } from "$lib/supabaseClient";
  import { CheckCircle, Circle, PlayCircle, Calendar, History, ChevronRight, X, Trash2, BarChart2, TrendingUp, Dumbbell, Layers, Filter } from "lucide-svelte";

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
  
  // Filtering State
  let selectedRecapMuscle = "All";

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

  async function deleteMesocycle(id: string, event: Event) {
    event.stopPropagation();
    if (!confirm("Are you sure? This will permanently delete this plan and all its workout history.")) return;

    const { error } = await supabase.from('mesocycles').delete().eq('id', id);

    if (error) {
        alert("Error deleting plan: " + error.message);
        return;
    }

    allMesocycles = allMesocycles.filter(m => m.id !== id);
    
    if (mesocycle && mesocycle.id === id) {
        if (allMesocycles.length > 0) {
            loadMesocycle(allMesocycles[0]);
        } else {
            mesocycle = null;
            calendar = [];
            showHistoryModal = false;
        }
    }
  }

  // --- RECAP LOGIC ---
  async function loadRecap() {
    if (recapData) {
        showRecapModal = true;
        return;
    }
    
    recapLoading = true;
    showRecapModal = true;

    try {
        const { data: workoutIdsData } = await supabase
            .from('workouts')
            .select('id, week_number')
            .eq('mesocycle_id', mesocycle.id);
        
        if (!workoutIdsData || workoutIdsData.length === 0) {
            recapLoading = false;
            return;
        }

        const workoutIdMap = new Map(workoutIdsData.map(w => [w.id, w.week_number]));
        const ids = workoutIdsData.map(w => w.id);

        const { data: exercises } = await supabase
            .from('workout_exercises')
            .select('exercise_name, set_results, workout_id')
            .in('workout_id', ids);

        if (!exercises) {
            recapLoading = false;
            return;
        }

        const { data: library } = await supabase
            .from('exercise_library')
            .select('name, muscle_group');
            
        const muscleMap = new Map(library?.map(l => [l.name, l.muscle_group]) || []);

        // --- CALCULATION ---
        let totalVolume = 0;
        const muscleCounts: Record<string, number> = {};
        
        // Initialize map for ALL weeks in cycle to ensure X-axis continuity
        const weeklyDataMap: Record<number, { total: number, muscles: Record<string, number> }> = {};
        for(let i = 1; i <= mesocycle.duration_weeks; i++) {
            weeklyDataMap[i] = { total: 0, muscles: {} };
        }

        const exerciseHistory: Record<string, { week: number, bestSet: { weight: number, reps: number } }[]> = {};

        exercises.forEach(ex => {
            const weekNum = workoutIdMap.get(ex.workout_id) || 0;
            const muscle = muscleMap.get(ex.exercise_name) || 'Other';
            
            // Ensure week entry exists (handle potential edge cases)
            if (!weeklyDataMap[weekNum]) {
                weeklyDataMap[weekNum] = { total: 0, muscles: {} };
            }

            let validSets = 0;
            let maxWeightForSession = 0;
            let repsForMaxWeight = 0;

            if (Array.isArray(ex.set_results)) {
                ex.set_results.forEach((s: any) => {
                    // FIX: Robust check for reps (handle strings/numbers)
                    const r = Number(s.reps);
                    const w = Number(s.weight);

                    if (!isNaN(r) && r > 0) {
                        validSets++;
                        
                        if (!isNaN(w) && w > 0) {
                            totalVolume += (w * r);
                        }

                        // Track best set
                        if (w > maxWeightForSession) {
                            maxWeightForSession = w;
                            repsForMaxWeight = r;
                        } else if (w === maxWeightForSession && r > repsForMaxWeight) {
                            repsForMaxWeight = r;
                        }
                    }
                });
            }

            if (validSets > 0) {
                // Global Muscle Count
                muscleCounts[muscle] = (muscleCounts[muscle] || 0) + validSets;
                
                // Weekly Breakdown
                weeklyDataMap[weekNum].total += validSets;
                weeklyDataMap[weekNum].muscles[muscle] = (weeklyDataMap[weekNum].muscles[muscle] || 0) + validSets;

                // Progress Data
                if (!exerciseHistory[ex.exercise_name]) exerciseHistory[ex.exercise_name] = [];
                exerciseHistory[ex.exercise_name].push({
                    week: weekNum,
                    bestSet: { weight: maxWeightForSession, reps: repsForMaxWeight }
                });
            }
        });

        // Format Progress Data
        const progressStats = Object.keys(exerciseHistory).map(name => {
            const history = exerciseHistory[name].sort((a,b) => a.week - b.week);
            if (history.length < 2) return null;

            const start = history[0];
            const end = history[history.length - 1];

            if (start.week === end.week) return null;

            return {
                name,
                start: start.bestSet,
                end: end.bestSet,
                deltaWeight: end.bestSet.weight - start.bestSet.weight,
                deltaReps: end.bestSet.reps - start.bestSet.reps
            };
        }).filter(Boolean);

        const sortedMuscles = Object.entries(muscleCounts)
            .sort(([, a], [, b]) => b - a)
            .map(([name, count]) => ({ name, count }));

        const weeklyBreakdown = Object.entries(weeklyDataMap)
            .map(([week, data]) => ({ week: Number(week), ...data }))
            .sort((a, b) => a.week - b.week);

        recapData = {
            totalVolume,
            muscleStats: sortedMuscles,
            weeklyBreakdown,
            progress: progressStats
        };

    } catch (e) {
        console.error(e);
        alert("Error generating recap");
    } finally {
        recapLoading = false;
    }
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

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  }
  
  function formatNumber(num: number) {
    return new Intl.NumberFormat('en-US').format(num);
  }
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
             {mesocycle === allMesocycles[0] ?
              'Current' : 'Archived'}
          </span>
        </div>
      </div>

      <div class="flex gap-2">
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
                    class="flex items-center justify-between p-3 rounded-lg border transition-all
                    {day.completed 
                        ? 'bg-green-900/10 border-green-900/30 text-gray-300' 
                        : day.started_at 
                        ? 'bg-amber-900/10 border-amber-600/30 text-white' 
                        : 'bg-gray-800 border-gray-700 hover:border-gray-500'}"
                    >
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
                        {#if weeklyChartData.bars.length === 0}
                            <div class="text-center text-xs text-gray-500 mt-2 italic">No sets found for this selection.</div>
                        {/if}
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