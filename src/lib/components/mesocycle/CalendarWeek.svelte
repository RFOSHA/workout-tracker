<script lang="ts">
  import { CheckCircle, PlayCircle, Circle } from "lucide-svelte";

  export let week: any[];
  export let wIndex: number;
  export let mesocycle: any;

  function getDateForSlot(dayIndex: number) {
      if (!mesocycle) return "";
      const startDate = new Date(mesocycle.start_date);
      const daysToAdd = (wIndex * mesocycle.days_per_week) + dayIndex;
      startDate.setDate(startDate.getDate() + daysToAdd);
      return startDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }

  function getWeekRange() {
      if (!mesocycle) return "";
      const startDate = new Date(mesocycle.start_date);
      startDate.setDate(startDate.getDate() + (wIndex * mesocycle.days_per_week));
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + (mesocycle.days_per_week - 1));
      return `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  }
</script>

<div class="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
  <div class="flex justify-between items-end mb-3">
      <h3 class="text-xs font-bold text-gray-500 uppercase tracking-widest">
          Week {wIndex + 1}
      </h3>
      <span class="text-[10px] text-gray-600 font-mono bg-gray-900 px-2 py-1 rounded">
          {getWeekRange()}
      </span>
  </div>

  <div class="grid grid-cols-1 gap-3">
      {#each week as day, dIndex}
          {@const dateString = getDateForSlot(dIndex)}

          {#if day}
              <a 
                  href="/workout/{day.id}"
                  class="relative group block p-3 rounded-lg border transition-all
                  {day.completed 
                      ? 'bg-green-900/10 border-green-900/30 text-gray-300' 
                      : day.started_at 
                      ? 'bg-amber-900/10 border-amber-600/30 text-white' 
                      : 'bg-gray-800 border-gray-700 hover:border-gray-500'}"
              >
                  <div class="flex items-center justify-between">
                      <div class="flex items-center gap-4">
                          <div class="shrink-0">
                              {#if day.completed}
                                  <CheckCircle class="text-green-500" size={22} />
                              {:else if day.started_at}
                                  <PlayCircle class="text-amber-500" size={22} />
                              {:else}
                                  <Circle class="text-gray-600" size={22} />
                              {/if}
                          </div>

                          <div>
                              <span class="block font-bold text-sm text-white">{day.name}</span>
                              <div class="flex gap-2 text-xs opacity-60 mt-0.5">
                                  <span class="text-blue-300">{dateString}</span>
                                  <span>•</span>
                                  <span>Day {day.day_number}</span>
                              </div>
                          </div>
                      </div>

                      <div class="text-xs font-bold opacity-60">
                          {#if day.completed} Done
                          {:else if day.started_at} Resume
                          {:else} Start
                          {/if}
                      </div>
                  </div>
              </a>
          {:else}
              <div class="p-3 rounded-lg border border-gray-800 border-dashed text-gray-600 flex items-center justify-between opacity-70">
                  <div class="flex items-center gap-4">
                      <div class="w-[22px] flex justify-center">
                          <div class="w-1.5 h-1.5 rounded-full bg-gray-700"></div>
                      </div>
                      <div>
                          <span class="block text-sm font-medium italic">Rest Day</span>
                          <span class="text-xs text-gray-700">{dateString}</span>
                      </div>
                  </div>
              </div>
          {/if}
      {/each}
  </div>
</div>