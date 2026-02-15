<script lang="ts">
  import { Plus, Trash2, Zap } from "lucide-svelte";
  import { createEventDispatcher } from "svelte";

  export let typeName: string;
  export let typeIndex: number;
  export let activeMuscles: string[] = [];
  export let exercises: any[] = [];
  export let baseLibrary: any[] = [];
  export let activeSearch: { t: number, e: number } | null = null;

  const dispatch = createEventDispatcher();

  function addExercise() {
      exercises = [...exercises, { name: "", startSets: 3, endSets: 5, isDropset: false }];
  }

  function removeExercise(index: number) {
      const updated = [...exercises];
      updated.splice(index, 1);
      exercises = updated;
  }

  function selectExercise(exIndex: number, name: string) {
      exercises[exIndex].name = name;
      activeSearch = null;
  }
</script>

<div class="bg-gray-800 border border-gray-700 rounded-xl overflow-visible relative">
    <div class="bg-gray-700/50 p-3 border-b border-gray-700 grid grid-cols-[20px_1fr_50px_50px_20px_20px] gap-2 items-center">
        <span></span> 
        <div>
            <h3 class="font-bold text-white text-sm">{typeName}</h3>
            <p class="text-[10px] text-gray-400">{activeMuscles.length > 0 ? activeMuscles.join(', ') : 'All Exercises'}</p>
        </div>
        <span class="text-center text-[10px] font-bold uppercase text-gray-400 tracking-wider">Start</span>
        <span class="text-center text-[10px] font-bold uppercase text-gray-400 tracking-wider">End</span>
        <span></span><span></span> 
    </div>

    <div class="p-3 space-y-2">
        {#if exercises.length === 0}
            <div class="text-center py-4 text-gray-500 text-sm italic">No exercises added yet.</div>
        {/if}

        {#each exercises as ex, exIdx}
            {@const searchResults = ex.name.length > 0 ? baseLibrary.filter(item => item.name.toLowerCase().includes(ex.name.toLowerCase())).slice(0, 6) : baseLibrary.slice(0, 50)}

            <div class="grid grid-cols-[20px_1fr_50px_50px_20px_20px] gap-2 items-center">
                <span class="text-gray-500 text-xs font-mono text-center">{exIdx + 1}</span>
                <div class="relative w-full">
                    <input 
                        type="text" 
                        placeholder="Search..." 
                        bind:value={ex.name}
                        on:focus={() => activeSearch = { t: typeIndex, e: exIdx }}
                        class="w-full bg-gray-900 border border-gray-600 rounded p-2 text-sm text-white focus:border-blue-500 outline-none placeholder-gray-600"
                    />

                    {#if activeSearch?.t === typeIndex && activeSearch?.e === exIdx}
                        <div class="absolute top-full left-0 min-w-[300px] max-w-[400px] bg-gray-800 border border-gray-600 rounded-lg mt-1 z-50 shadow-2xl overflow-y-auto max-h-60 animate-fade-in custom-scrollbar">
                            {#each searchResults as item}
                                <button 
                                    on:mousedown={() => selectExercise(exIdx, item.name)}
                                    class="w-full flex justify-between items-center p-3 hover:bg-gray-700 text-left transition-colors border-b border-gray-700 last:border-0 group"
                                >
                                    <span class="text-sm text-gray-200 group-hover:text-white font-medium pr-4 leading-snug">{item.name}</span>
                                    <span class="shrink-0 text-[10px] uppercase tracking-wider font-bold bg-gray-900 text-gray-500 px-2 py-1 rounded border border-gray-700 whitespace-nowrap group-hover:border-gray-500 group-hover:text-gray-300 transition-colors">
                                        {item.muscle_group}
                                    </span>
                                </button>
                            {/each}

                            {#if ex.name.trim().length > 0 && !searchResults.some(r => r.name.toLowerCase() === ex.name.toLowerCase())}
                                <button 
                                    on:mousedown={() => dispatch('triggerCustom', { name: ex.name, t: typeIndex, e: exIdx })}
                                    class="w-full p-3 bg-blue-900/30 text-blue-300 hover:bg-blue-900/50 hover:text-white text-left text-sm font-bold flex items-center gap-2"
                                >
                                    <Plus size={16} /> Create "{ex.name}"
                                </button>
                            {/if}
                        </div>
                    {/if}
                </div>

                <input type="number" bind:value={ex.startSets} class="w-full bg-gray-900 border border-gray-600 rounded p-2 text-center text-sm text-white focus:border-blue-500 outline-none" />
                <input type="number" bind:value={ex.endSets} class="w-full bg-gray-900 border border-gray-600 rounded p-2 text-center text-sm text-white focus:border-blue-500 outline-none" />
                
                <div class="flex justify-center">
                    <button on:click={() => ex.isDropset = !ex.isDropset} class="p-2 rounded transition-colors {ex.isDropset ? 'text-yellow-400 bg-yellow-400/10' : 'text-gray-600 hover:text-gray-400'}">
                        <Zap size={16} fill={ex.isDropset ? "currentColor" : "none"} />
                    </button>
                </div>
                <button on:click={() => removeExercise(exIdx)} class="flex items-center justify-center text-gray-500 hover:text-red-500 transition-colors h-full"><Trash2 size={16} /></button>
            </div>
        {/each}
        <button on:click={addExercise} class="w-full py-2 border border-dashed border-gray-600 text-gray-400 rounded-lg text-sm hover:border-yellow-500 hover:text-yellow-400 transition-colors flex items-center justify-center gap-2 mt-2">
            <Plus size={16} /> Add Exercise
        </button>
    </div>
</div>

<style>
    .custom-scrollbar::-webkit-scrollbar { width: 4px; }
    .custom-scrollbar::-webkit-scrollbar-track { background: #111827; }
    .custom-scrollbar::-webkit-scrollbar-thumb { background: #374151; border-radius: 4px; }
</style>