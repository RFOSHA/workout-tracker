<script lang="ts">
  import { fetchLifetimeStats } from "$lib/utils/statsLogic";
  import { fetchTrackedExercises, fetchExerciseProgress } from "$lib/utils/strengthProgressLogic";
  import type { ProgressPoint } from "$lib/utils/strengthProgressLogic";
  import Modal from "$lib/components/common/Modal.svelte";
  import StrengthChart from "$lib/components/common/StrengthChart.svelte";
  import {
    PlayCircle, Calendar, ChevronRight, Trophy, BarChart2, Layers,
    Dumbbell, Activity, Award, TrendingUp, X, User, ChevronDown, Bot, CheckCircle, Zap
  } from "lucide-svelte";

  let showHowItWorks = false;
  import { onMount } from "svelte";
  import type { Session } from "@supabase/supabase-js";
  import { supabase } from "$lib/supabaseClient";
  import Login from "../components/login.svelte";

  let session: Session | null = null;
  let currentMesocycle: any = null;
  let loadingData = true;
  let nextWorkout: any = null;
  // --- LIFETIME STATS STATE ---
  let showStatsModal = false;
  let statsLoading = false;
  let lifetimeStats: any = null;

  // --- STRENGTH PROGRESS STATE ---
  let trackedExercises: string[] = [];
  let selectedExercise = "";
  let progressPoints: ProgressPoint[] = [];
  let progressLoading = false;
  let progressMetric: 'weight' | 'est1rm' = 'weight';
  const progressCache = new Map<string, ProgressPoint[]>();

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

  async function loadLifetimeStats() {
    if (lifetimeStats) { showStatsModal = true; return; }

    statsLoading = true;
    showStatsModal = true;

    try {
        [lifetimeStats, trackedExercises] = await Promise.all([
            fetchLifetimeStats(supabase),
            fetchTrackedExercises(supabase)
        ]);
    } catch (error) {
        console.error(error);
        alert("Could not load stats.");
    } finally {
        statsLoading = false;
    }
  }

  async function selectExercise(name: string) {
    selectedExercise = name;
    progressMetric = 'weight';
    if (progressCache.has(name)) {
        progressPoints = progressCache.get(name)!;
        return;
    }
    progressLoading = true;
    try {
        const data = await fetchExerciseProgress(supabase, name);
        progressCache.set(name, data);
        progressPoints = data;
    } catch (e) {
        console.error(e);
        progressPoints = [];
    } finally {
        progressLoading = false;
    }
  }

  function formatNumber(num: number) {
    return new Intl.NumberFormat('en-US').format(num);
  }
</script>

{#if !session}
  <Login />
{:else}
  <div class="min-h-screen bg-gray-900 text-white p-6">
    <div class="max-w-4xl mx-auto">
      
      <header class="flex justify-between items-center mb-8 border-b border-gray-700 pb-4">
        <h1 class="text-3xl font-bold text-blue-400">Workout Tracker</h1>
        <div class="flex items-center gap-2">
          <button
              on:click={loadLifetimeStats}
              class="bg-gray-800 p-2 rounded-lg text-yellow-500 hover:text-yellow-400 hover:bg-gray-700 transition-colors border border-gray-700"
              title="Lifetime Stats"
          >
              <Trophy size={18} />
          </button>
          <a
              href="/profile"
              class="bg-gray-800 p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors border border-gray-700"
              title="Profile & Settings"
          >
              <User size={18} />
          </a>
        </div>
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
                <h2 class="text-2xl font-bold mb-1">{currentMesocycle.name}</h2>
                <p class="text-gray-400 text-sm mb-4">Started {new Date(currentMesocycle.created_at).toLocaleDateString()}</p>
              </div>
              <span class="bg-green-900 text-green-300 text-xs font-bold px-2 py-1 rounded uppercase">Active</span>
            </div>

            <p class="text-gray-300 mb-6">
              Training <strong>{currentMesocycle.days_per_week} days</strong> a week
              for <strong>{currentMesocycle.duration_weeks} weeks</strong>.
            </p>
            
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
                <h3 class="text-lg font-bold text-gray-200">Start a New Plan?</h3>
                <p class="text-gray-400 text-sm">Ready for a fresh start? Creating a new plan will set it as your active program.</p>
              </div>
              <a
                href="/mesocycle/new"
                class="whitespace-nowrap bg-gray-700 hover:bg-blue-600 border border-gray-600 hover:border-blue-500 text-white px-4 py-2 rounded transition-all"
              >
                + New Workout Plan
              </a>
            </div>
          </div>

        </div>

      {:else}
        <div class="text-center py-16 bg-gray-800 rounded-lg border border-gray-700 border-dashed">
          <h2 class="text-2xl font-bold mb-4">No Active Workout Plan</h2>
          <p class="text-gray-400 mb-8 max-w-md mx-auto">You don't have a training plan set up yet. Create one to generate your weekly schedule.</p>
          <a
            href="/mesocycle/new"
            class="inline-block bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg shadow-lg hover:shadow-blue-500/20 transition-all transform hover:-translate-y-1"
          >
            Create Workout Plan
          </a>
        </div>
      {/if}

      <!-- ── How it Works accordion ──────────────────────────────────────── -->
      <div class="border-t border-gray-800 pt-6 mt-2">
        <button
          on:click={() => showHowItWorks = !showHowItWorks}
          class="w-full flex items-center justify-between text-left group"
        >
          <span class="text-sm font-bold text-gray-500 group-hover:text-gray-300 transition-colors uppercase tracking-widest">
            How does this app work?
          </span>
          <ChevronDown
            size={16}
            class="text-gray-600 group-hover:text-gray-400 transition-all {showHowItWorks ? 'rotate-180' : ''}"
          />
        </button>

        {#if showHowItWorks}
          <div class="mt-4 grid gap-3">

            <div class="flex gap-4 bg-gray-800/50 border border-gray-700/60 rounded-xl p-4">
              <div class="bg-blue-900/50 p-2.5 rounded-xl shrink-0 h-fit">
                <Bot size={18} class="text-blue-400" />
              </div>
              <div>
                <p class="text-sm font-bold text-white mb-1">1 — Create a Workout Plan</p>
                <p class="text-xs text-gray-400 leading-relaxed">
                  Use the <strong class="text-gray-300">AI Builder</strong> to describe your goals in plain English ("6-week PPL for hypertrophy, 5 days/week") and Claude generates a full structured plan — exercises, sets, and a progressive overload schedule. Or build it manually with the step-by-step wizard.
                </p>
              </div>
            </div>

            <div class="flex gap-4 bg-gray-800/50 border border-gray-700/60 rounded-xl p-4">
              <div class="bg-green-900/50 p-2.5 rounded-xl shrink-0 h-fit">
                <Dumbbell size={18} class="text-green-400" />
              </div>
              <div>
                <p class="text-sm font-bold text-white mb-1">2 — Train and Log</p>
                <p class="text-xs text-gray-400 leading-relaxed">
                  Each session, log your <strong class="text-gray-300">weight and reps</strong> for every set. Tap an RIR number (Reps in Reserve) to record how hard the set felt — 0 means failure, 5 means very easy. The app uses this to auto-suggest progressions each week.
                </p>
              </div>
            </div>

            <div class="flex gap-4 bg-gray-800/50 border border-gray-700/60 rounded-xl p-4">
              <div class="bg-purple-900/50 p-2.5 rounded-xl shrink-0 h-fit">
                <BarChart2 size={18} class="text-purple-400" />
              </div>
              <div>
                <p class="text-sm font-bold text-white mb-1">3 — Track Your Progress</p>
                <p class="text-xs text-gray-400 leading-relaxed">
                  When you finish a plan, a full <strong class="text-gray-300">Performance Recap</strong> shows your total volume, lift-by-lift progression, weekly set counts, and muscle group balance — so you can see exactly what improved.
                </p>
              </div>
            </div>

            <div class="flex gap-4 bg-gray-800/50 border border-gray-700/60 rounded-xl p-4">
              <div class="bg-orange-900/50 p-2.5 rounded-xl shrink-0 h-fit">
                <Zap size={18} class="text-orange-400" />
              </div>
              <div>
                <p class="text-sm font-bold text-white mb-1">4 — Smart Next Plan</p>
                <p class="text-xs text-gray-400 leading-relaxed">
                  After completing a plan, the app analyzes your performance and <strong class="text-gray-300">automatically suggests your next one</strong> — same split, adjusted volume based on how well your lifts progressed. One tap to accept and start.
                </p>
              </div>
            </div>

          </div>
        {/if}
      </div>

    </div>
  </div>
{/if}

{#if showStatsModal}
    <Modal widthClass="w-full sm:max-w-2xl" on:close={() => showStatsModal = false}>
        <div class="flex justify-between items-center mb-6 shrink-0">
            <h2 class="text-2xl font-bold flex items-center gap-2 text-white">
                <Trophy size={24} class="text-yellow-500"/> Lifetime Stats
            </h2>
        </div>

        {#if statsLoading}
            <div class="flex-1 flex items-center justify-center p-12 text-gray-500">
                Crunching the numbers...
            </div>
        {:else if lifetimeStats}
            <div class="flex-1 overflow-y-auto pr-2 space-y-8">
                
                <div class="grid grid-cols-2 gap-3">
                    <div class="bg-gray-800 p-4 rounded-xl border border-gray-700">
                        <div class="flex items-center gap-2 mb-1 text-gray-400 text-xs font-bold uppercase">
                            <Layers size={14}/> Total Volume
                        </div>
                        <div class="text-2xl font-black text-white">
                            {formatNumber(lifetimeStats.totalVolume)} <span class="text-sm font-medium text-gray-500">lbs</span>
                        </div>
                    </div>
                    <div class="bg-gray-800 p-4 rounded-xl border border-gray-700">
                        <div class="flex items-center gap-2 mb-1 text-gray-400 text-xs font-bold uppercase">
                            <Activity size={14}/> Workouts
                        </div>
                        <div class="text-2xl font-black text-white">
                            {lifetimeStats.totalWorkouts}
                        </div>
                    </div>
                    <div class="bg-gray-800 p-4 rounded-xl border border-gray-700">
                        <div class="flex items-center gap-2 mb-1 text-gray-400 text-xs font-bold uppercase">
                            <Dumbbell size={14}/> Total Sets
                        </div>
                        <div class="text-2xl font-black text-white">
                            {formatNumber(lifetimeStats.totalSets)}
                        </div>
                    </div>
                    <div class="bg-gray-800 p-4 rounded-xl border border-gray-700">
                        <div class="flex items-center gap-2 mb-1 text-gray-400 text-xs font-bold uppercase">
                            <Calendar size={14}/> Days Active
                        </div>
                        <div class="text-2xl font-black text-white">
                            {lifetimeStats.daysActive}
                        </div>
                    </div>
                </div>

                <div>
                    <h3 class="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <BarChart2 size={18} class="text-blue-400"/> Muscle Focus
                    </h3>
                    <div class="space-y-3">
                        {#each lifetimeStats.muscleStats as m}
                            {@const maxVal = lifetimeStats.muscleStats[0].count}
                            {@const widthPercent = (m.count / maxVal) * 100}
                            <div>
                                <div class="flex justify-between text-xs mb-1 font-bold">
                                    <span class="text-gray-300">{m.name}</span>
                                    <span class="text-blue-300">{m.count} Sets</span>
                                </div>
                                <div class="h-2 w-full bg-gray-800 rounded-full overflow-hidden">
                                    <div class="h-full bg-blue-600 rounded-full" style="width: {widthPercent}%"></div>
                                </div>
                            </div>
                        {/each}
                    </div>
                </div>

                {#if lifetimeStats.prs.length > 0}
                    <div>
                        <h3 class="text-lg font-bold text-white mb-4 flex items-center gap-2">
                            <Award size={18} class="text-yellow-400"/> Personal Records
                        </h3>
                        <div class="bg-gray-800/50 rounded-xl border border-gray-700 overflow-hidden">
                            <div class="grid grid-cols-[1fr_80px] gap-2 p-3 border-b border-gray-700 text-xs font-bold text-gray-500 uppercase">
                                <span>Exercise</span>
                                <span class="text-right">Max Load</span>
                            </div>
                            {#each lifetimeStats.prs as pr}
                                <button
                                    on:click={() => selectExercise(pr.name)}
                                    class="w-full grid grid-cols-[1fr_80px] gap-2 p-3 border-b border-gray-800 last:border-0 items-center transition-colors text-left
                                        {selectedExercise === pr.name ? 'bg-blue-900/30 border-l-2 border-l-blue-500' : 'hover:bg-gray-800/50'}"
                                >
                                    <div class="font-medium text-sm {selectedExercise === pr.name ? 'text-blue-300' : 'text-gray-200'}">{pr.name}</div>
                                    <div class="text-right text-sm font-bold text-white">
                                        {pr.weight} <span class="text-xs text-gray-500 font-normal">x{pr.reps}</span>
                                    </div>
                                </button>
                            {/each}
                        </div>
                    </div>
                {/if}

                <!-- Strength Progress Chart -->
                <div>
                    <h3 class="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <TrendingUp size={18} class="text-green-400"/> Strength Progress
                    </h3>

                    <div class="relative mb-4">
                        <select
                            value={selectedExercise}
                            on:change={(e) => selectExercise(e.currentTarget.value)}
                            class="w-full appearance-none bg-gray-800 text-sm text-white border border-gray-600 rounded-lg px-3 py-2.5 pr-8 focus:outline-none focus:border-blue-500"
                        >
                            <option value="">Select an exercise...</option>
                            {#each trackedExercises as name}
                                <option value={name}>{name}</option>
                            {/each}
                        </select>
                        <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-400">
                            <svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 4l4 4 4-4" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>
                        </div>
                    </div>

                    {#if selectedExercise}
                        {#if progressLoading}
                            <div class="text-center text-gray-500 py-10 text-sm">Loading...</div>
                        {:else if progressPoints.length < 2}
                            <div class="text-center text-gray-600 py-10 text-sm border border-gray-700/50 rounded-xl">
                                Need data from at least 2 completed blocks to show a trend.
                            </div>
                        {:else}
                            <div class="flex gap-2 mb-3">
                                <button
                                    on:click={() => progressMetric = 'weight'}
                                    class="text-xs px-3 py-1 rounded-full font-bold transition-colors
                                        {progressMetric === 'weight' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400 hover:text-white'}"
                                >Top Weight</button>
                                <button
                                    on:click={() => progressMetric = 'est1rm'}
                                    class="text-xs px-3 py-1 rounded-full font-bold transition-colors
                                        {progressMetric === 'est1rm' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400 hover:text-white'}"
                                >Est. 1RM</button>
                            </div>
                            <div class="bg-gray-800/50 rounded-xl border border-gray-700 px-3 pt-3 pb-1">
                                <StrengthChart points={progressPoints} metric={progressMetric} />
                            </div>
                        {/if}
                    {/if}
                </div>

            </div>
        {/if}
    </Modal>
  {/if}