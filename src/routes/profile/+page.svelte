<script lang="ts">
  import { supabase } from "$lib/supabaseClient";
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  import { settings } from "$lib/stores/settings";
  import { ArrowLeft, Timer, Bell, User, LogOut, Target } from "lucide-svelte";
  import type { Session } from "@supabase/supabase-js";

  let session: Session | null = null;

  // Local copies — auto-save on every change
  let timerEnabled = $settings.timerEnabled;
  let restDuration = $settings.restDuration;
  let rirEnabled   = $settings.rirEnabled;

  let saved = false;
  let saveTimer: ReturnType<typeof setTimeout>;

  onMount(async () => {
    const { data } = await supabase.auth.getSession();
    session = data.session;
    if (!session) goto('/');
  });

  const PRESETS = [60, 90, 120, 150, 180];

  function autoSave() {
    settings.set({ timerEnabled, restDuration, rirEnabled });
    saved = true;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => (saved = false), 1800);
  }

  function stepDuration(delta: number) {
    restDuration = Math.min(600, Math.max(15, restDuration + delta));
    autoSave();
  }

  function fmt(s: number) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? (sec === 0 ? `${m}m` : `${m}m ${sec}s`) : `${s}s`;
  }

  async function signOut() {
    await supabase.auth.signOut();
    goto('/');
  }
</script>

<div class="min-h-screen bg-gray-900 text-white pb-16">

  <!-- Header -->
  <div class="bg-gray-800 px-4 py-4 border-b border-gray-700 sticky top-0 z-40 shadow-md">
    <div class="max-w-lg mx-auto flex items-center gap-3">
      <a href="/" class="text-gray-400 hover:text-white transition-colors p-1 -ml-1">
        <ArrowLeft size={22} />
      </a>
      <h1 class="text-xl font-bold text-white">Profile & Settings</h1>
      {#if saved}
        <span class="ml-auto text-xs font-bold text-green-400 animate-pulse">Saved ✓</span>
      {/if}
    </div>
  </div>

  <div class="max-w-lg mx-auto px-4 py-6 space-y-6">

    <!-- ── Account ──────────────────────────────────────────────────── -->
    <div>
      <h2 class="text-xs font-black uppercase tracking-widest text-gray-500 mb-3 px-1">Account</h2>
      <div class="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <div class="flex items-center gap-3 p-4 border-b border-gray-700">
          <div class="bg-blue-900/50 p-2.5 rounded-full">
            <User size={18} class="text-blue-400" />
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-xs text-gray-500 font-medium">Signed in as</p>
            <p class="text-sm font-bold text-white truncate">{session?.user?.email ?? '...'}</p>
          </div>
        </div>
        <button
          on:click={signOut}
          class="w-full flex items-center gap-3 p-4 text-red-400 hover:bg-gray-700/60 transition-colors text-sm font-bold"
        >
          <LogOut size={16} />
          Sign Out
        </button>
      </div>
    </div>

    <!-- ── Workout Preferences ───────────────────────────────────────── -->
    <div>
      <h2 class="text-xs font-black uppercase tracking-widest text-gray-500 mb-3 px-1">Workout Preferences</h2>
      <div class="space-y-3">

        <!-- RIR Toggle -->
        <div class="bg-gray-800 rounded-xl border border-gray-700 p-4">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="bg-orange-900/40 p-2 rounded-lg">
                <Target size={18} class="text-orange-400" />
              </div>
              <div>
                <p class="text-sm font-bold text-white">Reps in Reserve (RIR)</p>
                <p class="text-xs text-gray-500">Log effort level after each set</p>
              </div>
            </div>
            <button
              on:click={() => { rirEnabled = !rirEnabled; autoSave(); }}
              class="relative w-11 h-6 rounded-full transition-colors {rirEnabled ? 'bg-orange-600' : 'bg-gray-700'}"
              aria-label="Toggle RIR"
            >
              <span class="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform
                           {rirEnabled ? 'translate-x-5' : 'translate-x-0'}"></span>
            </button>
          </div>
        </div>

        <!-- Rest Timer Toggle -->
        <div class="bg-gray-800 rounded-xl border border-gray-700 p-4">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="bg-blue-900/40 p-2 rounded-lg">
                <Timer size={18} class="text-blue-400" />
              </div>
              <div>
                <p class="text-sm font-bold text-white">Rest Timer</p>
                <p class="text-xs text-gray-500">Auto-starts after logging RIR</p>
              </div>
            </div>
            <button
              on:click={() => { timerEnabled = !timerEnabled; autoSave(); }}
              class="relative w-11 h-6 rounded-full transition-colors {timerEnabled ? 'bg-blue-600' : 'bg-gray-700'}"
              aria-label="Toggle rest timer"
            >
              <span class="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform
                           {timerEnabled ? 'translate-x-5' : 'translate-x-0'}"></span>
            </button>
          </div>
        </div>

        <!-- Rest Duration — grayed out when timer is OFF -->
        <div class="bg-gray-800 rounded-xl border border-gray-700 p-4 transition-opacity {!timerEnabled ? 'opacity-40 pointer-events-none' : ''}">
          <div class="flex items-center gap-3 mb-4">
            <div class="bg-purple-900/40 p-2 rounded-lg">
              <Bell size={18} class="text-purple-400" />
            </div>
            <div>
              <p class="text-sm font-bold text-white">Default Rest Time</p>
              <p class="text-xs text-gray-500">Applied each time the timer starts</p>
            </div>
          </div>

          <!-- Stepper -->
          <div class="flex items-center justify-between mb-4">
            <button
              on:click={() => stepDuration(-15)}
              class="w-10 h-10 rounded-xl bg-gray-900 border border-gray-700 text-gray-300 text-xl font-bold
                     hover:bg-gray-700 hover:text-white transition-colors flex items-center justify-center"
            >−</button>

            <span class="text-3xl font-black text-white tabular-nums">{fmt(restDuration)}</span>

            <button
              on:click={() => stepDuration(15)}
              class="w-10 h-10 rounded-xl bg-gray-900 border border-gray-700 text-gray-300 text-xl font-bold
                     hover:bg-gray-700 hover:text-white transition-colors flex items-center justify-center"
            >+</button>
          </div>

          <!-- Preset pills -->
          <div class="flex gap-2 justify-center flex-wrap">
            {#each PRESETS as p}
              <button
                on:click={() => { restDuration = p; autoSave(); }}
                class="px-3 py-1.5 rounded-full text-xs font-bold transition-all border
                       {restDuration === p
                           ? 'bg-blue-600 border-blue-500 text-white'
                           : 'bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-500 hover:text-white'}"
              >{fmt(p)}</button>
            {/each}
          </div>
        </div>

      </div>
    </div>

  </div>
</div>
