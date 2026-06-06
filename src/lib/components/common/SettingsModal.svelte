<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import Modal from "./Modal.svelte";
  import { settings } from "$lib/stores/settings";
  import { Timer, Bell } from "lucide-svelte";

  const dispatch = createEventDispatcher();

  // Local copy so changes only commit when the modal is open
  let timerEnabled = $settings.timerEnabled;
  let restDuration = $settings.restDuration;

  const PRESETS = [60, 90, 120, 150, 180];

  function step(delta: number) {
    restDuration = Math.min(600, Math.max(15, restDuration + delta));
  }

  function applyPreset(s: number) {
    restDuration = s;
  }

  function save() {
    settings.set({ timerEnabled, restDuration });
    dispatch('close');
  }

  function fmt(s: number) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0
      ? sec === 0 ? `${m}m` : `${m}m ${sec}s`
      : `${s}s`;
  }
</script>

<Modal widthClass="max-w-sm" on:close={() => dispatch('close')}>
  <h2 class="text-xl font-bold text-white mb-6 flex items-center gap-2">
    Settings
  </h2>

  <div class="space-y-6">

    <!-- ── Rest Timer toggle ─────────────────────────────────────────── -->
    <div class="bg-gray-900/60 rounded-xl p-4 border border-gray-700">
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

        <!-- Toggle switch -->
        <button
          on:click={() => timerEnabled = !timerEnabled}
          class="relative w-11 h-6 rounded-full transition-colors {timerEnabled ? 'bg-blue-600' : 'bg-gray-700'}"
          aria-label="Toggle rest timer"
        >
          <span
            class="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform
                   {timerEnabled ? 'translate-x-5' : 'translate-x-0'}"
          ></span>
        </button>
      </div>
    </div>

    <!-- ── Rest Duration ─────────────────────────────────────────────── -->
    <div class="bg-gray-900/60 rounded-xl p-4 border border-gray-700 {!timerEnabled ? 'opacity-40 pointer-events-none' : ''}">
      <div class="flex items-center gap-3 mb-4">
        <div class="bg-purple-900/40 p-2 rounded-lg">
          <Bell size={18} class="text-purple-400" />
        </div>
        <div>
          <p class="text-sm font-bold text-white">Default Rest Time</p>
          <p class="text-xs text-gray-500">Applied each time the timer starts</p>
        </div>
      </div>

      <!-- Big duration display + stepper -->
      <div class="flex items-center justify-between mb-4">
        <button
          on:click={() => step(-15)}
          class="w-10 h-10 rounded-xl bg-gray-800 border border-gray-700 text-gray-300 text-xl font-bold
                 hover:bg-gray-700 hover:text-white transition-colors flex items-center justify-center"
        >−</button>

        <span class="text-3xl font-black text-white tabular-nums">{fmt(restDuration)}</span>

        <button
          on:click={() => step(15)}
          class="w-10 h-10 rounded-xl bg-gray-800 border border-gray-700 text-gray-300 text-xl font-bold
                 hover:bg-gray-700 hover:text-white transition-colors flex items-center justify-center"
        >+</button>
      </div>

      <!-- Preset pills -->
      <div class="flex gap-2 justify-center flex-wrap">
        {#each PRESETS as p}
          <button
            on:click={() => applyPreset(p)}
            class="px-3 py-1.5 rounded-full text-xs font-bold transition-all border
                   {restDuration === p
                       ? 'bg-blue-600 border-blue-500 text-white'
                       : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500 hover:text-white'}"
          >
            {fmt(p)}
          </button>
        {/each}
      </div>
    </div>

  </div>

  <!-- ── Actions ───────────────────────────────────────────────────── -->
  <div class="flex gap-3 mt-8">
    <button
      on:click={() => dispatch('close')}
      class="flex-1 py-3 rounded-xl bg-gray-700 hover:bg-gray-600 text-white font-medium transition-colors"
    >
      Cancel
    </button>
    <button
      on:click={save}
      class="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition-colors"
    >
      Save
    </button>
  </div>
</Modal>
