<script lang="ts">
  import Modal from "$lib/components/common/Modal.svelte";
  import { History, Trash2, ChevronRight } from "lucide-svelte";
  import { createEventDispatcher } from "svelte";

  export let allMesocycles: any[] = [];
  export let currentMesocycleId: string | null = null;

  const dispatch = createEventDispatcher();

  function formatDate(dateStr: string) { 
      return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  }
</script>

<Modal widthClass="max-w-sm" on:close={() => dispatch('close')}>
    <div class="flex justify-between items-center mb-8">
        <h2 class="text-xl font-bold flex items-center gap-2">
            <History size={20} class="text-blue-400"/> Program History
        </h2>
    </div>
    <div class="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-1 max-h-[60vh]">
        {#each allMesocycles as m}
            <div 
                role="button"
                tabindex="0"
                on:click={() => dispatch('select', m)}
                on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && dispatch('select', m)}
                class="w-full text-left p-4 rounded-xl border transition-all group relative cursor-pointer outline-none focus:ring-2 focus:ring-blue-500
                {currentMesocycleId === m.id ? 'bg-blue-900/20 border-blue-500/50' : 'bg-gray-800 border-gray-700 hover:border-gray-500'}"
            >
                <div class="flex justify-between items-start">
                    <div>
                        <span class="block font-bold text-white mb-1 group-hover:text-blue-400 transition-colors">{m.name}</span>
                        <span class="text-xs text-gray-500 font-mono">
                            {formatDate(m.start_date)} - {formatDate(m.end_date)}
                        </span>
                    </div>
                    <div class="flex items-center gap-2">
                        {#if currentMesocycleId === m.id}
                            <div class="bg-blue-500 w-2 h-2 rounded-full"></div>
                        {/if}
                        <button 
                            on:click|stopPropagation={(e) => dispatch('delete', { id: m.id, event: e })}
                            class="text-gray-600 hover:text-red-500 p-1.5 rounded-md hover:bg-gray-700 transition-colors z-10"
                            title="Delete Plan"
                        >
                            <Trash2 size={16} />
                        </button>
                    </div>
                </div>
                {#if currentMesocycleId !== m.id}
                    <ChevronRight size={16} class="absolute right-12 top-1/2 -translate-y-1/2 text-gray-600 opacity-0 group-hover:opacity-100 transition-all" />
                {/if}
            </div>
        {/each}
        <a href="/mesocycle/new" class="block w-full text-center py-4 mt-8 border-2 border-dashed border-gray-700 rounded-xl text-gray-500 hover:text-white hover:border-gray-500 transition-all">
            + Start New Cycle
        </a>
    </div>
</Modal>

<style>
    .custom-scrollbar::-webkit-scrollbar { width: 4px; }
    .custom-scrollbar::-webkit-scrollbar-track { background: #111827; }
    .custom-scrollbar::-webkit-scrollbar-thumb { background: #374151; border-radius: 4px; }
</style>