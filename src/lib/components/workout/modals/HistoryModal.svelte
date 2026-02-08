<script lang="ts">
  import Modal from "$lib/components/common/Modal.svelte";
  import { createEventDispatcher } from "svelte";

  export let exerciseName = "";
  export let loading = false;
  export let historyData: any[] = [];

  const dispatch = createEventDispatcher();
</script>

<Modal widthClass="max-w-md" on:close={() => dispatch('close')}>
    <div class="flex justify-between mb-4 border-b border-gray-700 pb-2">
        <h3 class="text-xl font-bold text-white">{exerciseName}</h3>
    </div> 

    {#if loading} 
        <div class="p-8 text-center text-gray-500 animate-pulse">Loading history...</div>
    {:else if historyData.length === 0}
        <div class="p-8 text-center text-gray-500 text-sm italic">
            No previous history found for this exercise.
        </div>
    {:else} 
        <div class="flex-1 overflow-y-auto pr-1 max-h-[60vh] space-y-2 custom-scrollbar">
            {#each historyData as sess} 
                <div class="bg-gray-900 p-3 rounded-lg border border-gray-800 hover:border-gray-700 transition-colors"> 
                    <div class="flex justify-between items-center text-sm mb-1">
                        <span class="font-mono text-blue-400 font-bold">{sess.date}</span>
                        <span class="text-gray-300 font-medium">{sess.workoutName}</span>
                    </div> 

                    <div class="flex flex-wrap gap-2 text-[10px] text-gray-500 mb-3 uppercase tracking-wide">
                        <span class="bg-gray-800 px-1.5 py-0.5 rounded text-gray-400 border border-gray-700">{sess.mesoName}</span>
                        <span>•</span>
                        <span>Week {sess.week}</span>
                    </div>

                    <div class="space-y-1">
                        {#each sess.sets as s, i} 
                            <div class="text-sm flex items-center gap-4 border-t border-gray-800/50 pt-1">
                                <span class="w-4 text-gray-600 font-mono text-xs">{i+1}</span> 
                                <div class="flex-1 flex justify-between">
                                    <span class="text-white font-medium">{s.weight || 0} <span class="text-xs text-gray-600 font-normal">lbs</span></span> 
                                    <span class="text-green-400 font-bold">{s.reps || 0} <span class="text-xs text-green-900/50 font-normal">reps</span></span>
                                </div>
                            </div> 
                        {/each} 
                    </div>
                </div> 
            {/each} 
        </div>
    {/if} 
</Modal>

<style>
    .custom-scrollbar::-webkit-scrollbar {
        width: 4px;
    }
    .custom-scrollbar::-webkit-scrollbar-track {
        background: #111827; 
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
        background: #374151; 
        border-radius: 4px;
    }
</style>