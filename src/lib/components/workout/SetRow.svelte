<script lang="ts">
  import { MoreVertical, Zap, Trash2, CornerDownRight } from 'lucide-svelte';
  import { createEventDispatcher } from 'svelte';

  // 👇 RENAME 'set' to 'setData' to avoid conflict with Svelte's internal API
  export let setData: any;
  export let index: number;
  export let setIndex: number;
  export let isActive: boolean;

  const dispatch = createEventDispatcher();

  // RIR color classes (selected state) — explicit strings so Tailwind JIT keeps them
  const RIR_SELECTED = [
    'bg-red-700 text-white',          // 0 – failure
    'bg-orange-600 text-white',       // 1
    'bg-amber-500 text-gray-900',     // 2
    'bg-yellow-400 text-gray-900',    // 3
    'bg-lime-500 text-gray-900',      // 4
    'bg-green-600 text-white',        // 5 – very easy
  ];
  const RIR_UNSELECTED = 'bg-gray-700/60 text-gray-500 hover:bg-gray-600 hover:text-white';

  // Local state for RIR so Svelte re-renders the button colors on change.
  // (setData is a one-way prop — mutating setData.rir alone doesn't trigger reactivity.)
  let localRir: number | null = setData.rir ?? null;

  function toggleRir(r: number) {
    localRir = localRir === r ? null : r;
    setData.rir = localRir;           // write back so the save picks it up
    dispatch('saveSet', { startTimer: true });   // only RIR triggers the rest timer
  }

  function addDropset() {
      setData.dropsets = [...(setData.dropsets || []), { weight: null, reps: null }];
      dispatch('saveSet');
  }

  function removeDropset(dropIndex: number) {
      setData.dropsets = setData.dropsets.filter((_: any, i: number) => i !== dropIndex);
      dispatch('saveSet');
  }

  $: hasData = setData.weight !== null || setData.reps !== null;
</script>

<div class="grid grid-cols-[30px_1fr_1fr_30px] gap-4 items-center relative {isActive ? 'z-50' : 'z-10'}">
   <div class="text-center font-bold text-gray-500 bg-gray-900 rounded-full w-8 h-8 flex items-center justify-center text-sm">
     {setIndex + 1}
   </div>
   
   <input
     type="number"
     placeholder={setData.suggestedWeight || "-"}
     bind:value={setData.weight}
     on:blur={() => dispatch('saveSet')}
     class="w-full bg-gray-900 border rounded p-3 text-center text-white text-lg outline-none placeholder-gray-600 transition-all duration-300
     {setData.weight !== null && setData.suggestedWeight && setData.weight >= setData.suggestedWeight 
         ? 'border-green-500 shadow-[0_0_10px_rgba(34,197,94,0.3)]' 
         : 'border-gray-600 focus:ring-2 focus:ring-blue-500'}"
   />
   
   <input
     type="number"
     placeholder={setData.suggestedReps || "-"}
     bind:value={setData.reps}
     on:blur={() => dispatch('saveSet')}
     class="w-full bg-gray-900 border rounded p-3 text-center text-white text-lg outline-none font-bold placeholder-gray-600 transition-all duration-300
     {setData.reps !== null && setData.suggestedReps && setData.reps >= setData.suggestedReps 
         ? 'border-green-500 shadow-[0_0_10px_rgba(34,197,94,0.3)]' 
         : 'border-gray-600 focus:ring-2 focus:ring-green-500'}"
   />

   <div class="relative flex justify-center">
      <button 
        on:click={(e) => dispatch('toggleMenu', { exIndex: index, setIndex, event: e })} 
        class="text-gray-500 hover:text-white p-2 rounded-full hover:bg-gray-700 transition-colors"
      >
         <MoreVertical size={20} />
      </button>
      
      {#if isActive}
        <div class="absolute right-0 top-10 w-48 bg-gray-800 border border-gray-600 rounded-lg shadow-xl z-50 overflow-hidden">
            <button 
                on:click={addDropset} 
                class="w-full text-left px-4 py-3 text-sm text-gray-200 hover:bg-gray-700 flex items-center gap-3 border-b border-gray-700"
            >
                <Zap size={16} class="text-yellow-400" /> Add Dropset
            </button>
            <button 
                on:click={() => dispatch('deleteSet', { setIndex })} 
                class="w-full text-left px-4 py-3 text-sm text-red-400 hover:bg-gray-700 flex items-center gap-3"
            >
                <Trash2 size={16} /> Delete Set
            </button>
        </div>
      {/if}
   </div>
</div>

{#if hasData}
  <div class="grid grid-cols-[30px_1fr_1fr_30px] gap-4 mt-1.5">
    <div></div>
    <div class="col-span-2 flex items-center gap-1">
      <span class="text-[10px] font-bold text-gray-500 uppercase tracking-widest w-7 shrink-0">RIR</span>
      {#each [0, 1, 2, 3, 4, 5] as r}
        <button
          on:click={() => toggleRir(r)}
          class="flex-1 h-6 rounded text-xs font-bold transition-colors {localRir === r ? RIR_SELECTED[r] : RIR_UNSELECTED}"
          aria-label="RIR {r}"
          title="Reps in Reserve: {r}{r === 0 ? ' (failure)' : ''}"
        >{r}</button>
      {/each}
    </div>
    <div></div>
  </div>
{/if}

{#if setData.dropsets && setData.dropsets.length > 0}
  <div class="space-y-2 mt-2"> 
    {#each setData.dropsets as drop, dropIndex}
      <div class="grid grid-cols-[30px_1fr_1fr_30px] gap-4 items-center">
        <div class="flex justify-end text-gray-600 pr-1"><CornerDownRight size={16} /></div>
        
        <input 
            type="number" 
            placeholder="Drop Lbs" 
            bind:value={drop.weight} 
            on:blur={() => dispatch('saveSet')} 
            class="w-full bg-gray-800 border border-gray-600 border-dashed rounded p-2 text-center text-gray-300 text-sm outline-none" 
        />
        
        <input 
            type="number" 
            placeholder="Drop Reps" 
            bind:value={drop.reps} 
            on:blur={() => dispatch('saveSet')} 
            class="w-full bg-gray-800 border border-gray-600 border-dashed rounded p-2 text-center text-gray-300 text-sm outline-none" 
        />
        
        <div class="flex justify-center">
            <button on:click={() => removeDropset(dropIndex)} class="text-gray-600 hover:text-red-500">
                <Trash2 size={16} />
            </button>
        </div>
      </div>
    {/each}
  </div>
{/if}