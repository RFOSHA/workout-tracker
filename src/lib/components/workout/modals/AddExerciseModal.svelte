<script lang="ts">
  import Modal from "$lib/components/common/Modal.svelte";
  import { Search, CheckCircle, Plus, Link } from "lucide-svelte";
  import { createEventDispatcher } from "svelte";

  export let exerciseLibrary: any[] = [];

  let searchQuery = "";
  let partnerQuery = "";
  let targetSets = 3;
  let addToFuture = false;
  let isSuperset = false;

  // Which search box is active (drives dropdown visibility)
  let primaryFocused = false;
  let partnerFocused = false;

  const dispatch = createEventDispatcher();

  $: filteredPrimary = searchQuery.trim().length > 0
      ? exerciseLibrary.filter(ex => ex.name.toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 8)
      : [];

  $: filteredPartner = partnerQuery.trim().length > 0
      ? exerciseLibrary
          .filter(ex => ex.name.toLowerCase().includes(partnerQuery.toLowerCase()) && ex.name !== searchQuery)
          .slice(0, 8)
      : [];

  $: canAdd = searchQuery.trim() && (!isSuperset || partnerQuery.trim());

  function handleAdd() {
      if (!canAdd) return;
      dispatch('add', {
          exerciseName: searchQuery.trim(),
          targetSets,
          addToFuture: isSuperset ? false : addToFuture,
          supersetPartner: isSuperset ? partnerQuery.trim() : undefined
      });
      searchQuery = "";
      partnerQuery = "";
      addToFuture = false;
      isSuperset = false;
  }
</script>

<Modal on:close={() => dispatch('close')}>
    <div class="flex items-center justify-between mb-4">
        <h3 class="text-xl font-bold text-white">Add Exercise</h3>
        <!-- Superset toggle -->
        <button
            on:click={() => { isSuperset = !isSuperset; partnerQuery = ""; }}
            class="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border transition-all
                   {isSuperset
                       ? 'bg-orange-900/30 border-orange-600/60 text-orange-400'
                       : 'bg-gray-800 border-gray-600 text-gray-400 hover:border-gray-400 hover:text-white'}"
        >
            <Link size={13} />
            Superset
        </button>
    </div>

    <!-- ── Primary exercise ──────────────────────────────────────────────── -->
    {#if isSuperset}
        <p class="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Exercise 1</p>
    {/if}

    <div class="relative mb-1">
        <Search size={16} class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
        <input
            type="text"
            bind:value={searchQuery}
            on:focus={() => primaryFocused = true}
            on:blur={() => setTimeout(() => primaryFocused = false, 150)}
            placeholder="Search library…"
            class="w-full bg-gray-900 border border-gray-700 p-3 pl-10 rounded-lg text-white
                   focus:border-blue-500 outline-none transition-colors"
            autofocus
        />
        {#if primaryFocused && filteredPrimary.length > 0}
            <div class="absolute top-full left-0 right-0 bg-gray-800 border border-gray-600 rounded-lg mt-1 z-50
                        shadow-2xl overflow-y-auto max-h-48 custom-scrollbar">
                {#each filteredPrimary as item}
                    <button
                        on:mousedown|preventDefault={() => { searchQuery = item.name; primaryFocused = false; }}
                        class="w-full flex justify-between items-center p-3 hover:bg-gray-700 text-left
                               border-b border-gray-700 last:border-0 transition-colors group"
                    >
                        <span class="text-sm text-gray-200 group-hover:text-white font-medium">{item.name}</span>
                        <span class="text-[10px] uppercase font-bold tracking-wider text-gray-500 bg-gray-900
                                     border border-gray-700 px-2 py-0.5 rounded-full shrink-0 ml-2">
                            {item.muscle_group}
                        </span>
                    </button>
                {/each}
            </div>
        {/if}
    </div>

    {#if searchQuery.trim() && filteredPrimary.length === 0 && !exerciseLibrary.some(e => e.name === searchQuery.trim())}
        <div class="text-center py-2 text-sm text-gray-500 italic mb-2">
            <button on:click={() => dispatch('openCustomCreator', { name: searchQuery })} class="text-blue-400 hover:underline font-bold">
                Create "{searchQuery}"?
            </button>
        </div>
    {/if}

    <!-- ── Superset connector + partner ─────────────────────────────────── -->
    {#if isSuperset}
        <div class="flex items-center gap-2 my-2 px-1">
            <div class="flex flex-col items-center shrink-0">
                <div class="w-px h-3 bg-orange-600/50"></div>
                <span class="text-[9px] font-black text-orange-500 bg-orange-900/20 border border-orange-700/40
                             rounded-sm px-1.5 py-0.5 leading-tight">SS</span>
                <div class="w-px h-3 bg-orange-600/50"></div>
            </div>
            <div class="flex-1 h-px bg-orange-800/20"></div>
        </div>

        <p class="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Exercise 2</p>

        <div class="relative mb-4">
            <Search size={16} class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
            <input
                type="text"
                bind:value={partnerQuery}
                on:focus={() => partnerFocused = true}
                on:blur={() => setTimeout(() => partnerFocused = false, 150)}
                placeholder="Search partner exercise…"
                class="w-full bg-gray-900 border border-gray-700 p-3 pl-10 rounded-lg text-white
                       focus:border-orange-500 outline-none transition-colors"
            />
            {#if partnerFocused && filteredPartner.length > 0}
                <div class="absolute top-full left-0 right-0 bg-gray-800 border border-gray-600 rounded-lg mt-1 z-50
                            shadow-2xl overflow-y-auto max-h-48 custom-scrollbar">
                    {#each filteredPartner as item}
                        <button
                            on:mousedown|preventDefault={() => { partnerQuery = item.name; partnerFocused = false; }}
                            class="w-full flex justify-between items-center p-3 hover:bg-gray-700 text-left
                                   border-b border-gray-700 last:border-0 transition-colors group"
                        >
                            <span class="text-sm text-gray-200 group-hover:text-white font-medium">{item.name}</span>
                            <span class="text-[10px] uppercase font-bold tracking-wider text-gray-500 bg-gray-900
                                         border border-gray-700 px-2 py-0.5 rounded-full shrink-0 ml-2">
                                {item.muscle_group}
                            </span>
                        </button>
                    {/each}
                </div>
            {/if}
        </div>
    {:else}
        <div class="mb-4"></div>
    {/if}

    <!-- ── Options ───────────────────────────────────────────────────────── -->
    <div class="pt-4 border-t border-gray-700/50 space-y-4 mb-6">
        <div class="flex items-center justify-between">
            <span class="text-sm text-gray-400 font-medium">Target Sets</span>
            <div class="flex items-center gap-3 bg-gray-900 rounded-lg p-1 border border-gray-700">
                <button class="px-3 text-gray-400 hover:text-white" on:click={() => targetSets = Math.max(1, targetSets - 1)}>-</button>
                <span class="text-white font-bold w-4 text-center">{targetSets}</span>
                <button class="px-3 text-gray-400 hover:text-white" on:click={() => targetSets++}>+</button>
            </div>
        </div>

        {#if !isSuperset}
            <label class="flex items-center gap-3 cursor-pointer group">
                <div class="relative flex items-center">
                    <input type="checkbox" bind:checked={addToFuture} class="peer sr-only">
                    <div class="w-5 h-5 border-2 border-gray-600 rounded bg-gray-900 peer-checked:bg-blue-600
                                peer-checked:border-blue-600 transition-all"></div>
                    <CheckCircle size={12} class="absolute text-white opacity-0 peer-checked:opacity-100
                                                  top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
                <span class="text-sm text-gray-400 group-hover:text-gray-300 transition-colors">
                    Add to remaining weeks?
                </span>
            </label>
        {/if}
    </div>

    <!-- ── Actions ───────────────────────────────────────────────────────── -->
    <div class="flex gap-3 mt-auto pt-2 border-t border-gray-700">
        <button on:click={() => dispatch('close')} class="flex-1 bg-gray-700 hover:bg-gray-600 py-3 rounded-lg font-medium transition-colors text-white">
            Cancel
        </button>
        <button
            on:click={handleAdd}
            disabled={!canAdd}
            class="flex-1 py-3 rounded-lg font-bold shadow-lg transition-all text-white flex items-center justify-center gap-2
                   {isSuperset
                       ? 'bg-orange-600 hover:bg-orange-500 disabled:bg-gray-700 disabled:text-gray-500'
                       : 'bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500'}"
        >
            <Plus size={18} /> {isSuperset ? 'Add Superset' : 'Add'}
        </button>
    </div>
</Modal>
