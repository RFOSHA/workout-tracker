<script>
  import { supabase } from "$lib/supabaseClient";
  
  let loading = false;
  let email = "";
  let message = "";

  const handleLogin = async () => {
    try {
      loading = true;
      message = "";
      const { error } = await supabase.auth.signInWithOtp({ email });
      if (error) throw error;
      message = "Check your email for the login link!";
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
    <h1 class="text-3xl font-bold text-center mb-6 text-blue-400">Workout Tracker</h1>
    <p class="text-gray-400 text-center mb-8">Sign in via Magic Link</p>
    
    <div class="space-y-4">
      <div>
        <label class="block text-sm font-medium mb-1" for="email">Email</label>
        <input id="email" type="email" bind:value={email} class="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded text-white" placeholder="your@email.com"/>
      </div>
      <button on:click={handleLogin} disabled={loading} class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
        {loading ? 'Sending...' : 'Send Magic Link'}
      </button>
      {#if message}
        <div class="mt-4 p-3 rounded bg-gray-700 text-center text-sm">{message}</div>
      {/if}
    </div>
  </div>
</div>