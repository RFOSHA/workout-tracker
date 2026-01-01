<script lang="ts">
  import { onMount } from "svelte";
  import { supabase } from "$lib/supabaseClient";
  import { CheckCircle, Circle, PlayCircle, Calendar, History, ChevronRight, X, Trash2 } from "lucide-svelte";

  // --- STATE ---
  let loading = true;
  let mesocycle: any = null;        // The currently displayed plan
  let calendar: any[][] = [];       // The grid for the current plan
  
  // History State
  let allMesocycles: any[] = [];    // List of all available plans
  let showHistoryModal = false;

  onMount(async () => {
    await initData();
  });

  // 1. INITIAL LOAD
  async function initData() {
    // Fetch ALL mesocycles, ordered by latest first
    const { data: mesos } = await supabase
      .from('mesocycles')
      .select('*')
      .order('start_date', { ascending: false });

    if (!mesos || mesos.length === 0) {
      loading = false;
      return;
    }

    allMesocycles = mesos;
    
    // Default to the most recent one
    await loadMesocycle(mesos[0]);
  }

  // 2. LOAD SPECIFIC MESOCYCLE
  async function loadMesocycle(selectedMeso: any) {
    loading = true;
    mesocycle = selectedMeso;
    showHistoryModal = false; // Close modal if open

    // Get Workouts for this specific block
    const { data: workouts } = await supabase
      .from('workouts')
      .select('*')
      .eq('mesocycle_id', selectedMeso.id)
      .order('week_number', { ascending: true })
      .order('day_number', { ascending: true });

    // Build the Grid
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

  // 3. DELETE MESOCYCLE
  async function deleteMesocycle(id: string, event: Event) {
    // Stop the click from triggering the "Load Mesocycle" action on the parent button
    event.stopPropagation(); 

    if (!confirm("Are you sure? This will permanently delete this plan and all its workout history.")) return;

    const { error } = await supabase.from('mesocycles').delete().eq('id', id);

    if (error) {
        alert("Error deleting plan: " + error.message);
        return;
    }

    // Update Local State: Remove from list
    allMesocycles = allMesocycles.filter(m => m.id !== id);

    // If we deleted the one currently being viewed, switch to another or clear view
    if (mesocycle && mesocycle.id === id) {
        if (allMesocycles.length > 0) {
            // Load the next available one
            loadMesocycle(allMesocycles[0]);
        } else {
            // No plans left
            mesocycle = null;
            calendar = [];
            showHistoryModal = false;
        }
    }
  }

  // --- DATE HELPERS ---

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

      <button 
        on:click={() => showHistoryModal = true}
        class="bg-gray-800 p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
        title="View Past Cycles"
      >
        <History size={20} />
      </button>
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
    <div class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex justify-end">
        
        <div class="w-full max-w-sm bg-gray-900 h-full border-l border-gray-800 p-6 flex flex-col shadow-2xl animate-slide-in-right">
            
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

</div>