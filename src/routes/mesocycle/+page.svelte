<script lang="ts">
  import { onMount } from "svelte";
  import { supabase } from "$lib/supabaseClient";
  import { Calendar, History, Pencil, BarChart2 } from "lucide-svelte";

  // --- UTILS & ACTIONS ---
  import { fetchRecapData } from "$lib/utils/recapLogic";
  import { buildCalendarGrid, updateFutureWorkouts } from "$lib/utils/mesoLogic";
  import { deleteMesocycleFromDB, fetchPlanTemplates } from "$lib/actions/mesoActions";
  
  // --- COMPONENTS ---
  import RecapModal from "$lib/components/workout/modals/RecapModal.svelte";
  import EditPlanModal from "$lib/components/mesocycle/modals/EditPlanModal.svelte";
  import MesoHistoryModal from "$lib/components/mesocycle/modals/MesoHistoryModal.svelte";
  import CalendarWeek from "$lib/components/mesocycle/CalendarWeek.svelte";
  import AlertModal from "$lib/components/common/AlertModal.svelte";

  // --- STATE ---
  let loading = true;
  let mesocycle: any = null;
  let allMesocycles: any[] = [];
  let calendar: any[][] = [];

  // Modals State
  let showHistoryModal = false;
  let showRecapModal = false;
  let showEditPlanModal = false;
  let alertMessage = "";

  // Modals Data
  let recapLoading = false;
  let recapData: any = null;
  let planTemplates: Record<string, any[]> = {}; 
  let fullLibrary: any[] = [];
  let savingPlan = false;

  // --- LIFECYCLE ---
  onMount(async () => {
    await initData();
  });

  async function initData() {
    // Change 'start_date' to 'created_at'
    const { data: mesos } = await supabase
      .from('mesocycles')
      .select('*')
      .order('created_at', { ascending: false }); 
      
    if (!mesos || mesos.length === 0) { loading = false; return; }
    
    allMesocycles = mesos;
    await loadMesocycle(mesos[0]);
  }
  async function loadMesocycle(selectedMeso: any) {
    loading = true;
    mesocycle = selectedMeso;
    showHistoryModal = false; 
    
    const { data: workouts } = await supabase
      .from('workouts')
      .select('*')
      .eq('mesocycle_id', selectedMeso.id)
      .order('week_number', { ascending: true })
      .order('day_number', { ascending: true });
      
    calendar = buildCalendarGrid(workouts || [], selectedMeso.duration_weeks, selectedMeso.days_per_week);
    loading = false;
  }

  // --- HANDLERS ---
  
  async function openPlanEditor() {
    if (!mesocycle) return;
    planTemplates = await fetchPlanTemplates(supabase, mesocycle.id);

    //ADD THIS CHECK: Stop the modal if there are no future workouts
    if (Object.keys(planTemplates).length === 0) {
        alertMessage = "There are no incomplete workouts left in this cycle to edit!";
        return;
    }
    
    if (fullLibrary.length === 0) {
        const { data: lib } = await supabase.from('exercise_library').select('*').order('name');
        fullLibrary = lib || [];
    }
    showEditPlanModal = true;
  }

  async function savePlanChanges(e: CustomEvent) {
    const updatedTemplates = e.detail;
    if (!confirm("This will update all FUTURE incomplete workouts in this cycle. Continue?")) return;
    
    savingPlan = true;
    try {
        await updateFutureWorkouts(supabase, mesocycle.id, updatedTemplates);
        showEditPlanModal = false;
        await loadMesocycle(mesocycle); // Reload UI
    } catch (err: any) {
        alert("Error saving plan: " + err.message);
    } finally {
        savingPlan = false;
    }
  }

  async function deleteMesocycle(e: CustomEvent) {
    const { id } = e.detail;
    if (!confirm("Are you sure? This will permanently delete this plan and all its workout history.")) return;
    
    try {
        await deleteMesocycleFromDB(supabase, id);
        allMesocycles = allMesocycles.filter(m => m.id !== id);
        
        if (mesocycle && mesocycle.id === id) {
            if (allMesocycles.length > 0) loadMesocycle(allMesocycles[0]);
            else { mesocycle = null; calendar = []; showHistoryModal = false; }
        }
    } catch (err: any) {
        alert("Error: " + err.message);
    }
  }

  async function loadRecap() {
    if (recapData) { showRecapModal = true; return; }
    
    recapLoading = true; 
    showRecapModal = true;
    try {
        recapData = await fetchRecapData(supabase, mesocycle.id);
    } catch (e) {
        console.error(e);
        alert("Error generating recap");
    } finally {
        recapLoading = false;
    }
  }
</script>

<div class="min-h-screen bg-gray-900 text-white p-4 pb-32">
  
  {#if loading && !mesocycle}
    <div class="text-center text-gray-500 mt-10 animate-pulse">Loading schedule...</div>
  {:else if !mesocycle}
    <div class="text-center mt-20">
      <h2 class="text-xl font-bold mb-4">No Active Mesocycle</h2>
      <a href="/mesocycle/new" class="bg-blue-600 hover:bg-blue-500 px-6 py-3 rounded-full font-bold transition-colors inline-block">Create Plan</a>
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
             {mesocycle.id === allMesocycles[0].id ? 'Current' : 'Archived'}
          </span>
        </div>
      </div>

      <div class="flex gap-2">
          <button on:click={openPlanEditor} class="bg-gray-800 p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors" title="Edit Plan">
            <Pencil size={20} />
          </button>
          <button on:click={loadRecap} class="bg-blue-900/30 border border-blue-500/30 p-2 rounded-lg text-blue-400 hover:bg-blue-900/50 transition-colors" title="View Recap">
            <BarChart2 size={20} />
          </button>
          <button on:click={() => showHistoryModal = true} class="bg-gray-800 p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors" title="View Past Cycles">
            <History size={20} />
          </button>
      </div>
    </div>

    {#if loading}
         <div class="text-center text-gray-500 py-10 animate-pulse">Loading workouts...</div>
    {:else}
        <div class="space-y-6 animate-fade-in">
          {#each calendar as week, wIndex}
              <CalendarWeek {week} {wIndex} {mesocycle} />
          {/each}
        </div>
    {/if}

  {/if}

  {#if showEditPlanModal}
    <EditPlanModal 
        {planTemplates} 
        {fullLibrary} 
        {savingPlan} 
        on:close={() => showEditPlanModal = false} 
        on:save={savePlanChanges} 
    />
  {/if}

  {#if showHistoryModal}
    <MesoHistoryModal 
        {allMesocycles} 
        currentMesocycleId={mesocycle?.id} 
        on:close={() => showHistoryModal = false}
        on:select={(e) => loadMesocycle(e.detail)}
        on:delete={deleteMesocycle}
    />
  {/if}
  
  {#if showRecapModal}
    <RecapModal 
        {recapLoading} 
        {recapData} 
        isComplete={mesocycle !== allMesocycles[0]} 
        on:close={() => showRecapModal = false}
    />
  {/if}

  {#if alertMessage}
    <AlertModal 
        title="Can't Edit Plan" 
        message={alertMessage} 
        on:close={() => alertMessage = ""} 
    />
  {/if}

</div>