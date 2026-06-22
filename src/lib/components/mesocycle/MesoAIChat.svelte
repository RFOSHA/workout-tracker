<script lang="ts">
  import { createEventDispatcher, tick } from "svelte";
  import { Bot, Send, CheckCircle, RotateCcw, Dumbbell, Calendar, ChevronDown, ChevronUp, Sparkles } from "lucide-svelte";
  import { supabase } from "$lib/supabaseClient";

  export let exerciseLibrary: { name: string; muscle_group: string }[] = [];

  const dispatch = createEventDispatcher();

  // ─── Types ───────────────────────────────────────────────────────────────
  type DisplayMsg = { role: "user" | "assistant"; text: string };
  type ApiMsg = { role: string; content: any };

  // ─── State ───────────────────────────────────────────────────────────────
  let displayMessages: DisplayMsg[] = [];
  let apiHistory: ApiMsg[] = [];

  let input = "";
  let loading = false;
  let errorMsg = "";
  let proposedPlan: any = null;

  // Which day's exercise list is currently open (null = all collapsed)
  let expandedDay: number | null = null;

  let chatEl: HTMLDivElement;
  let inputEl: HTMLTextAreaElement;

  // ─── Helpers ─────────────────────────────────────────────────────────────
  async function scrollToBottom() {
    await tick();
    chatEl?.scrollTo({ top: chatEl.scrollHeight, behavior: "smooth" });
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  // ─── Send message ────────────────────────────────────────────────────────
  async function send() {
    const text = input.trim();
    if (!text || loading) return;

    input = "";
    loading = true;
    errorMsg = "";

    displayMessages = [...displayMessages, { role: "user", text }];
    await scrollToBottom();

    apiHistory = [...apiHistory, { role: "user", content: text }];

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/generate-meso", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { "Authorization": `Bearer ${session.access_token}` } : {})
        },
        body: JSON.stringify({
          messages: apiHistory,
          // Pass full library so server can constrain Claude to only these exercises
          exerciseLibrary
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error ?? `HTTP ${res.status}`);
      }

      const data = await res.json();

      apiHistory = [...apiHistory, { role: "assistant", content: data.content }];

      if (data.proposedPlan) {
        proposedPlan = data.proposedPlan;
        expandedDay = null;

        // Auto-acknowledge the tool use so revision messages work
        apiHistory = [
          ...apiHistory,
          {
            role: "user",
            content: [
              {
                type: "tool_result",
                tool_use_id: data.proposedPlan.id,
                content: "Plan received. Showing preview to user for review."
              }
            ]
          }
        ];

        const assistantText = data.text
          ?? "Here's your mesocycle plan! Tap any workout day to see its exercises, then accept or ask me to revise.";
        displayMessages = [...displayMessages, { role: "assistant", text: assistantText }];
      } else if (data.text) {
        displayMessages = [...displayMessages, { role: "assistant", text: data.text }];
      }

      await scrollToBottom();
      inputEl?.focus();
    } catch (e: any) {
      errorMsg = e.message ?? "Something went wrong. Please try again.";
      apiHistory = apiHistory.slice(0, -1);
    } finally {
      loading = false;
    }
  }

  // ─── Accept plan ─────────────────────────────────────────────────────────
  function acceptPlan() {
    if (!proposedPlan) return;
    dispatch("accept", {
      config: { ...proposedPlan.config, startDate: new Date().toISOString().split("T")[0] },
      schedule: proposedPlan.schedule,
      deloadConfig: proposedPlan.deloadConfig ?? { enabled: false, duration: 1, weeks: [] },
      exercisesPerType: normalizeExercises(proposedPlan.exercisesPerType)
    });
  }

  // ─── Revise plan ─────────────────────────────────────────────────────────
  function revisePlan() {
    proposedPlan = null;
    expandedDay = null;
    input = "Please revise: ";
    inputEl?.focus();
  }

  // ─── Normalize exercises ─────────────────────────────────────────────────
  function normalizeExercises(raw: Record<string, any[]>) {
    const out: Record<string, any[]> = {};
    for (const [type, exercises] of Object.entries(raw)) {
      out[type] = exercises.map((ex) => ({
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

  // ─── Computed plan stats ─────────────────────────────────────────────────
  $: totalWeeks = proposedPlan
    ? proposedPlan.config.totalCycles + (proposedPlan.deloadConfig?.enabled ? proposedPlan.deloadConfig.duration : 0)
    : 0;

  $: liftDays = proposedPlan
    ? proposedPlan.schedule.filter((d: any) => d.type === "lift").length
    : 0;

  $: splitCount = proposedPlan
    ? Object.keys(proposedPlan.exercisesPerType).length
    : 0;
</script>

<!-- ── Layout ─────────────────────────────────────────────────────────────── -->
<div class="flex flex-col h-full">

  <!-- ── Chat thread ──────────────────────────────────────────────────────── -->
  <div bind:this={chatEl} class="flex-1 overflow-y-auto space-y-4 pr-1 pb-4">

    <!-- Greeting bubble -->
    {#if displayMessages.length === 0}
      <div class="flex items-start gap-3">
        <div class="bg-blue-900/40 border border-blue-700/50 p-2 rounded-xl shrink-0">
          <Bot size={20} class="text-blue-400" />
        </div>
        <div class="bg-gray-800 border border-gray-700 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-gray-200 leading-relaxed max-w-[85%]">
          Hey! I'm your AI training coach. Tell me what you're looking for — something like
          <span class="text-blue-300 italic">"6-week PPL for hypertrophy, 5 days a week"</span>
          or just your goals and I'll design the whole block for you.
        </div>
      </div>
    {/if}

    <!-- Messages -->
    {#each displayMessages as msg}
      {#if msg.role === "user"}
        <div class="flex justify-end">
          <div class="bg-blue-600 text-white rounded-2xl rounded-br-sm px-4 py-3 text-sm max-w-[80%] leading-relaxed">
            {msg.text}
          </div>
        </div>
      {:else}
        <div class="flex items-start gap-3">
          <div class="bg-blue-900/40 border border-blue-700/50 p-2 rounded-xl shrink-0">
            <Bot size={20} class="text-blue-400" />
          </div>
          <div class="bg-gray-800 border border-gray-700 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-gray-200 leading-relaxed max-w-[85%] whitespace-pre-wrap">
            {msg.text}
          </div>
        </div>
      {/if}
    {/each}

    <!-- Loading indicator -->
    {#if loading}
      <div class="flex items-start gap-3">
        <div class="bg-blue-900/40 border border-blue-700/50 p-2 rounded-xl shrink-0">
          <Bot size={20} class="text-blue-400" />
        </div>
        <div class="bg-gray-800 border border-gray-700 rounded-2xl rounded-tl-sm px-4 py-3">
          <div class="flex gap-1.5 items-center h-5">
            <span class="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style="animation-delay:0ms"></span>
            <span class="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style="animation-delay:150ms"></span>
            <span class="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style="animation-delay:300ms"></span>
          </div>
        </div>
      </div>
    {/if}

    <!-- Error -->
    {#if errorMsg}
      <div class="text-center text-xs text-red-400 bg-red-900/20 border border-red-800/40 rounded-lg p-3">
        {errorMsg}
      </div>
    {/if}

    <!-- ── Plan Preview Card ─────────────────────────────────────────────── -->
    {#if proposedPlan}
      <div class="bg-gradient-to-br from-gray-800 to-gray-800/60 border border-green-700/50 rounded-2xl overflow-hidden shadow-lg">

        <!-- Card header -->
        <div class="bg-green-900/30 border-b border-green-700/30 px-4 py-3 flex items-center gap-2">
          <Sparkles size={18} class="text-green-400" />
          <span class="font-bold text-green-300 text-sm">Plan Ready</span>
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
              <Calendar size={15} class="text-blue-400 mx-auto mb-1" />
              <div class="text-xl font-black text-white">{totalWeeks}</div>
              <div class="text-[10px] text-gray-500 uppercase font-bold">Weeks</div>
            </div>
            <div class="bg-gray-900/60 rounded-xl p-3 text-center">
              <Dumbbell size={15} class="text-purple-400 mx-auto mb-1" />
              <div class="text-xl font-black text-white">{liftDays}</div>
              <div class="text-[10px] text-gray-500 uppercase font-bold">Days/Wk</div>
            </div>
            <div class="bg-gray-900/60 rounded-xl p-3 text-center">
              <div class="text-xl font-black text-white">{splitCount}</div>
              <div class="text-[10px] text-gray-500 uppercase font-bold">Splits</div>
            </div>
          </div>

          <!-- Weekly schedule — tap any lift day to see its exercises -->
          <div>
            <p class="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">
              Weekly Schedule <span class="normal-case text-gray-600 font-normal">(tap a day to inspect)</span>
            </p>
            <div class="space-y-1.5">
              {#each proposedPlan.schedule as day}
                {#if day.type === "lift" && day.workoutName}
                  {@const exercises = (proposedPlan.exercisesPerType[day.workoutName] ?? []) as any[]}
                  {@const isOpen = expandedDay === day.dayIndex}
                  <div>
                    <button
                      on:click={() => expandedDay = isOpen ? null : day.dayIndex}
                      class="w-full flex items-center justify-between bg-gray-900/60 rounded-xl px-3 py-2.5
                             border transition-colors
                             {isOpen ? 'border-blue-600/60 bg-blue-950/20' : 'border-gray-700/50 hover:border-blue-700/40'}"
                    >
                      <div class="flex items-center gap-2.5">
                        <span class="text-[10px] text-gray-500 font-mono shrink-0 w-9 text-left">Day {day.dayIndex}</span>
                        <span class="text-sm font-bold text-white">{day.workoutName}</span>
                        <span class="text-[10px] text-gray-600">{exercises.length} exercises</span>
                      </div>
                      {#if isOpen}
                        <ChevronUp size={14} class="text-blue-400 shrink-0" />
                      {:else}
                        <ChevronDown size={14} class="text-gray-500 shrink-0" />
                      {/if}
                    </button>

                    {#if isOpen}
                      <div class="mt-1 ml-3 bg-gray-900/50 rounded-xl border border-gray-800/60 overflow-hidden">
                        {#each exercises as ex, i}
                          <div class="flex items-center justify-between px-3 py-2
                                      {i < exercises.length - 1 ? 'border-b border-gray-800/50' : ''}">
                            <span class="text-sm text-gray-200">{ex.name}</span>
                            <span class="text-xs text-gray-500 font-mono shrink-0 ml-2">
                              {ex.startSets}→{ex.endSets} sets
                            </span>
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

          <!-- Action buttons -->
          <div class="flex gap-3 pt-1">
            <button
              on:click={revisePlan}
              class="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl
                     bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm font-bold transition-colors"
            >
              <RotateCcw size={16} /> Revise
            </button>
            <button
              on:click={acceptPlan}
              class="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl
                     bg-green-600 hover:bg-green-500 text-white text-sm font-bold transition-colors"
            >
              <CheckCircle size={16} /> Accept Plan
            </button>
          </div>
        </div>
      </div>
    {/if}
  </div>

  <!-- ── Input row ─────────────────────────────────────────────────────────── -->
  <div class="shrink-0 pt-3 border-t border-gray-700">
    <div class="flex gap-2 items-end">
      <textarea
        bind:this={inputEl}
        bind:value={input}
        on:keydown={handleKeydown}
        placeholder="Describe your ideal training block…"
        rows="2"
        disabled={loading}
        class="flex-1 resize-none bg-gray-800 border border-gray-600 rounded-xl px-4 py-3 text-sm text-white
               placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors disabled:opacity-50"
      ></textarea>
      <button
        on:click={send}
        disabled={loading || !input.trim()}
        class="shrink-0 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500
               text-white p-3 rounded-xl transition-colors"
        aria-label="Send"
      >
        <Send size={18} />
      </button>
    </div>
    <p class="text-[10px] text-gray-600 mt-1.5 text-center">Enter to send · Shift+Enter for newline</p>
  </div>
</div>
