<script lang="ts">
  import Modal from "$lib/components/common/Modal.svelte";
  import { createEventDispatcher } from "svelte";
  import { supabase } from "$lib/supabaseClient";

  export let initialName = "";

  let name = initialName;
  let selectedMuscle = "";
  let saving = false;

  const dispatch = createEventDispatcher();

  const MUSCLE_GROUPS = [
    'Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 
    'Quads', 'Hamstrings', 'Calves', 'Abs', 'Forearms', 'Glutes'
  ];

  async function handleSave() {
    if (!name || !selectedMuscle) return;
    
    saving = true;
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("User not authenticated");

        const { error } = await supabase
            .from('exercise_library')
            .insert({ 
                name: name, 
                muscle_group: selectedMuscle, 
                user_id: user.id 
            });

        if (error) throw error;

        dispatch('created', { name, muscle: selectedMuscle });
    } catch (err: any) {
        alert("Error saving exercise: " + err.message);
    } finally {
        saving = false;
    }
  }
</script>

<Modal on:close={() => dispatch('close')}>
    <h3 class="text-xl font-bold text-white mb-6">New Custom Exercise</h3>
    
    <div class="mb-4">
        <label class="block text-xs font-bold text-gray-500 uppercase mb-2">Exercise Name</label>
        <input 
            type="text" 
            bind:value={name} 
            placeholder="e.g. Incline Bench Press"
            class="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-white focus:border-blue-500 outline-none transition-colors" 
        />
    </div>

    <div class="mb-6">
        <label class="block text-xs font-bold text-gray-500 uppercase mb-2">Target Muscle</label>
        <div class="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto custom-scrollbar pr-1">
            {#each MUSCLE_GROUPS as m}
                <button 
                    on:click={() => selectedMuscle = m}
                    class="text-xs py-2 px-1 rounded-lg border text-center transition-all
                    {selectedMuscle === m 
                        ? 'bg-blue-600 border-blue-500 text-white font-bold' 
                        : 'bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-500'}"
                >
                    {m}
                </button>
            {/each}
        </div>
    </div>

    <div class="flex gap-3 pt-2">
        <button 
            on:click={() => dispatch('close')}
            class="px-4 py-3 rounded-xl bg-gray-700 hover:bg-gray-600 text-gray-200 font-medium transition-colors"
        >
            Cancel
        </button>
        <button 
            on:click={handleSave} 
            disabled={!name || !selectedMuscle || saving}
            class="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-xl shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
            {saving ? 'Saving...' : 'Save & Select'}
        </button>
    </div>
</Modal>

<style>
    .custom-scrollbar::-webkit-scrollbar { width: 4px; }
    .custom-scrollbar::-webkit-scrollbar-track { background: #111827; }
    .custom-scrollbar::-webkit-scrollbar-thumb { background: #374151; border-radius: 4px; }
</style>