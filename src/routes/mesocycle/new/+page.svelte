<script lang="ts">
  import { onMount } from "svelte";
  import { supabase } from "$lib/supabaseClient";
  import { goto } from "$app/navigation";
  import { ArrowRight, Calendar, Dumbbell, Layers, CheckCircle, TrendingUp, ShieldAlert, Percent } from "lucide-svelte";
  
  // Imports
  import CustomExerciseModal from "$lib/components/workout/modals/CustomExerciseModal.svelte";
  import WorkoutTypeBuilder from "$lib/components/mesocycle/wizard/WorkoutTypeBuilder.svelte";
  import { createMesocyclePlan } from "$lib/actions/generateMesocycle";

  // --- STATE ---
  let step = 1;
  let loading = false;
  let exerciseLibrary: any[] = [];
  let activeSearch: { t: number, e: number } | null = null;
  
  let showCustomExerciseModal = false;
  let customExerciseName = "";
  let pendingCustomContext: { t: number, e: number } | null = null;

  const MUSCLE_GROUPS = ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Quads', 'Hamstrings', 'Calves', 'Abs', 'Forearms', 'Glutes'];

  // Step States
  let config = { microcycleDays: 7, liftingDays: 5, restDays: 2, workoutTypes: 3, totalCycles: 6, startDate: new Date().toISOString().split('T')[0], mesoName: "" };
  let workoutDefinitions: string[] = [];
  let selectedGroups: string[][] = [];
  let schedule: { dayIndex: number; type: 'rest' | 'lift'; workoutName?: string }[] = [];
  let exercisesPerType: Record<string, { name: string; startSets: number; endSets: number; isDropset: boolean }[]> = {};
  
  interface DeloadDaySettings { dayIndex: number; workoutName: string; reduceSets: number; reduceWeight: number; reduceReps: number; }
  let deloadConfig = { enabled: false, duration: 1, weeks: [] as DeloadDaySettings[][] };

  // --- LIFECYCLE ---
  onMount(async () => {
    const { data } = await supabase.from('exercise_library').select('name, muscle_group').order('name');
    if (data) exerciseLibrary = data;

    window.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).tagName !== 'INPUT' && !(e.target as HTMLElement).closest('.custom-exercise-modal')) {
            activeSearch = null;
        }
    });
  });

  // --- LOGIC ---
  function handleCustomCreated(e: CustomEvent) {
      const { name, muscle } = e.detail;
      exerciseLibrary = [...exerciseLibrary, { name, muscle_group: muscle }].sort((a,b) => a.name.localeCompare(b.name));
      
      if (pendingCustomContext) {
          const { t, e: exIndex } = pendingCustomContext;
          exercisesPerType[workoutDefinitions[t]][exIndex].name = name;
      }
      showCustomExerciseModal = false;
      pendingCustomContext = null;
  }

  function goToStep2() {
    if ((config.liftingDays + config.restDays) !== config.microcycleDays) return alert(`Math error: Lifting (${config.liftingDays}) + Rest (${config.restDays}) must equal Cycle (${config.microcycleDays}).`);
    if (workoutDefinitions.length !== config.workoutTypes) workoutDefinitions = Array(config.workoutTypes).fill("");
    if (selectedGroups.length !== config.workoutTypes) selectedGroups = Array.from({ length: config.workoutTypes }, () => []);
    step = 2;
  }

  function toggleMuscleGroup(workoutIndex: number, muscle: string) {
    const currentList = selectedGroups[workoutIndex];
    selectedGroups[workoutIndex] = currentList.includes(muscle) ? currentList.filter(m => m !== muscle) : [...currentList, muscle];
  }

  function goToStep3() {
    if (workoutDefinitions.some(n => !n.trim())) return alert("Please name all your workout types.");
    if (schedule.length !== config.microcycleDays) schedule = Array.from({ length: config.microcycleDays }, (_, i) => ({ dayIndex: i + 1, type: 'rest', workoutName: undefined }));
    step = 3;
  }

  function goToStep4() {
    workoutDefinitions.forEach(type => { if (!exercisesPerType[type]) exercisesPerType[type] = []; });
    step = 4;
  }

  function goToStep5() {
    updateDeloadWeeks();
    step = 5;
  }

  function updateDeloadWeeks() {
    const newWeeks = [];
    for (let w = 0; w < deloadConfig.duration; w++) {
        const existingWeek = deloadConfig.weeks[w] || [];
        const weekConfig = schedule.filter(day => day.type === 'lift' && day.workoutName).map(day => {
            const prevConfig = existingWeek.find(d => d.dayIndex === day.dayIndex);
            return { dayIndex: day.dayIndex, workoutName: day.workoutName!, reduceSets: prevConfig ? prevConfig.reduceSets : 50, reduceWeight: prevConfig ? prevConfig.reduceWeight : 0, reduceReps: prevConfig ? prevConfig.reduceReps : 0 };
        });
        newWeeks.push(weekConfig);
    }
    deloadConfig.weeks = newWeeks;
  }

  async function handleGenerateMesocycle() {
    loading = true;
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("You must be logged in.");

        await createMesocyclePlan(supabase, user.id, config, schedule, deloadConfig, exercisesPerType);
        goto('/');
    } catch (err: any) {
        alert("Error creating plan: " + err.message);
    } finally {
        loading = false;
    }
  }
</script>

<div class="min-h-screen bg-gray-900 text-white p-6 pb-32">
  <header class="mb-8">
    <h1 class="text-3xl font-bold">Build Your Plan</h1>
    <p class="text-gray-400">Step {step} of 5</p>
    <div class="h-1 w-full bg-gray-800 mt-4 rounded-full overflow-hidden">
      <div class="h-full bg-blue-500 transition-all duration-300" style="width: {(step/5)*100}%"></div>
    </div>
  </header>

  {#if step === 1}
    <div class="max-w-xl mx-auto space-y-6 animate-fade-in">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-bold text-gray-500 uppercase mb-2">Cycle Name</label>
              <input type="text" bind:value={config.mesoName} placeholder="e.g. Winter Bulk" class="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 focus:border-blue-500 outline-none" />
            </div>
            <div>
                <label class="block text-xs font-bold text-gray-500 uppercase mb-2">Start Date</label>
                <input type="date" bind:value={config.startDate} class="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 focus:border-blue-500 outline-none" />
            </div>
          </div>
          <hr class="border-gray-800" />
          <div class="space-y-4">
            <h3 class="font-bold text-lg flex items-center gap-2"><Calendar size={20} class="text-blue-400"/> Microcycle Setup</h3>
            <div class="grid grid-cols-2 gap-4">
                <div><label class="block text-xs text-gray-400 mb-1">Days in a "Week"</label><input type="number" bind:value={config.microcycleDays} class="w-full bg-gray-800 p-3 rounded border border-gray-700" /></div>
                <div><label class="block text-xs text-gray-400 mb-1">Total Cycles</label><input type="number" bind:value={config.totalCycles} class="w-full bg-gray-800 p-3 rounded border border-gray-700" /></div>
            </div>
            <div class="grid grid-cols-3 gap-4">
                <div><label class="block text-xs text-gray-400 mb-1">Lifting Days</label><input type="number" bind:value={config.liftingDays} class="w-full bg-gray-800 p-3 rounded border border-gray-700" /></div>
                <div><label class="block text-xs text-gray-400 mb-1">Rest Days</label><input type="number" bind:value={config.restDays} class="w-full bg-gray-800 p-3 rounded border border-gray-700" /></div>
                <div><label class="block text-xs text-blue-400 font-bold mb-1">Unique Types</label><input type="number" bind:value={config.workoutTypes} class="w-full bg-gray-800 p-3 rounded border border-blue-500/50" /></div>
            </div>
          </div>
          <button on:click={goToStep2} class="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl mt-8 flex justify-center items-center gap-2">
            Define Workouts <ArrowRight size={20} />
          </button>
    </div>
  {/if}

  {#if step === 2}
    <div class="max-w-xl mx-auto animate-fade-in pb-20">
      <h2 class="text-xl font-bold mb-4 flex items-center gap-2"><Layers size={20} class="text-green-400"/> Name Your Routines</h2>
      <div class="space-y-6"> 
        {#each workoutDefinitions as _, i}
            <div class="bg-gray-800 p-4 rounded-xl border border-gray-700">
                <div class="flex items-center gap-4 mb-3">
                    <span class="text-gray-500 font-mono w-6 text-right">{i+1}.</span>
                    <input type="text" bind:value={workoutDefinitions[i]} placeholder={`Workout Type #${i+1}`} class="flex-1 bg-gray-900 border border-gray-600 rounded-lg p-3 focus:border-green-500 outline-none" autofocus={i===0} />
                </div>
                <div class="pl-10">
                    <p class="text-[10px] text-gray-400 uppercase tracking-widest mb-2 font-bold">Target Muscles</p>
                    <div class="flex flex-wrap gap-2">
                        {#each MUSCLE_GROUPS as muscle}
                            <button on:click={() => toggleMuscleGroup(i, muscle)} class="text-xs px-3 py-1.5 rounded-full border transition-all {selectedGroups[i].includes(muscle) ? 'bg-blue-600 border-blue-500 text-white' : 'bg-gray-900 border-gray-700 text-gray-500 hover:border-gray-500'}">{muscle}</button>
                        {/each}
                    </div>
                </div>
            </div>
        {/each}
      </div>
      <div class="flex gap-4 mt-8">
        <button on:click={() => step = 1} class="px-6 py-4 rounded-xl bg-gray-800 text-gray-400">Back</button>
        <button on:click={goToStep3} class="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold py-4 rounded-xl flex justify-center items-center gap-2">
            Schedule Days <ArrowRight size={20} />
        </button>
      </div>
    </div>
  {/if}

  {#if step === 3}
    <div class="max-w-2xl mx-auto animate-fade-in">
        <h2 class="text-xl font-bold mb-4 flex items-center gap-2"><Dumbbell size={20} class="text-purple-400"/> Schedule Your Microcycle</h2>
          <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {#each schedule as day}
              <div class="bg-gray-800 border border-gray-700 rounded-lg p-3">
                <div class="flex justify-between items-center mb-2">
                    <span class="text-xs font-bold text-gray-500 uppercase tracking-widest">Day {day.dayIndex}</span>
                    <span class="text-xs {day.type === 'lift' ? 'bg-purple-900 text-purple-200' : 'bg-gray-700 text-gray-300'} px-2 py-0.5 rounded">{day.type === 'lift' ? 'Lift' : 'Rest'}</span>
                </div>
                <select bind:value={day.workoutName} on:change={(e) => { day.type = e.currentTarget.value ? 'lift' : 'rest'; }} class="w-full bg-gray-900 border border-gray-600 rounded p-2 text-sm text-white focus:ring-2 focus:ring-purple-500 outline-none">
                    <option value="">-- Rest --</option>
                    {#each workoutDefinitions as def} <option value={def}>{def}</option> {/each}
                </select>
                </div>
            {/each}
          </div>
          <div class="flex gap-4 mt-8">
            <button on:click={() => step = 2} class="px-6 py-4 rounded-xl bg-gray-800 text-gray-400">Back</button>
            <button on:click={goToStep4} class="flex-1 bg-purple-600 hover:bg-purple-500 text-white font-bold py-4 rounded-xl flex justify-center items-center gap-2">
                Set Progression <ArrowRight size={20} />
            </button>
          </div>
    </div>
  {/if}

  {#if step === 4}
    <div class="max-w-3xl mx-auto animate-fade-in pb-20">
      <h2 class="text-xl font-bold mb-2 flex items-center gap-2"><TrendingUp size={20} class="text-yellow-400"/> Define Progression</h2>
      <p class="text-gray-400 text-sm mb-6">Search for exercises, set volume, and mark Drop Sets.</p>

      <div class="space-y-8">
        {#each workoutDefinitions as typeName, i}
          {@const activeMuscles = selectedGroups[i]}
          {@const baseLibrary = activeMuscles.length > 0 ? exerciseLibrary.filter(ex => activeMuscles.includes(ex.muscle_group)) : exerciseLibrary}

          <WorkoutTypeBuilder 
             {typeName}
             typeIndex={i}
             {activeMuscles}
             bind:exercises={exercisesPerType[typeName]}
             {baseLibrary}
             bind:activeSearch
             on:triggerCustom={(e) => {
                 customExerciseName = e.detail.name;
                 pendingCustomContext = { t: e.detail.t, e: e.detail.e };
                 showCustomExerciseModal = true;
             }}
          />
        {/each}
      </div>

      <div class="flex gap-4 mt-8">
        <button on:click={() => step = 3} class="px-6 py-4 rounded-xl bg-gray-800 text-gray-400">Back</button>
        <button on:click={goToStep5} class="flex-1 bg-purple-600 hover:bg-purple-500 text-white font-bold py-4 rounded-xl flex justify-center items-center gap-2">
            Deload Settings <ArrowRight size={20} />
        </button>
      </div>
    </div>
  {/if}

  {#if step === 5}
    <div class="max-w-2xl mx-auto animate-fade-in pb-20">
        <h2 class="text-xl font-bold mb-6 flex items-center gap-2"><ShieldAlert size={20} class="text-amber-400"/> Deload Strategy</h2>

        <div class="bg-gray-800 border border-gray-700 rounded-xl p-6 mb-8">
            <label class="flex items-center gap-4 cursor-pointer mb-6 border-b border-gray-700 pb-6">
                <input type="checkbox" bind:checked={deloadConfig.enabled} on:change={updateDeloadWeeks} class="w-6 h-6 rounded bg-gray-900 border-gray-600 text-amber-500 focus:ring-amber-500">
                <div>
                    <span class="block font-bold text-white text-lg">Include Deload Phase?</span>
                    <span class="text-sm text-gray-400">Adds recovery weeks at the end of the mesocycle.</span>
                </div>
            </label>

            {#if deloadConfig.enabled}
                <div class="space-y-8 animate-fade-in">
                    <div>
                        <label class="block text-xs font-bold text-gray-500 uppercase mb-3">Deload Duration</label>
                        <div class="flex gap-2">
                            <button on:click={() => { deloadConfig.duration = 1; updateDeloadWeeks(); }} class="flex-1 py-3 rounded-lg border transition-all {deloadConfig.duration === 1 ? 'bg-amber-600/20 border-amber-500 text-amber-400 font-bold' : 'bg-gray-900 border-gray-700 text-gray-400'}">1 Week</button>
                            <button on:click={() => { deloadConfig.duration = 2; updateDeloadWeeks(); }} class="flex-1 py-3 rounded-lg border transition-all {deloadConfig.duration === 2 ? 'bg-amber-600/20 border-amber-500 text-amber-400 font-bold' : 'bg-gray-900 border-gray-700 text-gray-400'}">2 Weeks</button>
                        </div>
                    </div>

                    <div class="space-y-6">
                        {#each deloadConfig.weeks as weekConfig, wIndex}
                            <div class="bg-gray-900/30 border border-gray-700 rounded-xl overflow-hidden">
                                <div class="bg-gray-800/50 px-4 py-2 border-b border-gray-700 font-bold text-amber-500 text-sm uppercase tracking-wide">Week {wIndex + 1} Settings</div>
                                <div class="p-4 space-y-4">
                                    {#each weekConfig as daySettings}
                                        <div class="bg-gray-800 p-4 rounded-lg border border-gray-700">
                                            <div class="flex justify-between items-center mb-3">
                                                <span class="font-bold text-white">{daySettings.workoutName}</span>
                                                <span class="text-xs text-gray-500 font-mono">Day {daySettings.dayIndex}</span>
                                            </div>
                                            <div class="space-y-3">
                                                <div class="flex justify-between items-center">
                                                    <label class="text-xs text-gray-400 font-bold uppercase tracking-wider">Sets Reduction</label>
                                                    <div class="relative w-24"><input type="number" bind:value={daySettings.reduceSets} class="w-full bg-gray-900 border border-gray-600 rounded p-2 pr-6 text-sm text-center focus:border-amber-500 outline-none"/><Percent size={12} class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500" /></div>
                                                </div>
                                                <div class="flex justify-between items-center">
                                                    <label class="text-xs text-gray-400 font-bold uppercase tracking-wider">Weight Reduction</label>
                                                    <div class="relative w-24"><input type="number" bind:value={daySettings.reduceWeight} class="w-full bg-gray-900 border border-gray-600 rounded p-2 pr-6 text-sm text-center focus:border-amber-500 outline-none"/><Percent size={12} class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500" /></div>
                                                </div>
                                                <div class="flex justify-between items-center">
                                                    <label class="text-xs text-gray-400 font-bold uppercase tracking-wider">Reps Reduction</label>
                                                    <div class="relative w-24"><input type="number" bind:value={daySettings.reduceReps} class="w-full bg-gray-900 border border-gray-600 rounded p-2 pr-6 text-sm text-center focus:border-amber-500 outline-none"/><Percent size={12} class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500" /></div>
                                                </div>
                                            </div>
                                        </div>
                                    {/each}
                                </div>
                            </div>
                        {/each}
                    </div>
                </div>
            {/if}
        </div>

        <div class="flex gap-4 mt-8">
            <button on:click={() => step = 4} class="px-6 py-4 rounded-xl bg-gray-800 text-gray-400">Back</button>
            <button on:click={handleGenerateMesocycle} disabled={loading} class="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold py-4 rounded-xl flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                {#if loading} Creating Plan... {:else} Finish & Generate <CheckCircle size={20} /> {/if}
            </button>
        </div>
    </div>
  {/if}

  {#if showCustomExerciseModal}
      <div class="fixed inset-0 z-[60] flex items-center justify-center p-4" style="background-color: rgba(0,0,0,0.8);">
          <CustomExerciseModal 
              initialName={customExerciseName} 
              on:close={() => { showCustomExerciseModal = false; pendingCustomContext = null; }} 
              on:created={handleCustomCreated} 
          />
      </div>
  {/if}
</div>