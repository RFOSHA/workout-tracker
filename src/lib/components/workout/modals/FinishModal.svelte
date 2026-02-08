<script lang="ts">
  import Modal from "$lib/components/common/Modal.svelte";
  import { CheckCircle } from "lucide-svelte";
  import { createEventDispatcher } from "svelte";

  const dispatch = createEventDispatcher();
</script>

<Modal on:close={() => dispatch('close')}>
    <div class="text-center">
        <div class="mx-auto bg-green-900/30 w-16 h-16 rounded-full flex items-center justify-center mb-4 border border-green-500/20">
            <CheckCircle class="text-green-500" size={32} />
        </div> 
        
        <h3 class="text-xl font-bold text-white mb-2">Workout Complete?</h3> 
        <p class="text-gray-400 text-sm mb-6">Great work! This will mark the session as finished and save your progress.</p>

        <div class="flex gap-3 mt-8"> 
            <button 
                on:click={() => dispatch('close')} 
                class="flex-1 py-3 px-4 bg-gray-700 hover:bg-gray-600 text-white rounded-xl transition-colors font-medium"
            >
                Cancel
            </button> 
            <button 
                on:click={() => dispatch('confirm')} 
                class="flex-1 py-3 px-4 bg-green-600 hover:bg-green-500 text-white rounded-xl font-bold shadow-lg shadow-green-900/20 transition-transform active:scale-95"
            >
                Yes, Finish
            </button> 
        </div> 
    </div>
</Modal>