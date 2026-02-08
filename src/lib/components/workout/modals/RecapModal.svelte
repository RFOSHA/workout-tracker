<script lang="ts">
  import { goto } from "$app/navigation";
  import Modal from "$lib/components/common/Modal.svelte";
  // Import missing icons and utility
  import { BarChart2, Layers, Calendar, Filter, Dumbbell, TrendingUp } from "lucide-svelte";
  import { getWeeklyChartData } from "$lib/utils/getWeeklyChartData";

  export let recapLoading = false;
  export let recapData: any = null;

  let selectedRecapMuscle = "All";

  // Reactive statement to update chart when filter changes
  $: weeklyChartData = getWeeklyChartData(recapData, selectedRecapMuscle);

  function formatNumber(num: number) {
    return new Intl.NumberFormat('en-US').format(num);
  }
</script>

<Modal widthClass="w-full sm:max-w-2xl" on:close={() => goto('/')}>
    <div class="flex justify-between items-center mb-6 shrink-0">
        <div>
            <h2 class="text-2xl font-bold flex items-center gap-2 text-white">
                <BarChart2 size={24} class="text-blue-400"/> Mesocycle Complete!
            </h2>
            <p class="text-sm text-gray-400 mt-1">Great job finishing the block.</p>
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
                <div class="flex justify-between items-end mb-4">
                    <h3 class="text-lg font-bold text-white flex items-center gap-2">
                        <Calendar size={18} class="text-blue-400"/> Weekly Sets
                    </h3>
                    <div class="relative">
                        <select 
                            bind:value={selectedRecapMuscle}
                            class="appearance-none bg-gray-800 text-xs text-white border border-gray-600 rounded px-3 py-1 pr-8 focus:outline-none focus:border-blue-500"
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
                <div class="bg-gray-800/30 rounded-xl p-4 border border-gray-700/50 h-48 flex items-end justify-between gap-2">
                    {#each weeklyChartData.bars as w}
                        {@const heightPercent = weeklyChartData.max > 0 ? (w.count / weeklyChartData.max) * 100 : 0}
                        <div class="flex-1 flex flex-col items-center gap-1 group h-full justify-end">
                            <span class="text-[10px] text-gray-400 font-bold opacity-0 group-hover:opacity-100 transition-opacity">{w.count}</span>
                            <div 
                                class="w-full bg-blue-600 rounded-t hover:bg-blue-500 transition-all relative group-hover:shadow-[0_0_10px_rgba(37,99,235,0.5)]" 
                                style="height: {heightPercent}%; min-height: 1px;"
                            ></div>
                            <span class="text-[10px] text-gray-500 font-mono">W{w.week}</span>
                        </div>
                    {/each}
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

            <div class="pt-4">
                <button on:click={() => goto('/')} class="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl shadow-lg">
                    Return Home
                </button>
            </div>
        </div>
    {/if}
</Modal>