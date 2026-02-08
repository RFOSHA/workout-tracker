<script lang="ts">
  import { slide } from 'svelte/transition';
  import { StickyNote, History, MoreVertical, ArrowUp, ArrowDown, Trash2, CirclePlus, TrendingUp } from 'lucide-svelte';
  import SetRow from './SetRow.svelte';
  import { createEventDispatcher } from 'svelte';

  export let exercise: any;
  export let index: number;
  export let totalExercises: number;
  export let activeMenu: any; 

  const dispatch = createEventDispatcher();

  function toggleMenu(e: MouseEvent) {
      dispatch('toggleMenu', { exIndex: index, setIndex: -1, event: e });
  }

  function handleAddSet() {
      // Direct mutation or dispatch
      exercise.set_results = [...exercise.set_results, { weight: null, reps: null, dropsets: [] }];
      dispatch('saveSet', { exercise });
  }
</script>

<div class="bg-gray-800 rounded-lg border border-gray-700 transition-all duration-300">
  
  <div class="bg-gray-700/50 p-4 border-b border-gray-700 flex justify-between items-center rounded-t-lg">
    <div>
        <h3 class="font-bold text-lg text-white">{exercise.exercise_name}</h3>
        <div class="flex items-center gap-2 mt-1">
            <span class="text-xs bg-blue-900 text-blue-200 px-2 py-0.5 rounded">
                Target: {exercise.target_sets} Sets
            </span>
            {#if exercise.set_results[0]?._hasSuggestion}
                <span class="text-[10px] text-gray-400 flex items-center gap-1">
                    <TrendingUp size={12} class="text-gray-500"/> Progression Loaded
                </span>
            {/if}
        </div>
    </div>

    <div class="flex gap-2 relative">
       <button 
          on:click={() => exercise.showNotes = !exercise.showNotes} 
          class="text-gray-400 hover:text-yellow-400 transition-colors {exercise.currentNote ? 'text-yellow-500' : ''}"
          title="Notes"
       >
          <StickyNote size={20} fill={exercise.currentNote ? "currentColor" : "none"} />
       </button>

       <button 
          on:click={() => dispatch('loadHistory', { name: exercise.exercise_name })} 
          class="text-gray-400 hover:text-white"
          title="History"
       >
          <History size={20} />
       </button>
       
       <div class="relative">
          <button on:click={toggleMenu} class="text-gray-400 hover:text-white">
              <MoreVertical size={20} />
          </button>
          
          {#if activeMenu?.exIndex === index && activeMenu?.setIndex === -1}
             <div class="absolute right-0 top-8 w-48 bg-gray-800 border border-gray-600 rounded-lg shadow-xl z-50 overflow-hidden animate-fade-in-down">
                <button 
                    on:click={() => dispatch('move', { index, direction: 'up' })} 
                    disabled={index === 0} 
                    class="w-full text-left px-4 py-3 text-sm text-gray-200 hover:bg-gray-700 flex items-center gap-3 border-b border-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <ArrowUp size={16} /> Move Up
                </button>
                <button 
                    on:click={() => dispatch('move', { index, direction: 'down' })} 
                    disabled={index === totalExercises - 1} 
                    class="w-full text-left px-4 py-3 text-sm text-gray-200 hover:bg-gray-700 flex items-center gap-3 border-b border-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <ArrowDown size={16} /> Move Down
                </button>
                <button 
                    on:click={() => dispatch('deleteExercise')} 
                    class="w-full text-left px-4 py-3 text-sm text-red-400 hover:bg-gray-700 flex items-center gap-3"
                >
                    <Trash2 size={16} /> Remove
                </button>
             </div>
          {/if}
       </div>
    </div>
  </div>

  {#if exercise.showNotes}
    <div transition:slide class="px-4 py-3 bg-gray-900/50 border-b border-gray-700">
        {#if exercise.noteHistory && exercise.noteHistory.length > 0}
            <div class="mb-4 space-y-2">
                <span class="text-[10px] uppercase font-bold text-gray-500 tracking-wider block mb-1">Block History</span>
                {#each exercise.noteHistory as note}
                    <div class="text-xs text-gray-400 bg-gray-800 p-2 rounded border-l-2 border-gray-600">
                        <div class="flex justify-between items-center mb-1">
                            <span class="font-bold text-gray-300">Week {note.week}</span>
                            {#if note.date}
                                <span class="text-[9px] text-gray-600">{new Date(note.date).toLocaleDateString()}</span>
                            {/if}
                        </div>
                        {note.text}
                    </div>
                {/each}
            </div>
        {/if}
        <div class="relative">
            <span class="text-[10px] uppercase font-bold text-yellow-500 tracking-wider block mb-1">Current Note</span>
            <textarea 
                bind:value={exercise.currentNote} 
                on:blur={() => dispatch('saveNote', { exercise })}
                placeholder="Add notes for next time..." 
                class="w-full bg-gray-800 border border-gray-600 rounded p-2 text-sm text-white focus:border-yellow-500 outline-none resize-none h-20"
            ></textarea>
        </div>
    </div>
  {/if}

  <div class="p-4">
    <div class="grid grid-cols-[30px_1fr_1fr_30px] gap-4 mb-2 text-xs text-gray-500 font-bold text-center uppercase tracking-wider">
        <span>Set</span> <span>Lbs</span> <span>Reps</span> <span></span>
    </div>

    <div class="space-y-4">
       {#each exercise.set_results as set, setIndex}
          <SetRow 
             setData={exercise.set_results[setIndex]} 
             index={index} 
             {setIndex}
             isActive={activeMenu?.exIndex === index && activeMenu?.setIndex === setIndex}
             on:toggleMenu
             on:saveSet={() => dispatch('saveSet', { exercise })}
             on:deleteSet
          />
       {/each}
    </div>

    <div class="mt-4 pt-4 border-t border-gray-700/50 flex justify-center">
        <button on:click={handleAddSet} class="flex items-center gap-2 text-xs font-bold text-blue-400 hover:text-blue-300 uppercase tracking-widest">
            <CirclePlus size={16} /> Add Extra Set
        </button>
    </div>
  </div>
</div>