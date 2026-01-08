<script lang="ts">
  import { supabase } from "$lib/supabaseClient";
  
  let loading = false;
  let email = "";
  let password = "";
  let message = "";
  let isSignUp = false; // Toggle between Login and Sign Up

  const handleAuth = async () => {
    try {
      loading = true;
      message = "";
      
      if (isSignUp) {
        // Sign Up Logic
        const { error } = await supabase.auth.signUp({ 
          email, 
          password 
        });
        if (error) throw error;
        message = "Account created! Check your email to confirm.";
      } else {
        // Login Logic
        const { error } = await supabase.auth.signInWithPassword({ 
          email, 
          password 
        });
        if (error) throw error;
        // No message needed on success, the onAuthStateChange in +layout.svelte handles the redirect
      }
    } catch (error) {
        if (error instanceof Error) {
            message = error.message;
        } else {
            message = "An unexpected error occurred";
        }
    } finally {
      loading = false;
    }
  };
</script>

<div class="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-4">
  <div class="w-full max-w-md bg-gray-800 rounded-lg shadow-lg p-8">
    <h1 class="text-3xl font-bold text-center mb-6 text-blue-400">
      {isSignUp ? 'Create Account' : 'Welcome Back'}
    </h1>
    
    <div class="space-y-4">
      <div>
        <label class="block text-sm font-medium mb-1" for="email">Email</label>
        <input 
          id="email" 
          type="email" 
          bind:value={email} 
          class="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-blue-500" 
          placeholder="your@email.com"
        />
      </div>

      <div>
        <label class="block text-sm font-medium mb-1" for="password">Password</label>
        <input 
          id="password" 
          type="password" 
          bind:value={password} 
          class="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-blue-500" 
          placeholder="••••••••"
        />
      </div>

      <button 
        on:click={handleAuth} 
        disabled={loading} 
        class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition-colors disabled:opacity-50"
      >
        {loading ? 'Processing...' : (isSignUp ? 'Sign Up' : 'Log In')}
      </button>

      {#if message}
        <div class="mt-4 p-3 rounded bg-gray-700 text-center text-sm text-yellow-300">{message}</div>
      {/if}

      <div class="text-center mt-4 text-sm text-gray-400">
        {isSignUp ? "Already have an account?" : "Don't have an account?"}
        <button 
          on:click={() => { isSignUp = !isSignUp; message = ""; }} 
          class="text-blue-400 hover:underline ml-1"
        >
          {isSignUp ? "Log In" : "Sign Up"}
        </button>
      </div>
    </div>
  </div>
</div>