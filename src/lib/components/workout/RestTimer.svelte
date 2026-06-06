<script lang="ts">
  import { onDestroy, createEventDispatcher } from 'svelte';
  import { fly } from 'svelte/transition';
  import { Timer, X, Plus, Minus } from 'lucide-svelte';

  export let duration: number = 90;
  // Increment this from the parent to restart the countdown
  export let restartKey: number = 0;

  const dispatch = createEventDispatcher();

  let remaining = duration;
  let intervalId: ReturnType<typeof setInterval> | null = null;
  let isComplete = false;

  const CIRCUMFERENCE = 2 * Math.PI * 36; // r=36

  $: progress = duration > 0 ? remaining / duration : 0;
  $: dashOffset = CIRCUMFERENCE * (1 - progress);
  $: minutes = Math.floor(remaining / 60);
  $: secs = remaining % 60;
  $: timeLabel = `${minutes}:${secs.toString().padStart(2, '0')}`;

  // Restart whenever restartKey changes (fires on mount too, which is correct)
  $: restartKey, restart();

  function restart() {
    remaining = duration;
    isComplete = false;
    startCountdown();
  }

  function startCountdown() {
    if (intervalId) clearInterval(intervalId);
    intervalId = setInterval(() => {
      remaining = Math.max(0, remaining - 1);
      if (remaining === 0) {
        clearInterval(intervalId!);
        intervalId = null;
        isComplete = true;
        playBeep();
      }
    }, 1000);
  }

  function adjustTime(delta: number) {
    remaining = Math.max(0, Math.min(remaining + delta, 600));
    if (remaining > 0 && isComplete) {
      isComplete = false;
      startCountdown();
    }
  }

  function dismiss() {
    if (intervalId) clearInterval(intervalId);
    intervalId = null;
    dispatch('dismiss');
  }

  function playBeep() {
    try {
      const ctx = new AudioContext();
      [0, 0.22, 0.44].forEach((offset) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.25, ctx.currentTime + offset);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + offset + 0.18);
        osc.start(ctx.currentTime + offset);
        osc.stop(ctx.currentTime + offset + 0.2);
      });
    } catch {
      // AudioContext unavailable (e.g. SSR)
    }
  }

  onDestroy(() => {
    if (intervalId) clearInterval(intervalId);
  });
</script>

<div
  transition:fly={{ y: 100, duration: 280 }}
  class="fixed bottom-24 left-0 right-0 z-[60] bg-gray-800 border border-gray-700 rounded-t-xl shadow-2xl mx-2"
>
  <div class="max-w-3xl mx-auto px-4 py-3 flex items-center gap-4">

    <!-- Circular progress ring -->
    <div class="relative flex-shrink-0 w-14 h-14">
      <svg class="w-14 h-14 -rotate-90" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r="36" fill="none" stroke="#374151" stroke-width="6" />
        <circle
          cx="40" cy="40" r="36" fill="none"
          stroke={isComplete ? '#22c55e' : '#3b82f6'}
          stroke-width="6"
          stroke-linecap="round"
          stroke-dasharray={CIRCUMFERENCE}
          stroke-dashoffset={dashOffset}
          class="transition-all duration-1000 ease-linear"
        />
      </svg>
      <div class="absolute inset-0 flex items-center justify-center">
        <Timer size={18} class={isComplete ? 'text-green-400' : 'text-blue-400'} />
      </div>
    </div>

    <!-- Countdown display -->
    <div class="flex-1 text-center">
      <div class="text-3xl font-mono font-bold {isComplete ? 'text-green-400' : 'text-white'}">
        {timeLabel}
      </div>
      <div class="text-xs text-gray-500 uppercase tracking-widest mt-0.5">
        {isComplete ? 'Rest Complete' : 'Rest Timer'}
      </div>
    </div>

    <!-- Controls -->
    <div class="flex items-center gap-2 flex-shrink-0">
      <button
        on:click={() => adjustTime(-15)}
        class="w-8 h-8 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center text-gray-300 hover:text-white transition-colors"
        aria-label="Subtract 15 seconds"
      >
        <Minus size={14} />
      </button>
      <button
        on:click={() => adjustTime(15)}
        class="w-8 h-8 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center text-gray-300 hover:text-white transition-colors"
        aria-label="Add 15 seconds"
      >
        <Plus size={14} />
      </button>
      <button
        on:click={dismiss}
        class="w-8 h-8 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center text-gray-400 hover:text-white transition-colors ml-1"
        aria-label="Dismiss timer"
      >
        <X size={14} />
      </button>
    </div>

  </div>
</div>
