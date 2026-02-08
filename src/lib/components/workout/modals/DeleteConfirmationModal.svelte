<script lang="ts">
  import Modal from "$lib/components/common/Modal.svelte";
  import { Trash2 } from "lucide-svelte";
  import { createEventDispatcher } from "svelte";

  export let type: 'set' | 'exercise';

  const dispatch = createEventDispatcher();
</script>

<Modal widthClass="max-w-sm" on:close={() => dispatch('close')}>
    <div class="text-center p-4">
        <div class="bg-red-500/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-red-500">
            <Trash2 size={32} />
        </div>
        
        <h3 class="text-xl font-bold text-white mb-2">
            Delete {type === 'set' ? 'Set' : 'Exercise'}?
        </h3>
        <p class="text-gray-400 text-sm mb-6">
            Are you sure you want to remove this? This action cannot be undone.
        </p>
        
        <div class="flex gap-3">
            <button 
                on:click={() => dispatch('close')}
                class="flex-1 py-3 rounded-xl bg-gray-700 hover:bg-gray-600 text-gray-200 font-bold transition-colors"
            >
                Cancel
            </button>
            <button 
                on:click={() => dispatch('confirm')}
                class="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold shadow-lg shadow-red-900/20 transition-colors"
            >
                Yes, Delete
            </button>
        </div>
    </div>
</Modal>