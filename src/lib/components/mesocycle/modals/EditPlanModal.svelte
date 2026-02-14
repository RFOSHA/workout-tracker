<script lang="ts">
  import Modal from "$lib/components/common/Modal.svelte";
  import { Pencil, Trash2, Zap, Plus, ArrowUp, ArrowDown } from "lucide-svelte";
  import { createEventDispatcher } from "svelte";

  export let planTemplates: Record<string, any[]> = {};
  export let fullLibrary: any[] = [];
  export let savingPlan = false;

  let activeSearch: { type: string, index: number } | null = null;
  const dispatch = createEventDispatcher();

  // Template manipulation logic
  function addExercise(typeName: string) {
    planTemplates[typeName] = [...planTemplates[typeName], { name: "", startSets: 3, isDropset: false }];
  }

  function removeExercise(typeName: string, index: number) {
    const updated = [...planTemplates[typeName]];
    updated.splice(index, 1);
    planTemplates[typeName] = updated;
  }

  function moveExercise(typeName: string, index: number, direction: 'up' | 'down') {
    const list = [...planTemplates[typeName]];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= list.length) return;
    
    [list[index], list[newIndex]] = [list[newIndex], list[index]];
    planTemplates[typeName] = list;
  }

  function selectExercise(typeName: string, exIndex: number, name: string) {
    planTemplates[typeName][exIndex].name = name;
    activeSearch = null;
  }
</script>

<svelte:window on:click={(e) => { if ((e.target as HTMLElement).tagName !== 'INPUT') activeSearch = null; }} />

<Modal widthClass="w-full max-w-3xl" on:close={() => dispatch('close')}>
    <div class="flex justify-between items-center mb-6">
        <div>
            <h2 class="text-2xl font-bold flex items-center gap-2 text-white">
                <Pencil size={24} class="text-blue-400"/> Edit Plan
            </h2>
            <p class="text-sm text-gray-400 mt-1">Modifying templates will update all future workouts.</p>
        </div>
    </div>

    <div class="flex-1 overflow-y-auto space-y-8 pr-2 custom-scrollbar">
        {#each Object.entries(planTemplates) as [typeName, exercises]}
            <div class="bg-gray-800 border border-gray-700 rounded-xl overflow-visible relative">
                <div class="bg-gray-700/50 p-3 border-b border-gray-700 flex justify-between items-center">
                    <h3 class="font-bold text-white text-sm">{typeName}</h3>
                    <div class="grid grid-cols-[50px_50px_40px_20px] gap-2 items-center text-center text-[10px] font-bold uppercase text-gray-400 tracking-wider">
                        <span>Sets</span> <span>Drop</span> <span></span><span></span>
                    </div>
                </div>

                <div class="p-3 space-y-2">
                    {#if exercises.length === 0}
                        <div class="text-center py-4 text-gray-500 text-sm italic">No exercises.</div>
                    {/if}

                    {#each exercises as ex, exIdx}
                        <div class="grid grid-cols-[1fr_50px_50px_40px_20px] gap-2 items-center">
                            <div class="relative w-full">
                                <input 
                                    type="text" 
                                    placeholder="Search..." 
                                    bind:value={ex.name}
                                    on:focus={() => activeSearch = { type: typeName, index: exIdx }}
                                    class="w-full bg-gray-900 border border-gray-600 rounded p-2 text-sm text-white focus:border-blue-500 outline-none placeholder-gray-600"
                                />
                                {#if activeSearch?.type === typeName && activeSearch?.index === exIdx}
                                    {@const results = ex.name.length > 0 ? fullLibrary.filter(item => item.name.toLowerCase().includes(ex.name.toLowerCase())).slice(0, 6) : fullLibrary.slice(0, 50)}
                                    <div class="absolute top-full left-0 min-w-[300px] bg-gray-800 border border-gray-600 rounded-lg mt-1 z-50 shadow-2xl overflow-y-auto max-h-60 custom-scrollbar">
                                        {#each results as item}
                                            <button 
                                                on:mousedown={() => selectExercise(typeName, exIdx, item.name)}
                                                class="w-full flex justify-between items-center p-3 hover:bg-gray-700 text-left"
                                            >
                                                <span class="text-sm text-gray-200">{item.name}</span>
                                                <span class="text-[10px] uppercase text-gray-500 border border-gray-700 px-1.5 rounded">{item.muscle_group}</span>
                                            </button>
                                        {/each}
                                    </div>
                                {/if}
                            </div>

                            <input type="number" bind:value={ex.startSets} class="w-full bg-gray-900 border border-gray-600 rounded p-2 text-center text-sm text-white outline-none" />
                            
                            <div class="flex justify-center">
                                <button on:click={() => ex.isDropset = !ex.isDropset} class="p-2 rounded transition-colors {ex.isDropset ? 'text-yellow-400 bg-yellow-400/10' : 'text-gray-600 hover:text-gray-400'}">
                                    <Zap size={16} fill={ex.isDropset ? "currentColor" : "none"} />
                                </button>
                            </div>

                            <div class="flex flex-col gap-1">
                                <button on:click={() => moveExercise(typeName, exIdx, 'up')} disabled={exIdx === 0} class="text-gray-500 hover:text-white disabled:opacity-30 disabled:hover:text-gray-500"><ArrowUp size={14} /></button>
                                <button on:click={() => moveExercise(typeName, exIdx, 'down')} disabled={exIdx === exercises.length - 1} class="text-gray-500 hover:text-white disabled:opacity-30 disabled:hover:text-gray-500"><ArrowDown size={14} /></button>
                            </div>

                            <button on:click={() => removeExercise(typeName, exIdx)} class="flex items-center justify-center text-gray-500 hover:text-red-500 transition-colors h-full">
                                <Trash2 size={16} />
                            </button>
                        </div>
                    {/each}
                    <button on:click={() => addExercise(typeName)} class="w-full py-2 border border-dashed border-gray-600 text-gray-400 rounded-lg text-sm hover:border-yellow-500 hover:text-yellow-400 transition-colors flex items-center justify-center gap-2 mt-2">
                        <Plus size={16} /> Add Exercise
                    </button>
                </div>
            </div>
        {/each}
    </div>

    <div class="pt-6 border-t border-gray-800 flex gap-4 mt-6">
        <button on:click={() => dispatch('close')} class="px-6 py-3 rounded-xl bg-gray-700 hover:bg-gray-600 text-gray-200 font-medium">Cancel</button>
        <button on:click={() => dispatch('save', planTemplates)} disabled={savingPlan} class="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-xl shadow-lg disabled:opacity-50">
            {savingPlan ? 'Updating Schedule...' : 'Save Changes'}
        </button>
    </div>
</Modal>

<style>
    .custom-scrollbar::-webkit-scrollbar { width: 4px; }
    .custom-scrollbar::-webkit-scrollbar-track { background: #111827; }
    .custom-scrollbar::-webkit-scrollbar-thumb { background: #374151; border-radius: 4px; }
</style>