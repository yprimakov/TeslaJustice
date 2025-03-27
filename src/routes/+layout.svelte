<!-- src/routes/+layout.svelte -->
<script lang="ts">
  import '../app.css';
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabaseClient';
  import type { Profile } from '$lib/types';
  
  let user = null;
  let profile: Profile | null = null;
  let loading = true;
  
  onMount(async () => {
    // Get initial auth state
    const { data } = await supabase.auth.getSession();
    user = data.session?.user || null;
    
    if (user) {
      // Get user profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      profile = profileData;
    }
    
    loading = false;
    
    // Listen for auth changes
    const { data: { subscription } } = await supabase.auth.onAuthStateChange(
      async (event, session) => {
        user = session?.user || null;
        
        if (user) {
          // Get user profile
          const { data: profileData } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();
          
          profile = profileData;
        } else {
          profile = null;
        }
      }
    );
    
    return () => {
      subscription.unsubscribe();
    };
  });
</script>

<div class="min-h-screen bg-gray-100 flex flex-col">
  <!-- Navigation -->
  <nav class="bg-tesla-red text-white shadow-md">
    <div class="container mx-auto px-4 py-3 flex justify-between items-center">
      <a href="/" class="text-2xl font-bold flex items-center">
        <span class="mr-2">⚡</span>
        TeslaJustice
      </a>
      
      <div class="flex items-center space-x-4">
        <a href="/" class="hover:underline {$page.url.pathname === '/' ? 'font-bold' : ''}">
          Dashboard
        </a>
        <a href="/cases" class="hover:underline {$page.url.pathname.startsWith('/cases') ? 'font-bold' : ''}">
          Cases
        </a>
        <a href="/map" class="hover:underline {$page.url.pathname === '/map' ? 'font-bold' : ''}">
          Map
        </a>
        <a href="/about" class="hover:underline {$page.url.pathname === '/about' ? 'font-bold' : ''}">
          About
        </a>
        
        {#if loading}
          <div class="w-8 h-8 rounded-full bg-gray-300 animate-pulse"></div>
        {:else if user}
          <div class="relative group">
            <button class="flex items-center space-x-1">
              <div class="w-8 h-8 rounded-full bg-white text-tesla-red flex items-center justify-center">
                {#if profile?.avatar_url}
                  <img src={profile.avatar_url} alt="Avatar" class="w-8 h-8 rounded-full" />
                {:else}
                  <span>{profile?.full_name?.[0] || user.email?.[0] || '?'}</span>
                {/if}
              </div>
              <span class="hidden md:inline">{profile?.full_name || user.email}</span>
            </button>
            
            <div class="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-10 hidden group-hover:block">
              {#if profile?.role === 'admin' || profile?.role === 'moderator'}
                <a href="/admin" class="block px-4 py-2 text-gray-800 hover:bg-gray-100">
                  Admin Dashboard
                </a>
              {/if}
              <a href="/profile" class="block px-4 py-2 text-gray-800 hover:bg-gray-100">
                Profile
              </a>
              <button 
                class="block w-full text-left px-4 py-2 text-gray-800 hover:bg-gray-100"
                on:click={() => supabase.auth.signOut()}
              >
                Sign Out
              </button>
            </div>
          </div>
        {:else}
          <a href="/login" class="bg-white text-tesla-red px-4 py-2 rounded-md hover:bg-gray-100">
            Sign In
          </a>
        {/if}
      </div>
    </div>
  </nav>
  
  <!-- Main content -->
  <main class="flex-grow container mx-auto px-4 py-8">
    <slot />
  </main>
  
  <!-- Footer -->
  <footer class="bg-gray-800 text-white py-8">
    <div class="container mx-auto px-4">
      <div class="flex flex-col md:flex-row justify-between">
        <div class="mb-4 md:mb-0">
          <h3 class="text-xl font-bold mb-2">TeslaJustice</h3>
          <p class="text-gray-400">Tracking and documenting Tesla vandalism incidents</p>
        </div>
        
        <div class="grid grid-cols-2 gap-8">
          <div>
            <h4 class="text-lg font-semibold mb-2">Links</h4>
            <ul class="space-y-2">
              <li><a href="/" class="text-gray-400 hover:text-white">Home</a></li>
              <li><a href="/cases" class="text-gray-400 hover:text-white">Cases</a></li>
              <li><a href="/map" class="text-gray-400 hover:text-white">Map</a></li>
              <li><a href="/about" class="text-gray-400 hover:text-white">About</a></li>
            </ul>
          </div>
          
          <div>
            <h4 class="text-lg font-semibold mb-2">Connect</h4>
            <ul class="space-y-2">
              <li><a href="https://twitter.com/TeslaJustice" target="_blank" rel="noopener noreferrer" class="text-gray-400 hover:text-white">Twitter</a></li>
              <li><a href="https://github.com/yprimakov/TeslaJustice" target="_blank" rel="noopener noreferrer" class="text-gray-400 hover:text-white">GitHub</a></li>
            </ul>
          </div>
        </div>
      </div>
      
      <div class="mt-8 pt-8 border-t border-gray-700 text-gray-400 text-sm text-center">
        &copy; {new Date().getFullYear()} TeslaJustice. All rights reserved.
      </div>
    </div>
  </footer>
</div>
