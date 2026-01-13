<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { X } from 'lucide-svelte';
  import { fade, fly } from 'svelte/transition';

  // Allow customization of width (e.g., 'max-w-2xl' for Recap) 
  // and animation direction if needed.
  export let widthClass = 'max-w-sm';
  
  // Optional: Allow hiding the X button if the content has its own close logic
  export let showCloseButton = true;

  const dispatch = createEventDispatcher();

  function close() {
    dispatch('close');
  }

  function handleKeydownkh(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      close();
    }
  }
</script>

<svelte:window on:keydown={handleKeydownkh} />

<div 
  class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" 
  on:click={close}
  transition:fade={{ duration: 200 }}
  role="button"
  tabindex="-1"
>
  <div 
    class="bg-gray-800 rounded-2xl shadow-2xl w-full {widthClass} border border-gray-700 p-6 relative max-h-[90vh] flex flex-col"
    on:click|stopPropagation
    transition:fly={{ y: 20, duration: 300 }}
    role="dialog"
    aria-modal="true"
  >
    
    {#if showCloseButton}
      <button 
        on:click={close} 
        class="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors z-10"
        aria-label="Close modal"
      >
        <X size={20} />
      </button>
    {/if}

    <div class="flex-1 overflow-y-auto min-h-0 scrollbar-hide">
      <slot />
    </div>

  </div>
</div>

<style>
  /* Optional: Hide scrollbar for cleaner look in modals */
  .scrollbar-hide::-webkit-scrollbar {
      display: none;
  }
  .scrollbar-hide {
      -ms-overflow-style: none;
      scrollbar-width: none;
  }
</style>