<script lang="ts">
  import Modal from "$lib/components/common/Modal.svelte";
  import { AlertCircle } from "lucide-svelte";
  import { createEventDispatcher } from "svelte";

  export let title = "Notice";
  export let message = "";

  const dispatch = createEventDispatcher();
</script>

<Modal widthClass="max-w-sm" on:close={() => dispatch('close')} showCloseButton={false}>
    <div class="text-center p-4">
        <div class="bg-blue-900/30 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-500/20 text-blue-400">
            <AlertCircle size={32} />
        </div>
        
        <h3 class="text-xl font-bold text-white mb-2">{title}</h3>
        <p class="text-gray-400 text-sm mb-6 leading-relaxed">
            {message}
        </p>
        
        <button 
            on:click={() => dispatch('close')}
            class="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-lg shadow-blue-900/20 transition-transform active:scale-95"
        >
            Got it
        </button>
    </div>
</Modal>