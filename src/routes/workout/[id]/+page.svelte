<script lang="ts">
  import { page } from "$app/stores";
  import { supabase } from "$lib/supabaseClient";
  import { goto } from "$app/navigation";
  import { onMount, onDestroy } from "svelte";
  import { CirclePlus } from "lucide-svelte";

  // --- COMPONENTS ---
  import ExerciseCard from "$lib/components/workout/ExerciseCard.svelte";
  import RecapModal from "$lib/components/workout/modals/RecapModal.svelte";
  import HistoryModal from "$lib/components/workout/modals/HistoryModal.svelte";
  import FinishModal from "$lib/components/workout/modals/FinishModal.svelte";
  import AddExerciseModal from "$lib/components/workout/modals/AddExerciseModal.svelte";
  // 👇 New modular modals you should create
  import CustomExerciseModal from "$lib/components/workout/modals/CustomExerciseModal.svelte";
  import DeleteConfirmationModal from "$lib/components/workout/modals/DeleteConfirmationModal.svelte";

  // --- UTILS & ACTIONS ---
  import { getWorkoutData } from "$lib/utils/workoutLogic";
  import { fetchRecapData } from "$lib/utils/recapLogic"; // Use existing utility!
  import * as Actions from "$lib/actions/workoutActions"; // Use new actions file

  const workoutId = $page.params.id;

  // --- STATE ---
  let workout: any = null;
  let exercises: any[] = [];
  let loading = true;
  let activeMenu: { exIndex: number, setIndex: number } | null = null;
  
  // Library State (Passed to AddModal)
  let exerciseLibrary: any[] = [];
  
  // Modal Visibility State
  let showFinishModal = false;
  let showHistoryModal = false;
  let showAddExerciseModal = false;
  let showCustomExerciseModal = false;
  let showRecapModal = false;
  
  // Delete Modal State
  let deleteConfig: { type: 'set' | 'exercise', payload: any } | null = null;

  // Data State for Modals
  let historyData: any[] = [];
  let historyLoading = false;
  let historyExerciseName = "";
  let recapData: any = null;
  let recapLoading = false;
  let newExerciseSearch = ""; // Passed to Custom Modal

  // Add this variable near the top of your <script> block with your other state
  let saveTimeouts: Record<string, ReturnType<typeof setTimeout>> = {};

  // --- INITIALIZATION ---
  onMount(async () => {
    if (!workoutId) { goto('/'); return; }
    await Promise.all([initWorkout(), fetchLibrary()]);
    
    // Add this listener to close menus when clicking background
    window.addEventListener('click', () => activeMenu = null);
  });
  
  onDestroy(() => {
    if (typeof window !== 'undefined') window.removeEventListener('click', () => activeMenu = null);
  });

  async function initWorkout() {
    const result = await getWorkoutData(supabase, workoutId);
    if (result) {
        workout = result.workout;
        exercises = result.exercises;
    }
    loading = false;
  }

  async function fetchLibrary() {
    const { data } = await supabase.from('exercise_library').select('name, muscle_group').order('name');
    if (data) exerciseLibrary = data;
  }

  // --- EVENT HANDLERS ---

  function handleToggleMenu(event: CustomEvent) {
      const { exIndex, setIndex, event: originalEvent } = event.detail;
      // Stop the window click listener from immediately closing the menu we just opened
      originalEvent.stopPropagation();
      
      if (activeMenu?.exIndex === exIndex && activeMenu?.setIndex === setIndex) { 
          activeMenu = null;
      } else { 
          activeMenu = { exIndex, setIndex };
      }
  }

  // 1. ADD EXERCISE
  async function handleAddExercise(event: CustomEvent) {
    const { exerciseName, targetSets, addToFuture } = event.detail;
    showAddExerciseModal = false;
    loading = true;

    try {
        // Add to current workout
        const newEx = await Actions.addNewExercise(supabase, workoutId, exerciseName, targetSets, exercises.length);
        exercises = [...exercises, newEx];

        // Add to future (optional)
        if (addToFuture && workout.mesocycle_id) {
            await Actions.addExerciseToFutureWorkouts(supabase, workout.mesocycle_id, workout.day_number, workout.week_number, exerciseName, targetSets);
        }
        
        // Scroll to bottom
        setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }), 100);
    } catch (e: any) {
        alert("Error adding exercise: " + e.message);
    } finally {
        loading = false;
    }
  }

  // 2. EXERCISE ACTIONS (Bubbled from ExerciseCard)
  function handleSaveSet(e: CustomEvent) {
      const exerciseToSave = e.detail.exercise;
      const exId = exerciseToSave.id;

      // Clear the previous timeout if the user is still typing or tapping around
      if (saveTimeouts[exId]) {
          clearTimeout(saveTimeouts[exId]);
      }

      // Wait 500ms after the user stops typing/tapping before saving to the database
      saveTimeouts[exId] = setTimeout(async () => {
          try {
              await Actions.updateExerciseSets(supabase, exerciseToSave);
              console.log("Saved successfully!"); 
          } catch (err) {
              console.error("Failed to save set:", err);
              // Only alert if a legitimate error occurs, not a race condition
              alert("Failed to save set. Check console.");
          }
      }, 500);
  }

  async function handleSaveNote(e: CustomEvent) {
      const { id, currentNote } = e.detail.exercise;
      await Actions.saveNote(supabase, id, currentNote);
  }

  async function handleMoveExercise(e: CustomEvent) {
      const { index, direction } = e.detail;
      const newIndex = direction === 'up' ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= exercises.length) return;

      // Optimistic Swap
      const list = [...exercises];
      [list[index], list[newIndex]] = [list[newIndex], list[index]];
      exercises = list;

      // DB Update
      try {
          await Actions.moveExerciseOrder(supabase, exercises);
      } catch (err) {
          console.error(err);
          alert("Failed to save order.");
      }
  }

  // 3. DELETE HANDLING
  function promptDelete(type: 'set' | 'exercise', payload: any) {
      deleteConfig = { type, payload };
  }

  async function confirmDelete() {
      if (!deleteConfig) return;
      const { type, payload } = deleteConfig;
      
      try {
          if (type === 'set') {
              const { exIndex, setIndex } = payload;
              // Optimistic update handled by returning new array from action
              const newSets = await Actions.deleteSet(supabase, exercises[exIndex], setIndex);
              exercises[exIndex].set_results = newSets; 
          } else if (type === 'exercise') {
              const { index, id } = payload;
              const list = [...exercises];
              list.splice(index, 1);
              exercises = list;
              await Actions.deleteExercise(supabase, id);
          }
      } catch (e: any) {
          alert("Delete failed: " + e.message);
          if (type === 'exercise') initWorkout(); // Revert on fail
      } finally {
          deleteConfig = null;
      }
  }

  // 4. HISTORY & RECAP
    async function handleLoadHistory(e: CustomEvent) {
      historyExerciseName = e.detail.name;
      showHistoryModal = true;
      historyLoading = true;
      
      try {
          // Fetch data using the action we just created
          historyData = await Actions.fetchExerciseHistory(supabase, historyExerciseName, workoutId);
      } catch (err) {
          console.error("Failed to fetch history:", err);
          alert("Could not load exercise history.");
      } finally {
          historyLoading = false;
      }
  }

  async function handleFinish() {
      const now = new Date().toISOString();
      const { error } = await supabase.from('workouts').update({ completed: true, completed_at: now }).eq('id', workoutId);
      
      if (error) {
          alert(error.message);
      } else {
          // Check if block is complete
          if (workout?.mesocycle_id) {
            const { count } = await supabase
                .from('workouts')
                .select('*', { count: 'exact', head: true })
                .eq('mesocycle_id', workout.mesocycle_id)
                .eq('completed', false);

            if (count === 0) {
                showFinishModal = false;
                recapLoading = true;
                showRecapModal = true;
                
                // 👇 Add logging here
                console.log("Generating recap for meso:", workout.mesocycle_id);
                try {
                    recapData = await fetchRecapData(supabase, workout.mesocycle_id);
                    console.log("Recap Data:", recapData);
                } catch (err) {
                    console.error("Recap generation failed:", err);
                }
                
                recapLoading = false;
                return;
            }
        }
          goto('/');
      }
  }

</script>

<div class="min-h-screen bg-gray-900 text-white pb-32">
  
  {#if loading}
    <div class="p-8 text-center text-gray-500">Loading workout...</div>
  {:else if workout}
    
    <div class="bg-gray-800 p-6 border-b border-gray-700 sticky top-0 z-40 shadow-md">
      <div class="max-w-3xl mx-auto">
          <h1 class="text-2xl font-bold text-white">{workout.name}</h1>
          <p class="text-gray-400 text-sm">Week {workout.week_number} • Day {workout.day_number}</p>
      </div>
    </div>

    <div class="max-w-3xl mx-auto p-4 space-y-6">
      {#each exercises as exercise, index (exercise.id)}
        <ExerciseCard 
            bind:exercise={exercises[index]}
            index={index}
            totalExercises={exercises.length}
            activeMenu={activeMenu} 
            on:toggleMenu={handleToggleMenu}
            on:saveSet={handleSaveSet}
            on:saveNote={handleSaveNote}
            on:move={handleMoveExercise}
            on:loadHistory={handleLoadHistory}
            on:deleteExercise={() => promptDelete('exercise', { index, id: exercise.id })}
            on:deleteSet={(e) => promptDelete('set', { exIndex: index, setIndex: e.detail.setIndex })}
        />
      {/each}

      <button on:click={() => { newExerciseSearch = ""; showAddExerciseModal = true; }} class="w-full py-4 border-2 border-dashed border-gray-700 text-gray-400 rounded-xl hover:border-blue-500 hover:text-blue-400 hover:bg-gray-800/50 transition-all flex flex-col items-center justify-center gap-2 group">
        <div class="bg-gray-800 p-3 rounded-full group-hover:bg-blue-900/30 transition-colors"><CirclePlus size={24} /></div>
        <span class="font-bold text-sm uppercase tracking-widest">Add Exercise</span>
      </button>
    </div>

    <div class="mt-8 mb-12 p-4 flex justify-center">
      <button on:click={() => showFinishModal = true} class="bg-green-600 hover:bg-green-500 text-white font-bold py-4 px-12 rounded-full shadow-xl text-lg transform transition hover:scale-105 w-full max-w-md">
        Finish Workout
      </button>
    </div>

  {/if}

  {#if showFinishModal} 
    <FinishModal on:close={() => showFinishModal = false} on:confirm={handleFinish} />
  {/if}
  
  {#if showHistoryModal} 
    <HistoryModal exerciseName={historyExerciseName} loading={historyLoading} {historyData} on:close={() => showHistoryModal = false} /> 
  {/if}

  {#if showAddExerciseModal} 
    <AddExerciseModal 
        {exerciseLibrary} 
        on:close={() => showAddExerciseModal = false}
        on:add={handleAddExercise} 
        on:openCustomCreator={(e) => {
            newExerciseSearch = e.detail.name;
            showAddExerciseModal = false;
            showCustomExerciseModal = true;
        }}
    />
  {/if}

  {#if showCustomExerciseModal}
    <CustomExerciseModal 
        initialName={newExerciseSearch}
        on:close={() => { showCustomExerciseModal = false; showAddExerciseModal = true; }}
        on:created={async () => {
            await fetchLibrary(); // Refresh library
            showCustomExerciseModal = false;
            showAddExerciseModal = true;
        }}
    />
  {/if}

  {#if deleteConfig}
    <DeleteConfirmationModal 
        type={deleteConfig.type} 
        on:close={() => deleteConfig = null} 
        on:confirm={confirmDelete} 
    />
  {/if}

  {#if showRecapModal}
    <RecapModal 
        {recapLoading} 
        {recapData} 
        isComplete={true} 
        on:close={() => showRecapModal = false} 
    />
  {/if}
</div>