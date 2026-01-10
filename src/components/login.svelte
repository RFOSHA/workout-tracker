<script lang="ts">
  import { supabase } from "$lib/supabaseClient";
  
  let loading = false;
  let email = "";
  let password = "";
  let message = "";
  
  // Modes: 'signin' | 'signup' | 'reset'
  let mode = 'signin';

  const handleAuth = async () => {
    try {
      loading = true;
      message = "";
      
      if (mode === 'reset') {
        // --- PASSWORD RESET REQUEST ---
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/update-password`,
        });
        if (error) throw error;
        message = "Check your email for the password reset link!";
      
      } else if (mode === 'signup') {
        // --- SIGN UP ---
        const { error } = await supabase.auth.signUp({ 
          email, 
          password 
        });
        if (error) throw error;
        message = "Success! Check your email to confirm your account.";
      
      } else {
        // --- SIGN IN ---
        const { error } = await supabase.auth.signInWithPassword({ 
          email, 
          password 
        });
        if (error) throw error;
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
  <div class="w-full max-w-md bg-gray-800 rounded-lg shadow-lg p-8 border border-gray-700">
    <h1 class="text-3xl font-bold text-center mb-2 text-blue-400">
      {#if mode === 'reset'} Reset Password
      {:else if mode === 'signup'} Create Account
      {:else} Workout Tracker {/if}
    </h1>
    
    <p class="text-gray-400 text-center mb-8 text-sm">
      {#if mode === 'reset'} Enter your email to receive a reset link
      {:else if mode === 'signup'} Sign up to start tracking
      {:else} Sign in to continue {/if}
    </p>
    
    <div class="space-y-4">
      <div>
        <label class="block text-xs font-bold text-gray-500 uppercase mb-1" for="email">Email</label>
        <input 
            id="email" 
            type="email" 
            bind:value={email} 
            class="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded text-white focus:border-blue-500 outline-none transition-colors" 
            placeholder="your@email.com"
        />
      </div>

      {#if mode !== 'reset'}
        <div>
          <label class="block text-xs font-bold text-gray-500 uppercase mb-1" for="password">Password</label>
          <input 
              id="password" 
              type="password" 
              bind:value={password} 
              class="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded text-white focus:border-blue-500 outline-none transition-colors" 
              placeholder="••••••••"
          />
        </div>
      {/if}

      <button 
        on:click={handleAuth} 
        disabled={loading} 
        class="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-4 rounded-lg transition-colors mt-2 disabled:opacity-50"
      >
        {#if loading} Processing...
        {:else if mode === 'reset'} Send Reset Link
        {:else if mode === 'signup'} Sign Up
        {:else} Sign In {/if}
      </button>

      {#if message}
        <div class="mt-4 p-3 rounded bg-gray-900 border border-gray-700 text-center text-sm {message.includes('Success') || message.includes('Check') ? 'text-green-400' : 'text-red-400'}">
            {message}
        </div>
      {/if}

      <div class="mt-6 text-center text-sm text-gray-400 flex flex-col gap-2">
        {#if mode === 'signin'}
            <div>
                Don't have an account? 
                <button class="text-blue-400 hover:underline font-bold" on:click={() => { mode = 'signup'; message = ""; }}>Sign Up</button>
            </div>
            <button class="text-gray-500 hover:text-gray-300 text-xs" on:click={() => { mode = 'reset'; message = ""; }}>Forgot Password?</button>
        {:else}
            <div>
                Already have an account? 
                <button class="text-blue-400 hover:underline font-bold" on:click={() => { mode = 'signin'; message = ""; }}>Sign In</button>
            </div>
        {/if}
      </div>
    </div>
  </div>
</div>