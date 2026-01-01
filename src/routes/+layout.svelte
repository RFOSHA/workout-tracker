<script lang="ts">
  import '../app.css';
  import { House, Dumbbell, Calendar, History, User } from 'lucide-svelte';
  import type { Session } from "@supabase/supabase-js";
  import { supabase } from "$lib/supabaseClient";
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { page } from '$app/stores';

  let session: Session | null = null;
  let activeWorkoutId: number | null = null; // 👈 Track this

  onMount(() => {
    supabase.auth.getSession().then(({ data }) => {
      session = data.session;
      if (session) checkActiveWorkout(); // Check on load
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, _session) => {
      session = _session;
      if (_session) checkActiveWorkout(); 
      else goto('/');
    });

    return () => subscription.unsubscribe();
  });

  // 👇 New Helper to find where the button should link
  async function checkActiveWorkout() {
    // Find the next incomplete workout
    // We order by week/day to find the "current" one
    const { data } = await supabase
      .from('workouts')
      .select('id')
      .eq('completed', false)
      .order('week_number', { ascending: true })
      .order('day_number', { ascending: true })
      .limit(1)
      .maybeSingle();
    
    if (data) activeWorkoutId = data.id;
  }
</script>

<div class="min-h-screen flex flex-col font-sans bg-sleeper-bg text-sleeper-text pb-24">
  <main class="flex-1 p-4 max-w-md mx-auto w-full">
    <slot />
  </main>

  <nav class="fixed bottom-0 left-0 w-full bg-sleeper-card/10 backdrop-blur-md border-t border-slate-700 pb-safe z-50 shadow-2xl">
    <div class="max-w-md mx-auto flex justify-around items-center p-3">
      
      <a href="/" class="flex flex-col items-center gap-1 {$page.url.pathname === '/' ? 'text-sleeper-accent' : 'text-sleeper-muted hover:text-white'} transition">
          <House size={24} />
          <span class="text-[10px] mt-1 font-medium">Home</span>
      </a>

      <a 
        href={activeWorkoutId ? `/workout/${activeWorkoutId}` : '/'} 
        class="flex flex-col items-center gap-1 {$page.url.pathname.includes('/workout') ? 'text-sleeper-accent' : 'text-sleeper-muted hover:text-white'} transition"
      >
        <Dumbbell size={24} />
        <span class="text-[10px] font-medium">Workout</span>
      </a>

      <a href="/mesocycle"  class="flex flex-col items-center gap-1 {$page.url.pathname === '/mesocycle' ? 'text-sleeper-accent' : 'text-sleeper-muted hover:text-white'} transition">
        <Calendar size={24} />
        <span class="text-[10px] font-medium">Meso</span>
      </a>

      <button class="flex flex-col items-center gap-1 text-sleeper-muted hover:text-white transition">
        <User size={24} />
        <span class="text-[10px] font-medium">Profile</span>
      </button>
      
    </div>
  </nav>
</div>

<style>
  /* Handle iPhone home bar spacing */
  .pb-safe {
    padding-bottom: env(safe-area-inset-bottom);
  }
</style>