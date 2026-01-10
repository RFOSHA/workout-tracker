<script lang="ts">
  import { supabase } from "$lib/supabaseClient";
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";

  let password = "";
  let loading = false;
  let message = "";

  // Ensure user is actually logged in (via the reset link)
  onMount(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        // If no session, they shouldn't be here
        goto('/');
    }
  });

  const handleUpdatePassword = async () => {
    try {
      loading = true;
      message = "";
      
      const { error } = await supabase.auth.updateUser({ 
        password: password 
      });

      if (error) throw error;
      
      alert("Password updated successfully!");
      goto('/');
      
    } catch (error) {
        if (error instanceof Error) {
            message = error.message;
        }
    } finally {
      loading = false;
    }
  };
</script>

<div class="min-h-screen bg-gray-900 text-white flex items-center justify-center p-4">
  <div class="w-full max-w-md bg-gray-800 rounded-lg shadow-lg p-8 border border-gray-700">
    <h1 class="text-2xl font-bold text-center mb-6 text-blue-400">Set New Password</h1>
    
    <div class="space-y-4">
      <div>
        <label class="block text-xs font-bold text-gray-500 uppercase mb-1" for="new-password">New Password</label>
        <input 
            id="new-password" 
            type="password" 
            bind:value={password} 
            class="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded text-white focus:border-blue-500 outline-none" 
            placeholder="••••••••"
        />
      </div>

      <button 
        on:click={handleUpdatePassword} 
        disabled={loading} 
        class="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-4 rounded-lg transition-colors disabled:opacity-50"
      >
        {loading ? 'Updating...' : 'Update Password'}
      </button>

      {#if message}
        <div class="mt-4 p-3 rounded bg-red-900/20 border border-red-900/50 text-center text-sm text-red-400">
            {message}
        </div>
      {/if}
    </div>
  </div>
</div>