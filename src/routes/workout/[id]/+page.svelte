<script lang="ts">
  import { page } from "$app/stores";
  import { supabase } from "$lib/supabaseClient";
  import { goto } from "$app/navigation";
  import { onMount, onDestroy } from "svelte";
  import { CirclePlus, Zap } from "lucide-svelte";
  import { settings } from "$lib/stores/settings";

  // --- COMPONENTS ---
  import ExerciseCard from "$lib/components/workout/ExerciseCard.svelte";
  import RecapModal from "$lib/components/workout/modals/RecapModal.svelte";
  import NextPlanWizard from "$lib/components/mesocycle/NextPlanWizard.svelte";
  import HistoryModal from "$lib/components/workout/modals/HistoryModal.svelte";
  import FinishModal from "$lib/components/workout/modals/FinishModal.svelte";
  import AddExerciseModal from "$lib/components/workout/modals/AddExerciseModal.svelte";
  // 👇 New modular modals you should create
  import CustomExerciseModal from "$lib/components/workout/modals/CustomExerciseModal.svelte";
  import DeleteConfirmationModal from "$lib/components/workout/modals/DeleteConfirmationModal.svelte";
  import RestTimer from "$lib/components/workout/RestTimer.svelte";

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
  let completedMeso: any = null;
  let showNextPlanWizard = false;
  let newExerciseSearch = ""; // Passed to Custom Modal

  let saveTimeouts: Record<string, ReturnType<typeof setTimeout>> = {};

  // Rest timer state
  let showRestTimer = false;
  let restTimerKey = 0;

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
    const { exerciseName, targetSets, addToFuture, supersetPartner } = event.detail;
    showAddExerciseModal = false;
    loading = true;

    try {
        if (supersetPartner) {
            // ── Superset pair ─────────────────────────────────────────────
            const groupId = Date.now();
            const [ex1, ex2] = await Promise.all([
                Actions.addNewExercise(supabase, workoutId, exerciseName,    targetSets, exercises.length,     { superset_group: groupId }),
                Actions.addNewExercise(supabase, workoutId, supersetPartner, targetSets, exercises.length + 1, { superset_group: groupId })
            ]);
            exercises = [...exercises, ex1, ex2];
        } else {
            // ── Single exercise ───────────────────────────────────────────
            const newEx = await Actions.addNewExercise(supabase, workoutId, exerciseName, targetSets, exercises.length);
            exercises = [...exercises, newEx];

            if (addToFuture && workout.mesocycle_id) {
                await Actions.addExerciseToFutureWorkouts(supabase, workout.mesocycle_id, workout.day_number, workout.week_number, exerciseName, targetSets);
            }
        }

        setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }), 100);
    } catch (e: any) {
        alert("Error adding exercise: " + e.message);
    } finally {
        loading = false;
    }
  }

  // 2. EXERCISE ACTIONS (Bubbled from ExerciseCard)
  function handleSaveSet(e: CustomEvent) {
      const { exercise: exerciseToSave, startTimer } = e.detail;
      const exId = exerciseToSave.id;

      // Only start the rest timer when RIR is logged (set is truly complete) and timer is enabled in settings
      if (startTimer && $settings.timerEnabled) {
          showRestTimer = true;
          restTimerKey++;
      }

      // Clear the previous timeout if the user is still typing or tapping around
      if (saveTimeouts[exId]) {
          clearTimeout(saveTimeouts[exId]);
      }

      // Wait 500ms after the user stops typing/tapping before saving to the database
      saveTimeouts[exId] = setTimeout(async () => {
          try {
              await Actions.updateExerciseSets(supabase, exerciseToSave);
          } catch (err) {
              console.error("Failed to save set:", err);
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

  // ── Superset grouping ──────────────────────────────────────────────────
  // Group consecutive exercises that share a superset_group into visual pairs.
  function buildExerciseGroups(exs: any[]): { exs: any[]; idxs: number[] }[] {
      const result: { exs: any[]; idxs: number[] }[] = [];
      let i = 0;
      while (i < exs.length) {
          const g = exs[i]?.config?.superset_group;
          if (g) {
              const group = [exs[i]];
              const idxs = [i];
              while (i + 1 < exs.length && exs[i + 1]?.config?.superset_group === g) {
                  i++;
                  group.push(exs[i]);
                  idxs.push(i);
              }
              result.push({ exs: group, idxs });
          } else {
              result.push({ exs: [exs[i]], idxs: [i] });
          }
          i++;
      }
      return result;
  }

  $: exerciseGroups = buildExerciseGroups(exercises);

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
                
                try {
                    const [recap, mesoResult] = await Promise.all([
                        fetchRecapData(supabase, workout.mesocycle_id),
                        supabase.from('mesocycles').select('id, name, duration_weeks, days_per_week').eq('id', workout.mesocycle_id).single()
                    ]);
                    recapData = recap;
                    completedMeso = mesoResult.data;
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
      {#each exerciseGroups as { exs: group, idxs } (group[0].id)}
        {#if group.length > 1}
          <!-- ── Superset group ─────────────────────────────────────────── -->
          <div class="border border-orange-700/40 rounded-xl overflow-hidden">
            <div class="bg-orange-900/20 px-4 py-2 border-b border-orange-800/30 flex items-center gap-2">
              <Zap size={14} class="text-orange-400" />
              <span class="text-xs font-black uppercase tracking-widest text-orange-400">Superset</span>
            </div>
            <div class="divide-y divide-orange-900/20">
              {#each group as ex, gei (ex.id)}
                {@const flatIdx = idxs[gei]}
                <ExerciseCard
                  bind:exercise={exercises[flatIdx]}
                  index={flatIdx}
                  totalExercises={exercises.length}
                  {activeMenu}
                  on:toggleMenu={handleToggleMenu}
                  on:saveSet={handleSaveSet}
                  on:saveNote={handleSaveNote}
                  on:move={handleMoveExercise}
                  on:loadHistory={handleLoadHistory}
                  on:deleteExercise={() => promptDelete('exercise', { index: flatIdx, id: ex.id })}
                  on:deleteSet={(e) => promptDelete('set', { exIndex: flatIdx, setIndex: e.detail.setIndex })}
                />
              {/each}
            </div>
          </div>
        {:else}
          <!-- ── Single exercise ────────────────────────────────────────── -->
          {@const flatIdx = idxs[0]}
          <ExerciseCard
            bind:exercise={exercises[flatIdx]}
            index={flatIdx}
            totalExercises={exercises.length}
            {activeMenu}
            on:toggleMenu={handleToggleMenu}
            on:saveSet={handleSaveSet}
            on:saveNote={handleSaveNote}
            on:move={handleMoveExercise}
            on:loadHistory={handleLoadHistory}
            on:deleteExercise={() => promptDelete('exercise', { index: flatIdx, id: group[0].id })}
            on:deleteSet={(e) => promptDelete('set', { exIndex: flatIdx, setIndex: e.detail.setIndex })}
          />
        {/if}
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
        {completedMeso}
        isComplete={true}
        on:close={() => showRecapModal = false}
        on:planNext={() => { showRecapModal = false; showNextPlanWizard = true; }}
    />
  {/if}

  {#if showNextPlanWizard}
    <NextPlanWizard
        {recapData}
        {completedMeso}
        {exerciseLibrary}
        on:close={() => showNextPlanWizard = false}
    />
  {/if}

  {#if showRestTimer}
    <RestTimer
      duration={$settings.restDuration}
      restartKey={restTimerKey}
      on:dismiss={() => showRestTimer = false}
    />
  {/if}
</div>