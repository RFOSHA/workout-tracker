<script lang="ts">
  import { onMount } from "svelte";
  import type { Session } from "@supabase/supabase-js";
  import { supabase } from "$lib/supabaseClient";
  import Login from "../components/Login.svelte";

  let session: Session | null = null;
  let currentMesocycle: any = null;
  let loadingData = true;
  let nextWorkout: any = null;

  onMount(() => {
    supabase.auth.getSession().then(({ data }) => {
      session = data.session;
      if (session) fetchMesocycle();
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, _session) => {
      session = _session;
      if (session) fetchMesocycle();
    });

    return () => subscription.unsubscribe();
  });

  async function fetchMesocycle() {
    loadingData = true;
    
    // 1. Get the Mesocycle
    const { data: meso } = await supabase
      .from('mesocycles')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (meso) {
      currentMesocycle = meso;

      // 2. NEW: Find the first uncompleted workout for this block
      const { data: workout } = await supabase
        .from('workouts')
        .select('id, name, week_number, day_number, started_at')
        .eq('mesocycle_id', meso.id)
        .eq('completed', false)
        .order('week_number', { ascending: true })
        .order('day_number', { ascending: true })
        .limit(1)
        .single();
        
      nextWorkout = workout;
    }
    loadingData = false;
  }
</script>

{#if !session}
  <Login />
{:else}
  <div class="min-h-screen bg-gray-900 text-white p-6">
    <div class="max-w-4xl mx-auto">
      
      <header class="flex justify-between items-center mb-8 border-b border-gray-700 pb-4">
        <h1 class="text-3xl font-bold text-blue-400">Workout Tracker</h1>
        <button on:click={() => supabase.auth.signOut()} class="text-sm text-gray-400 hover:text-white transition-colors">
          Sign Out
        </button>
      </header>

      {#if loadingData}
        <div class="animate-pulse flex space-x-4">
          <div class="h-12 bg-gray-700 rounded w-full"></div>
        </div>
      {:else if currentMesocycle}
        <div class="space-y-8">
          
          <div class="bg-gray-800 p-6 rounded-lg border-l-4 border-green-500 shadow-lg">
            <div class="flex justify-between items-start">
              <div>
                <h2 class="text-2xl font-bold mb-1">Current Training Block</h2>
                <p class="text-gray-400 text-sm mb-4">Started on {new Date(currentMesocycle.created_at).toLocaleDateString()}</p>
              </div>
              <span class="bg-green-900 text-green-300 text-xs font-bold px-2 py-1 rounded uppercase">Active</span>
            </div>
            
            <p class="text-gray-300 mb-6">
              Training <strong>{currentMesocycle.days_per_week} days</strong> a week 
              for <strong>{currentMesocycle.duration_weeks} weeks</strong>.
            </p>
            
            <!-- <button class="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-md font-bold transition-colors">
              View Workouts
            </button> -->

              <div class="mt-6">
                  {#if nextWorkout}
                    <a 
                      href="/workout/{nextWorkout.id}" 
                      class="inline-flex items-center justify-center bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-bold shadow-lg transition-transform active:scale-95 w-full sm:w-auto"
                    >
                      {#if nextWorkout.started_at}
                        ▶ Continue: {nextWorkout.name}
                      {:else}
                        Start Workout: {nextWorkout.name}
                      {/if}
                      <span class="ml-2 text-xs opacity-75 font-normal">(Week {nextWorkout.week_number})</span>
                    </a>
                  {:else}
                    <button class="bg-gray-700 text-gray-400 cursor-not-allowed px-6 py-3 rounded-lg font-bold">
                      All Workouts Completed!
                    </button>
                  {/if}
                </div>
          </div>

          <div class="border-t border-gray-800 pt-8">
            <div class="bg-gray-800/50 p-6 rounded-lg border border-gray-700 flex flex-col md:flex-row items-center justify-between gap-4">
              <div>
                <h3 class="text-lg font-bold text-gray-200">Start a New Program?</h3>
                <p class="text-gray-400 text-sm">Ready for a fresh start? Creating a new block will set it as your active program.</p>
              </div>
              <a 
                href="/mesocycle/new" 
                class="whitespace-nowrap bg-gray-700 hover:bg-blue-600 border border-gray-600 hover:border-blue-500 text-white px-4 py-2 rounded transition-all"
              >
                + Create New Block
              </a>
            </div>
          </div>

        </div>

      {:else}
        <div class="text-center py-16 bg-gray-800 rounded-lg border border-gray-700 border-dashed">
          <h2 class="text-2xl font-bold mb-4">No Active Mesocycle</h2>
          <p class="text-gray-400 mb-8 max-w-md mx-auto">You don't have a training plan set up yet. Create a new block to generate your weekly schedule.</p>
          <a 
            href="/mesocycle/new" 
            class="inline-block bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg shadow-lg hover:shadow-blue-500/20 transition-all transform hover:-translate-y-1"
          >
            Create New Mesocycle
          </a>
        </div>
      {/if}

    </div>
  </div>
{/if}