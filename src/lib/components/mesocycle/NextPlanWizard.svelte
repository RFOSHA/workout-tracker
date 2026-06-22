<script lang="ts">
  import { onMount, createEventDispatcher } from "svelte";
  import { supabase } from "$lib/supabaseClient";
  import { goto } from "$app/navigation";
  import { createMesocyclePlan } from "$lib/actions/generateMesocycle";
  import { Sparkles, CheckCircle, ArrowLeft, RefreshCw, Calendar, Dumbbell, ChevronDown, ChevronUp, Wrench } from "lucide-svelte";

  export let recapData: any;
  export let completedMeso: any;
  export let exerciseLibrary: { name: string; muscle_group: string }[] = [];

  const dispatch = createEventDispatcher();

  let loading = true;
  let creating = false;
  let errorMsg = "";
  let proposedPlan: any = null;
  let expandedDay: number | null = null;

  $: totalWeeks = proposedPlan
    ? proposedPlan.config.totalCycles + (proposedPlan.deloadConfig?.enabled ? proposedPlan.deloadConfig.duration : 0)
    : 0;
  $: liftDays = proposedPlan
    ? proposedPlan.schedule.filter((d: any) => d.type === "lift").length
    : 0;
  $: splitCount = proposedPlan ? Object.keys(proposedPlan.exercisesPerType).length : 0;

  onMount(fetchSuggestion);

  function buildContextMessage(): string {
    const topMuscles = (recapData.muscleStats ?? [])
      .slice(0, 5)
      .map((m: any) => `${m.name} (${m.count} sets)`)
      .join(", ");

    const gains = (recapData.progress ?? [])
      .slice(0, 5)
      .map((p: any) => `${p.name}: ${p.start.weight}→${p.end.weight} lbs`)
      .join(", ") || "No tracked lifts";

    const volumeK = ((recapData.totalVolume ?? 0) / 1000).toFixed(0);

    // Average weekly sets trend (did volume increase or plateau?)
    const weekly: any[] = recapData.weeklyBreakdown ?? [];
    const firstHalf = weekly.slice(0, Math.ceil(weekly.length / 2));
    const secondHalf = weekly.slice(Math.ceil(weekly.length / 2));
    const avgFirst = firstHalf.reduce((s: number, w: any) => s + w.total, 0) / (firstHalf.length || 1);
    const avgSecond = secondHalf.reduce((s: number, w: any) => s + w.total, 0) / (secondHalf.length || 1);
    const trend = avgSecond > avgFirst * 1.05 ? "volume was progressing well" : "volume plateaued toward the end";

    return `I just completed a ${completedMeso.duration_weeks}-week, ${completedMeso.days_per_week}-day/week training plan called "${completedMeso.name}".

Performance summary:
- Total volume: ${volumeK}k lbs
- Top muscles trained: ${topMuscles}
- Key lift progression: ${gains}
- Volume trend: ${trend}

Build my next workout plan. Keep the same general split structure. Based on my performance:
- If lifts progressed well (${gains.includes("→") ? "which they did" : "limited data"}), add 1 set per exercise to push further
- Maintain the same exercise selection from my library where possible
- Include a deload week at the end`;
  }

  async function fetchSuggestion() {
    loading = true;
    errorMsg = "";
    proposedPlan = null;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/generate-meso", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {})
        },
        body: JSON.stringify({
          messages: [{ role: "user", content: buildContextMessage() }],
          exerciseLibrary
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }

      const data = await res.json();
      if (data.proposedPlan) {
        proposedPlan = data.proposedPlan;
      } else {
        throw new Error("Couldn't generate a suggestion — try again or build manually.");
      }
    } catch (e: any) {
      errorMsg = e.message ?? "Something went wrong";
    } finally {
      loading = false;
    }
  }

  function normalizeExercises(raw: Record<string, any[]>) {
    const out: Record<string, any[]> = {};
    for (const [type, exs] of Object.entries(raw)) {
      out[type] = exs.map(ex => ({
        name: ex.name,
        startSets: ex.startSets ?? 3,
        endSets: ex.endSets ?? 5,
        isDropset: ex.isDropset ?? false,
        progressionType: ex.progressionType ?? "linear",
        manualSets: ex.manualSets ?? []
      }));
    }
    return out;
  }

  async function acceptPlan() {
    if (!proposedPlan || creating) return;
    creating = true;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      await createMesocyclePlan(
        supabase,
        user.id,
        { ...proposedPlan.config, startDate: new Date().toISOString().split("T")[0] },
        proposedPlan.schedule,
        proposedPlan.deloadConfig ?? { enabled: false, duration: 1, weeks: [] },
        normalizeExercises(proposedPlan.exercisesPerType)
      );
      goto("/");
    } catch (e: any) {
      alert("Error creating plan: " + e.message);
      creating = false;
    }
  }
</script>

<!-- Full-screen overlay -->
<div class="fixed inset-0 z-50 bg-gray-900 flex flex-col">

  <!-- Header -->
  <div class="bg-gray-800 border-b border-gray-700 px-4 py-4 flex items-center gap-3 shrink-0">
    <button on:click={() => dispatch('close')} class="text-gray-400 hover:text-white transition-colors p-1 -ml-1">
      <ArrowLeft size={22} />
    </button>
    <div class="flex items-center gap-2">
      <Sparkles size={18} class="text-purple-400" />
      <h1 class="text-lg font-bold text-white">Your Next Workout Plan</h1>
    </div>
  </div>

  <!-- Content -->
  <div class="flex-1 overflow-y-auto px-4 py-6 max-w-lg mx-auto w-full">

    <!-- Prior plan context pill -->
    <div class="mb-5 flex items-center gap-2 bg-gray-800/60 border border-gray-700 rounded-xl px-4 py-2.5">
      <CheckCircle size={14} class="text-green-400 shrink-0" />
      <p class="text-xs text-gray-400">
        Based on <span class="text-white font-bold">{completedMeso?.name ?? "your completed plan"}</span>
        — {completedMeso?.duration_weeks ?? "?"} weeks, {completedMeso?.days_per_week ?? "?"} days/week
      </p>
    </div>

    {#if loading}
      <!-- Loading state -->
      <div class="space-y-4">
        <div class="bg-gray-800 rounded-2xl border border-gray-700 p-6">
          <div class="flex items-center gap-3 mb-4">
            <div class="bg-purple-900/40 p-2.5 rounded-xl">
              <Sparkles size={20} class="text-purple-400" />
            </div>
            <div>
              <p class="text-sm font-bold text-white">Analyzing your performance...</p>
              <p class="text-xs text-gray-500">Building a personalized next plan</p>
            </div>
          </div>
          <div class="flex gap-1.5 items-center h-5 pl-1">
            <span class="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style="animation-delay:0ms"></span>
            <span class="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style="animation-delay:150ms"></span>
            <span class="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style="animation-delay:300ms"></span>
          </div>
        </div>
        <!-- Skeleton bars -->
        <div class="space-y-2">
          {#each [1,2,3,4] as _}
            <div class="h-10 bg-gray-800/50 rounded-xl animate-pulse"></div>
          {/each}
        </div>
      </div>

    {:else if errorMsg}
      <!-- Error state -->
      <div class="bg-red-900/20 border border-red-800/50 rounded-2xl p-6 text-center space-y-4">
        <p class="text-red-400 text-sm">{errorMsg}</p>
        <div class="flex gap-3 justify-center">
          <button
            on:click={fetchSuggestion}
            class="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-700 hover:bg-gray-600 text-sm font-bold text-white transition-colors"
          >
            <RefreshCw size={14} /> Try Again
          </button>
          <a
            href="/mesocycle/new"
            class="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-700 hover:bg-gray-600 text-sm font-bold text-white transition-colors"
          >
            <Wrench size={14} /> Build Manually
          </a>
        </div>
      </div>

    {:else if proposedPlan}
      <!-- Plan preview card -->
      <div class="bg-gradient-to-br from-gray-800 to-gray-800/60 border border-purple-700/40 rounded-2xl overflow-hidden shadow-lg">

        <div class="bg-purple-900/30 border-b border-purple-700/30 px-4 py-3 flex items-center gap-2">
          <Sparkles size={16} class="text-purple-400" />
          <span class="font-bold text-purple-300 text-sm">Suggested Plan</span>
        </div>

        <div class="p-4 space-y-4">
          <!-- Name + summary -->
          <div>
            <h3 class="text-lg font-black text-white mb-1">{proposedPlan.config.mesoName}</h3>
            <p class="text-sm text-gray-400 leading-relaxed">{proposedPlan.summary}</p>
          </div>

          <!-- Stats row -->
          <div class="grid grid-cols-3 gap-2">
            <div class="bg-gray-900/60 rounded-xl p-3 text-center">
              <Calendar size={14} class="text-blue-400 mx-auto mb-1" />
              <div class="text-xl font-black text-white">{totalWeeks}</div>
              <div class="text-[10px] text-gray-500 uppercase font-bold">Weeks</div>
            </div>
            <div class="bg-gray-900/60 rounded-xl p-3 text-center">
              <Dumbbell size={14} class="text-purple-400 mx-auto mb-1" />
              <div class="text-xl font-black text-white">{liftDays}</div>
              <div class="text-[10px] text-gray-500 uppercase font-bold">Days/Wk</div>
            </div>
            <div class="bg-gray-900/60 rounded-xl p-3 text-center">
              <div class="text-xl font-black text-white">{splitCount}</div>
              <div class="text-[10px] text-gray-500 uppercase font-bold">Splits</div>
            </div>
          </div>

          <!-- Schedule accordion -->
          <div>
            <p class="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">
              Weekly Schedule <span class="normal-case text-gray-600 font-normal">(tap to inspect)</span>
            </p>
            <div class="space-y-1.5">
              {#each proposedPlan.schedule as day}
                {#if day.type === "lift" && day.workoutName}
                  {@const exercises = (proposedPlan.exercisesPerType[day.workoutName] ?? []) as any[]}
                  {@const isOpen = expandedDay === day.dayIndex}
                  <div>
                    <button
                      on:click={() => expandedDay = isOpen ? null : day.dayIndex}
                      class="w-full flex items-center justify-between bg-gray-900/60 rounded-xl px-3 py-2.5 border transition-colors
                             {isOpen ? 'border-purple-600/60 bg-purple-950/20' : 'border-gray-700/50 hover:border-purple-700/40'}"
                    >
                      <div class="flex items-center gap-2.5">
                        <span class="text-[10px] text-gray-500 font-mono shrink-0 w-9 text-left">Day {day.dayIndex}</span>
                        <span class="text-sm font-bold text-white">{day.workoutName}</span>
                        <span class="text-[10px] text-gray-600">{exercises.length} exercises</span>
                      </div>
                      {#if isOpen}
                        <ChevronUp size={14} class="text-purple-400 shrink-0" />
                      {:else}
                        <ChevronDown size={14} class="text-gray-500 shrink-0" />
                      {/if}
                    </button>
                    {#if isOpen}
                      <div class="mt-1 ml-3 bg-gray-900/50 rounded-xl border border-gray-800/60 overflow-hidden">
                        {#each exercises as ex, i}
                          <div class="flex items-center justify-between px-3 py-2 {i < exercises.length - 1 ? 'border-b border-gray-800/50' : ''}">
                            <span class="text-sm text-gray-200">{ex.name}</span>
                            <span class="text-xs text-gray-500 font-mono shrink-0 ml-2">{ex.startSets}→{ex.endSets} sets</span>
                          </div>
                        {/each}
                      </div>
                    {/if}
                  </div>
                {:else}
                  <div class="flex items-center justify-between bg-gray-900/20 rounded-xl px-3 py-2 border border-gray-800/30">
                    <span class="text-[10px] text-gray-600 font-mono w-9">Day {day.dayIndex}</span>
                    <span class="text-xs text-gray-700 italic">Rest</span>
                  </div>
                {/if}
              {/each}
            </div>
          </div>

          <!-- Actions -->
          <div class="flex gap-3 pt-1">
            <button
              on:click={fetchSuggestion}
              class="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm font-bold transition-colors"
            >
              <RefreshCw size={15} /> Regenerate
            </button>
            <button
              on:click={acceptPlan}
              disabled={creating}
              class="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-60 text-white text-sm font-bold transition-colors"
            >
              {#if creating}
                Creating...
              {:else}
                <CheckCircle size={15} /> Start This Plan
              {/if}
            </button>
          </div>

          <a
            href="/mesocycle/new"
            class="block w-full text-center py-2 text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            Prefer to build it manually →
          </a>
        </div>
      </div>
    {/if}

  </div>
</div>
