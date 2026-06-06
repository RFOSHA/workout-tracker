<script lang="ts">
  import Modal from "$lib/components/common/Modal.svelte";
  import { Plus, Trash2, Zap, SlidersHorizontal, Pencil, MoreVertical, Link } from "lucide-svelte";
  import { createEventDispatcher } from "svelte";

  export let typeName: string;
  export let typeIndex: number;
  export let activeMuscles: string[] = [];
  export let exercises: any[] = [];
  export let baseLibrary: any[] = [];
  export let activeSearch: { t: number, e: number } | null = null;
  export let totalCycles: number;
  export let allMuscleGroups: string[] = [];

  const dispatch = createEventDispatcher();
  
  let showMuscleSelector = false;
  let activeMenu: number | null = null; // Tracks which exercise row has its "..." menu open
  let supersetCounter = 0;

  // Auto-resize manual arrays if total weeks changes in Step 1
  $: if (totalCycles) {
      let needsUpdate = false;
      exercises.forEach(ex => {
          if (ex.progressionType === 'manual' && (!ex.manualSets || ex.manualSets.length !== totalCycles)) {
              const oldArr = ex.manualSets || [];
              ex.manualSets = Array.from({ length: totalCycles }, (_, i) => oldArr[i] ?? ex.startSets);
              needsUpdate = true;
          }
      });
      if (needsUpdate) exercises = [...exercises];
  }

  function addExercise() {
      exercises = [...exercises, { name: "", startSets: 3, endSets: 5, isDropset: false, progressionType: 'linear', manualSets: Array(totalCycles).fill(3) }];
  }

  function toggleSuperset(exIdx: number) {
      const ex = exercises[exIdx];
      if (ex.supersetGroup) {
          // Unlink: clear group from all exercises that share it
          const gid = ex.supersetGroup;
          exercises = exercises.map(e => e.supersetGroup === gid ? { ...e, supersetGroup: undefined } : e);
      } else {
          // Link with the next exercise (add one if needed)
          supersetCounter++;
          const gid = supersetCounter;
          exercises[exIdx] = { ...exercises[exIdx], supersetGroup: gid };
          if (exIdx + 1 < exercises.length && !exercises[exIdx + 1].supersetGroup) {
              exercises[exIdx + 1] = { ...exercises[exIdx + 1], supersetGroup: gid };
          } else {
              // Append a blank partner slot
              exercises = [
                  ...exercises,
                  { name: "", startSets: 3, endSets: 5, isDropset: false, progressionType: 'linear', manualSets: Array(totalCycles).fill(3), supersetGroup: gid }
              ];
          }
          exercises = [...exercises];
      }
      activeMenu = null;
  }

  function toggleProgression(index: number) {
      const ex = exercises[index];
      ex.progressionType = ex.progressionType === 'linear' ? 'manual' : 'linear';
      
      // Interpolate a smooth curve instantly when switching to manual mode
      if (ex.progressionType === 'manual') {
          const diff = ex.endSets - ex.startSets;
          ex.manualSets = Array.from({ length: totalCycles }, (_, i) => {
              const progress = totalCycles > 1 ? i / (totalCycles - 1) : 0;
              return Math.round(ex.startSets + (diff * progress));
          });
      }
      exercises = [...exercises];
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

<svelte:window on:click={() => activeMenu = null} />

<div class="bg-gray-800 border border-gray-700 rounded-xl overflow-visible relative">
    <div class="bg-gray-700/50 p-3 border-b border-gray-700 grid grid-cols-[20px_1fr_108px_30px] gap-2 items-center">
        <span></span> 
        <h3 class="font-bold text-white text-sm truncate">{typeName}</h3>
        <div class="flex justify-between w-[108px] text-[10px] font-bold uppercase text-gray-400 tracking-wider">
            <span class="w-[50px] text-center">Start</span>
            <span class="w-[50px] text-center">End</span>
        </div>
        <button on:click={() => showMuscleSelector = true} class="text-gray-500 hover:text-white transition-colors flex justify-center" title="Edit Target Muscles">
            <Pencil size={16} />
        </button>
    </div>

    {#if showMuscleSelector}
        <Modal widthClass="max-w-sm" on:close={() => showMuscleSelector = false}>
            <div class="p-2">
                <h3 class="text-xl font-bold text-white mb-2">Target Muscles</h3>
                <p class="text-sm text-gray-400 mb-6">Select the muscles this workout targets to filter the exercise search.</p>
                
                <div class="flex flex-wrap gap-2 mb-8">
                    {#each allMuscleGroups as muscle}
                        <button 
                            on:click={() => dispatch('toggleMuscle', { muscle })}
                            class="text-sm px-4 py-2 rounded-full border transition-all {activeMuscles.includes(muscle) ? 'bg-blue-600 border-blue-500 text-white font-bold' : 'bg-gray-800 border-gray-600 text-gray-400 hover:border-gray-500'}"
                        >
                            {muscle}
                        </button>
                    {/each}
                </div>

                <button on:click={() => showMuscleSelector = false} class="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition-colors shadow-lg shadow-blue-900/20">
                    Done
                </button>
            </div>
        </Modal>
    {/if}

    <div class="p-3 space-y-2">
        {#if exercises.length === 0}
            <div class="text-center py-4 text-gray-500 text-sm italic">No exercises added yet.</div>
        {/if}

        {#each exercises as ex, exIdx}
            {@const searchResults = ex.name.length > 0 ? baseLibrary.filter(item => item.name.toLowerCase().includes(ex.name.toLowerCase())).slice(0, 6) : baseLibrary.slice(0, 50)}

            <div class="grid grid-cols-[20px_1fr_108px_30px] gap-2 items-center relative">
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

                {#if ex.progressionType === 'linear'}
                    <div class="flex gap-2 w-[108px]">
                        <input type="number" bind:value={ex.startSets} class="w-[50px] bg-gray-900 border border-gray-600 rounded p-2 text-center text-sm text-white focus:border-blue-500 outline-none" />
                        <input type="number" bind:value={ex.endSets} class="w-[50px] bg-gray-900 border border-gray-600 rounded p-2 text-center text-sm text-white focus:border-blue-500 outline-none" />
                    </div>
                {:else}
                    <div class="w-[108px] text-center text-[10px] text-blue-400 font-bold bg-blue-900/20 border border-blue-500/30 rounded py-2 uppercase tracking-widest cursor-default">
                        Manual
                    </div>
                {/if}
                
                <div class="relative flex justify-center">
                    <button on:click|stopPropagation={() => activeMenu = activeMenu === exIdx ? null : exIdx} class="p-1 rounded text-gray-500 hover:text-white hover:bg-gray-700 transition-colors">
                        <MoreVertical size={20} />
                    </button>
                    
                    {#if activeMenu === exIdx}
                        <div class="absolute right-0 top-8 w-56 bg-gray-800 border border-gray-600 rounded-lg shadow-2xl z-50 overflow-hidden animate-fade-in-down" on:click|stopPropagation>
                            
                            <button on:click={() => { ex.isDropset = !ex.isDropset; activeMenu = null; }} class="w-full text-left px-4 py-3 text-sm text-gray-200 hover:bg-gray-700 flex items-center justify-between border-b border-gray-700 transition-colors">
                                <span class="flex items-center gap-3">
                                    <Zap size={16} class={ex.isDropset ? "text-yellow-400" : "text-gray-500"} /> Dropsets
                                </span>
                                <span class="text-[10px] font-bold {ex.isDropset ? 'text-yellow-400' : 'text-gray-500'}">{ex.isDropset ? 'ON' : 'OFF'}</span>
                            </button>

                            <button on:click={() => toggleSuperset(exIdx)} class="w-full text-left px-4 py-3 text-sm text-gray-200 hover:bg-gray-700 flex items-center justify-between border-b border-gray-700 transition-colors">
                                <span class="flex items-center gap-3">
                                    <Link size={16} class={ex.supersetGroup ? "text-orange-400" : "text-gray-500"} /> Superset
                                </span>
                                <span class="text-[10px] font-bold {ex.supersetGroup ? 'text-orange-400' : 'text-gray-500'}">{ex.supersetGroup ? 'ON' : 'OFF'}</span>
                            </button>
                            
                            <button on:click={() => { toggleProgression(exIdx); activeMenu = null; }} class="w-full text-left px-4 py-3 text-sm text-gray-200 hover:bg-gray-700 flex items-center justify-between border-b border-gray-700 transition-colors">
                                <span class="flex items-center gap-3">
                                    <SlidersHorizontal size={16} class={ex.progressionType === 'manual' ? "text-blue-400" : "text-gray-500"} /> Mode
                                </span>
                                <span class="text-[10px] uppercase tracking-wider font-bold {ex.progressionType === 'manual' ? 'text-blue-400' : 'text-gray-400'}">{ex.progressionType === 'manual' ? 'Manual' : 'Linear'}</span>
                            </button>
                            
                            <button on:click={() => { removeExercise(exIdx); activeMenu = null; }} class="w-full text-left px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-3 transition-colors">
                                <Trash2 size={16} /> Remove Exercise
                            </button>
                        </div>
                    {/if}
                </div>
            </div>

            {#if ex.supersetGroup && exercises[exIdx + 1]?.supersetGroup === ex.supersetGroup}
                <div class="flex items-center gap-1.5 pl-8 my-0.5">
                    <div class="flex flex-col items-center w-4 shrink-0">
                        <div class="w-px h-2 bg-orange-600/50"></div>
                        <span class="text-[8px] font-black text-orange-500 bg-orange-900/20 border border-orange-700/40 rounded-sm px-1 leading-tight py-0.5">SS</span>
                        <div class="w-px h-2 bg-orange-600/50"></div>
                    </div>
                    <div class="flex-1 h-px bg-orange-800/20"></div>
                </div>
            {/if}

            {#if ex.progressionType === 'manual'}
                <div class="pl-[28px] pr-[38px] mt-2 mb-4 animate-fade-in-down">
                    <div class="bg-gray-900/50 rounded-lg p-3 border border-gray-700/50 flex flex-col gap-2">
                        <div class="text-[10px] font-bold text-gray-500 uppercase tracking-widest border-b border-gray-800 pb-2 mb-1 flex justify-between items-center">
                            <span>Set Weekly Volume</span>
                        </div>
                        
                        {#each ex.manualSets as _, wIdx}
                            <div class="flex items-center justify-between bg-gray-800 p-2 rounded-md border border-gray-700">
                                <span class="text-sm font-bold text-gray-400 pl-2">Week {wIdx + 1}</span>
                                <div class="flex items-center gap-2">
                                    <input type="number" bind:value={ex.manualSets[wIdx]} class="w-16 bg-gray-900 border border-gray-600 rounded p-1.5 text-center text-sm text-white focus:border-blue-500 outline-none font-bold" />
                                    <span class="text-xs text-gray-500 font-medium w-8">sets</span>
                                </div>
                            </div>
                        {/each}
                    </div>
                </div>
            {/if}

        {/each}
        
        <button on:click={addExercise} class="w-full py-3 border border-dashed border-gray-600 text-gray-400 rounded-lg text-sm font-medium hover:border-blue-500 hover:text-blue-400 hover:bg-blue-900/10 transition-colors flex items-center justify-center gap-2 mt-4">
            <Plus size={16} /> Add Exercise
        </button>
    </div>
</div>