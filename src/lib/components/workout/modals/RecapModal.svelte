<script lang="ts">
  import { goto } from "$app/navigation";
  import Modal from "$lib/components/common/Modal.svelte";
  // Import missing icons and utility
  import { BarChart2, Layers, Calendar, Filter, Dumbbell, TrendingUp } from "lucide-svelte";
  import { getWeeklyChartData } from "$lib/utils/getWeeklyChartData";
  import { createEventDispatcher } from "svelte";

  // Initialize dispatcher
  const dispatch = createEventDispatcher();

  export let recapLoading = false;
  export let recapData: any = null;
  export let isComplete = false;
  export let completedMeso: any = null;

  let selectedRecapMuscle = "All";
  let chartMetric: 'sets' | 'volume' = 'sets';

  // Reactive — reruns whenever filter or metric changes
  $: weeklyChartData = getWeeklyChartData(recapData, selectedRecapMuscle, chartMetric);

  function formatNumber(num: number) {
    return new Intl.NumberFormat('en-US').format(num);
  }

  // Compact label shown inside bar tooltip (e.g. "42" or "12.5k")
  function formatBarLabel(count: number): string {
    if (chartMetric === 'volume' && count >= 1000) {
      return `${(count / 1000).toFixed(1)}k`;
    }
    return String(count);
  }
</script>

<Modal widthClass="w-full sm:max-w-2xl" on:close={() => dispatch('close')}>  
    <div class="flex justify-between items-center mb-6 shrink-0">
        <div>
            <h2 class="text-2xl font-bold flex items-center gap-2 text-white">
                <BarChart2 size={24} class="text-blue-400"/> 
                {isComplete ? 'Workout Plan Complete!' : 'Plan Progress'}
            </h2>
            <p class="text-sm text-gray-400 mt-1">
                {isComplete ? 'Great work finishing your plan!' : "Here is your progress so far."}
            </p>
        </div>
    </div>

    {#if recapLoading}
        <div class="flex-1 flex items-center justify-center p-12 text-gray-500">
            Calculating stats...
        </div>
    {:else if recapData}
        <div class="flex-1 overflow-y-auto pr-2 space-y-8">
            
            <div class="grid grid-cols-1 gap-4">
                <div class="bg-gradient-to-br from-gray-800 to-gray-800/50 p-5 rounded-xl border border-gray-700">
                    <div class="flex items-center gap-3 mb-2">
                        <div class="bg-blue-900/50 p-2 rounded-lg text-blue-400"><Layers size={20}/></div>
                        <span class="text-sm text-gray-400 uppercase tracking-widest font-bold">Total Volume</span>
                    </div>
                    <div class="text-4xl font-black text-white tracking-tight">
                        {formatNumber(recapData.totalVolume)} <span class="text-lg text-gray-500 font-medium">lbs</span>
                    </div>
                </div>
            </div>

            <div>
                <!-- Header row: title + metric toggle + muscle filter -->
                <div class="flex justify-between items-center mb-3">
                    <h3 class="text-lg font-bold text-white flex items-center gap-2">
                        <Calendar size={18} class="text-blue-400"/>
                        Weekly {chartMetric === 'sets' ? 'Sets' : 'Volume'}
                    </h3>
                    <div class="flex items-center gap-2">
                        <!-- Sets / Volume toggle -->
                        <div class="flex gap-1">
                            <button
                                on:click={() => chartMetric = 'sets'}
                                class="text-xs px-2.5 py-1 rounded-full font-bold transition-colors
                                    {chartMetric === 'sets' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400 hover:text-white'}"
                            >Sets</button>
                            <button
                                on:click={() => chartMetric = 'volume'}
                                class="text-xs px-2.5 py-1 rounded-full font-bold transition-colors
                                    {chartMetric === 'volume' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400 hover:text-white'}"
                            >Volume</button>
                        </div>
                        <!-- Muscle filter -->
                        <div class="relative">
                            <select
                                bind:value={selectedRecapMuscle}
                                class="appearance-none bg-gray-800 text-xs text-white border border-gray-600 rounded px-3 py-1 pr-7 focus:outline-none focus:border-blue-500"
                            >
                                <option value="All">All Muscles</option>
                                {#if recapData.muscleStats}
                                    {#each recapData.muscleStats as m}
                                        <option value={m.name}>{m.name}</option>
                                    {/each}
                                {/if}
                            </select>
                            <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
                                <Filter size={12} />
                            </div>
                        </div>
                    </div>
                </div>

                <div class="bg-gray-800/30 rounded-xl p-4 border border-gray-700/50">
                    <!-- Bars: fixed pixel heights so labels don't distort bar sizing -->
                    <div class="h-36 flex items-end gap-2">
                        {#each weeklyChartData.bars as w}
                            {@const barPx = weeklyChartData.max > 0
                                ? Math.round((w.count / weeklyChartData.max) * 118)
                                : 0}
                            <div class="flex-1 h-full flex flex-col items-center justify-end group">
                                <!-- Count label: fixed 16px slot so all columns are the same height -->
                                <div class="h-4 flex items-end justify-center">
                                    <span class="text-[10px] text-gray-400 font-bold leading-none opacity-0 group-hover:opacity-100 transition-opacity">
                                        {w.count > 0 ? formatBarLabel(w.count) : ''}
                                    </span>
                                </div>
                                <div
                                    class="w-full mt-1 rounded-t flex-shrink-0 transition-colors
                                        {barPx > 0 ? 'bg-blue-600 hover:bg-blue-500 group-hover:shadow-[0_0_8px_rgba(37,99,235,0.4)]' : ''}"
                                    style="height: {barPx > 0 ? Math.max(barPx, 3) : 0}px;"
                                ></div>
                            </div>
                        {/each}
                    </div>
                    <!-- Week labels: separate row below bars so they don't compress bar height -->
                    <div class="flex gap-2 mt-2">
                        {#each weeklyChartData.bars as w}
                            <div class="flex-1 text-center">
                                <span class="text-[10px] text-gray-500 font-mono">W{w.week}</span>
                            </div>
                        {/each}
                    </div>
                </div>
            </div>

            <div>
                <h3 class="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <Dumbbell size={18} class="text-purple-400"/> Sets per Muscle
                </h3>
                <div class="space-y-3">
                    {#each recapData.muscleStats as m}
                        {@const maxVal = recapData.muscleStats[0].count}
                        {@const widthPercent = (m.count / maxVal) * 100}
                        <div>
                            <div class="flex justify-between text-xs mb-1 font-bold">
                                <span class="text-gray-300">{m.name}</span>
                                <span class="text-purple-300">{m.count} Sets</span>
                            </div>
                            <div class="h-3 w-full bg-gray-800 rounded-full overflow-hidden">
                                <div class="h-full bg-purple-600 rounded-full" style="width: {widthPercent}%"></div>
                            </div>
                        </div>
                    {/each}
                </div>
            </div>

            {#if recapData.progress && recapData.progress.length > 0}
                <div>
                    <h3 class="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <TrendingUp size={18} class="text-green-400"/> Lift Progress
                    </h3>
                    <div class="bg-gray-800/50 rounded-xl border border-gray-700 overflow-hidden">
                        <div class="grid grid-cols-[1fr_80px_80px] gap-2 p-3 border-b border-gray-700 text-xs font-bold text-gray-500 uppercase">
                            <span>Exercise</span>
                            <span class="text-center">Start</span>
                            <span class="text-center">End</span>
                        </div>
                        {#each recapData.progress as p}
                            <div class="grid grid-cols-[1fr_80px_80px] gap-2 p-3 border-b border-gray-800 last:border-0 items-center">
                                <div class="font-medium text-sm text-gray-200">{p.name}</div>
                                <div class="text-center text-xs text-gray-400">{p.start.weight} lbs</div>
                                <div class="text-center text-xs">
                                    <div class="font-bold {p.deltaWeight >= 0 ? 'text-green-400' : 'text-red-400'}">
                                        {p.end.weight} lbs
                                    </div>
                                    {#if p.deltaWeight !== 0}
                                        <div class="text-[10px] {p.deltaWeight > 0 ? 'text-green-500' : 'text-red-500'}">
                                            {p.deltaWeight > 0 ? '+' : ''}{p.deltaWeight}
                                        </div>
                                    {/if}
                                </div>
                            </div>
                        {/each}
                    </div>
                </div>
            {/if}

            <div class="pt-4 space-y-3">
                {#if isComplete && completedMeso}
                    <button
                        on:click={() => dispatch('planNext')}
                        class="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 rounded-xl shadow-lg flex items-center justify-center gap-2"
                    >
                        Plan My Next Block →
                    </button>
                {/if}
                <button on:click={() => goto('/')} class="w-full bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 rounded-xl transition-colors">
                    Return Home
                </button>
            </div>
        </div>
    {/if}
</Modal>