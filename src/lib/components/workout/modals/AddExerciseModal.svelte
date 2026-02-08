<script lang="ts">
  import Modal from "$lib/components/common/Modal.svelte";
  import { Search, CheckCircle, Plus } from "lucide-svelte";
  import { createEventDispatcher } from "svelte";

  export let exerciseLibrary: any[] = [];
  
  // Internal State
  let searchQuery = "";
  let targetSets = 3;
  let addToFuture = false;

  const dispatch = createEventDispatcher();

  // Reactive Filtering
  $: filteredLibrary = searchQuery.trim().length > 0 
      ? exerciseLibrary.filter(ex => ex.name.toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 10)
      : [];

  function selectExercise(name: string) {
      searchQuery = name;
  }

  function handleAdd() {
      if (!searchQuery.trim()) return;
      
      dispatch('add', {
          exerciseName: searchQuery,
          targetSets,
          addToFuture
      });
      // Clear after add
      searchQuery = "";
      addToFuture = false;
  }

  function triggerCustom() {
      dispatch('openCustomCreator', { name: searchQuery });
  }
</script>

<Modal on:close={() => dispatch('close')}>
    <h3 class="text-xl font-bold mb-4 text-white">Add Exercise</h3> 
    
    <div class="relative mb-4">
        <Search size={16} class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
        <input 
            type="text" 
            bind:value={searchQuery} 
            placeholder="Search Library..." 
            class="w-full bg-gray-900 border border-gray-700 p-3 pl-10 rounded-lg text-white focus:border-blue-500 outline-none transition-colors" 
            autofocus
        />
    </div>

    {#if filteredLibrary.length > 0}
        <div class="flex-1 overflow-y-auto mb-4 space-y-1 border border-gray-800 rounded-lg p-1 bg-gray-900/50 min-h-0 max-h-60 custom-scrollbar">
            {#each filteredLibrary as item}
                <button 
                    on:click={() => selectExercise(item.name)}
                    class="w-full text-left p-3 rounded-md hover:bg-gray-700/50 flex justify-between items-center transition-colors group"
                >
                    <span class="text-sm text-gray-200 group-hover:text-white font-medium">{item.name}</span>
                    <span class="text-[10px] uppercase font-bold tracking-wider text-gray-500 bg-gray-800 border border-gray-700 px-2 py-0.5 rounded-full group-hover:border-gray-500 group-hover:text-gray-400">
                        {item.muscle_group}
                    </span>
                </button>
            {/each}
        </div>
    {:else if searchQuery.trim().length > 0}
        <div class="text-center py-4 text-sm text-gray-500 italic mb-4">
            No matches found.
            <button on:click={triggerCustom} class="text-blue-400 hover:underline block mx-auto mt-1 font-bold">
                Create "{searchQuery}"?
            </button>
        </div>
    {/if}

    <div class="mb-6 pt-4 border-t border-gray-700/50 space-y-4">
        <div class="flex items-center justify-between">
            <span class="text-sm text-gray-400 font-medium">Target Sets</span>
            <div class="flex items-center gap-3 bg-gray-900 rounded-lg p-1 border border-gray-700">
                <button class="px-3 text-gray-400 hover:text-white" on:click={() => targetSets = Math.max(1, targetSets - 1)}>-</button>
                <span class="text-white font-bold w-4 text-center">{targetSets}</span>
                <button class="px-3 text-gray-400 hover:text-white" on:click={() => targetSets++}>+</button>
            </div>
        </div>

        <label class="flex items-center gap-3 cursor-pointer group">
            <div class="relative flex items-center">
                <input type="checkbox" bind:checked={addToFuture} class="peer sr-only">
                <div class="w-5 h-5 border-2 border-gray-600 rounded bg-gray-900 peer-checked:bg-blue-600 peer-checked:border-blue-600 transition-all"></div>
                <CheckCircle size={12} class="absolute text-white opacity-0 peer-checked:opacity-100 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
            <span class="text-sm text-gray-400 group-hover:text-gray-300 transition-colors">
                Add to remaining weeks?
            </span>
        </label>
    </div>

    <div class="flex gap-3 mt-auto pt-2 border-t border-gray-700">
        <button on:click={() => dispatch('close')} class="flex-1 bg-gray-700 hover:bg-gray-600 py-3 rounded-lg font-medium transition-colors text-white">
            Cancel
        </button>
        <button on:click={handleAdd} class="flex-1 bg-blue-600 hover:bg-blue-500 py-3 rounded-lg font-bold shadow-lg transition-transform active:scale-95 text-white flex items-center justify-center gap-2">
            <Plus size={18} /> Add
        </button>
    </div> 
</Modal>

<style>
    .custom-scrollbar::-webkit-scrollbar { width: 4px; }
    .custom-scrollbar::-webkit-scrollbar-track { background: #111827; }
    .custom-scrollbar::-webkit-scrollbar-thumb { background: #374151; border-radius: 4px; }
</style>