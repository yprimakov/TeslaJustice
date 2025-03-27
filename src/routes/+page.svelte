<!-- src/routes/+page.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabaseClient';
  import type { Case, CaseMedia } from '$lib/types';
  
  let recentCases: (Case & { media: CaseMedia[] })[] = [];
  let casesByStatus = {
    reported: 0,
    verified: 0,
    identified: 0,
    apprehended: 0,
    prosecuted: 0,
    resolved: 0
  };
  let casesByTargetType = {
    vehicle: 0,
    building: 0,
    property: 0
  };
  let loading = true;
  let error = '';
  
  onMount(async () => {
    try {
      // Get recent cases
      const { data: cases, error: casesError } = await supabase
        .from('cases')
        .select('*, media:case_media(*)')
        .order('created_at', { ascending: false })
        .limit(6);
      
      if (casesError) throw casesError;
      recentCases = cases || [];
      
      // Get case counts by status
      const { data: statusCounts, error: statusError } = await supabase
        .from('cases')
        .select('status, count(*)')
        .group('status');
      
      if (statusError) throw statusError;
      
      statusCounts?.forEach(item => {
        if (item.status in casesByStatus) {
          casesByStatus[item.status] = item.count;
        }
      });
      
      // Get case counts by target type
      const { data: targetCounts, error: targetError } = await supabase
        .from('cases')
        .select('target_type, count(*)')
        .group('target_type');
      
      if (targetError) throw targetError;
      
      targetCounts?.forEach(item => {
        if (item.target_type in casesByTargetType) {
          casesByTargetType[item.target_type] = item.count;
        }
      });
      
      loading = false;
    } catch (e) {
      console.error('Error loading dashboard data:', e);
      error = 'Failed to load dashboard data';
      loading = false;
    }
  });
  
  function getStatusColor(status: string): string {
    switch (status) {
      case 'reported': return 'bg-yellow-500';
      case 'verified': return 'bg-blue-500';
      case 'identified': return 'bg-purple-500';
      case 'apprehended': return 'bg-green-500';
      case 'prosecuted': return 'bg-indigo-500';
      case 'resolved': return 'bg-green-700';
      case 'unresolved': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  }
  
  function getTargetTypeIcon(type: string): string {
    switch (type) {
      case 'vehicle': return '🚗';
      case 'building': return '🏢';
      case 'property': return '📱';
      default: return '❓';
    }
  }
  
  function formatDate(dateString: string): string {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(date);
  }
</script>

<svelte:head>
  <title>TeslaJustice - Tracking Tesla Vandalism</title>
</svelte:head>

<div>
  <!-- Hero section -->
  <div class="bg-tesla-red text-white rounded-lg p-8 mb-8 shadow-lg">
    <h1 class="text-3xl md:text-4xl font-bold mb-4">Tracking Tesla Vandalism</h1>
    <p class="text-xl mb-6">
      TeslaJustice monitors social media to document cases of vandalism against Tesla vehicles, buildings, and property.
    </p>
    <div class="flex flex-wrap gap-4">
      <a href="/cases" class="bg-white text-tesla-red px-6 py-3 rounded-md font-semibold hover:bg-gray-100 transition">
        Browse Cases
      </a>
      <a href="/map" class="bg-transparent border-2 border-white text-white px-6 py-3 rounded-md font-semibold hover:bg-white/10 transition">
        View Map
      </a>
    </div>
  </div>
  
  {#if loading}
    <div class="flex justify-center items-center py-12">
      <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-tesla-red"></div>
    </div>
  {:else if error}
    <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-8">
      <p>{error}</p>
    </div>
  {:else}
    <!-- Stats overview -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      <!-- Status breakdown -->
      <div class="bg-white rounded-lg shadow p-6">
        <h2 class="text-xl font-semibold mb-4">Case Status</h2>
        <div class="space-y-3">
          {#each Object.entries(casesByStatus) as [status, count]}
            <div class="flex items-center">
              <div class="w-3 h-3 rounded-full {getStatusColor(status)} mr-2"></div>
              <span class="capitalize">{status}</span>
              <span class="ml-auto font-semibold">{count}</span>
            </div>
          {/each}
        </div>
      </div>
      
      <!-- Target type breakdown -->
      <div class="bg-white rounded-lg shadow p-6">
        <h2 class="text-xl font-semibold mb-4">Target Types</h2>
        <div class="space-y-3">
          {#each Object.entries(casesByTargetType) as [type, count]}
            <div class="flex items-center">
              <div class="w-6 h-6 flex items-center justify-center mr-2">{getTargetTypeIcon(type)}</div>
              <span class="capitalize">{type}</span>
              <span class="ml-auto font-semibold">{count}</span>
            </div>
          {/each}
        </div>
      </div>
      
      <!-- Quick actions -->
      <div class="bg-white rounded-lg shadow p-6">
        <h2 class="text-xl font-semibold mb-4">Quick Actions</h2>
        <div class="space-y-3">
          <a href="/cases" class="block bg-gray-100 hover:bg-gray-200 p-3 rounded transition">
            <div class="flex items-center">
              <span class="mr-2">🔍</span>
              <span>Search All Cases</span>
            </div>
          </a>
          <a href="/cases/latest" class="block bg-gray-100 hover:bg-gray-200 p-3 rounded transition">
            <div class="flex items-center">
              <span class="mr-2">🕒</span>
              <span>Latest Updates</span>
            </div>
          </a>
          <a href="/map" class="block bg-gray-100 hover:bg-gray-200 p-3 rounded transition">
            <div class="flex items-center">
              <span class="mr-2">🗺️</span>
              <span>View Map</span>
            </div>
          </a>
        </div>
      </div>
    </div>
    
    <!-- Recent cases -->
    <h2 class="text-2xl font-bold mb-4">Recent Cases</h2>
    
    {#if recentCases.length === 0}
      <div class="bg-gray-100 p-6 rounded-lg text-center">
        <p class="text-gray-600">No cases found. The system is monitoring social media for new incidents.</p>
      </div>
    {:else}
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {#each recentCases as case_}
          <a href="/cases/{case_.id}" class="bg-white rounded-lg shadow overflow-hidden hover:shadow-md transition">
            <!-- Case media (if available) -->
            {#if case_.media && case_.media.length > 0}
              <div class="h-48 bg-gray-200 relative">
                {#if case_.media[0].media_type === 'video'}
                  <div class="absolute inset-0 flex items-center justify-center">
                    <div class="w-16 h-16 bg-black bg-opacity-50 rounded-full flex items-center justify-center">
                      <div class="w-0 h-0 border-t-8 border-t-transparent border-l-16 border-l-white border-b-8 border-b-transparent ml-1"></div>
                    </div>
                  </div>
                  <img src={case_.media[0].thumbnail_url || '/placeholder-image.jpg'} alt="Case thumbnail" class="w-full h-full object-cover" />
                {:else}
                  <img src={case_.media[0].url || '/placeholder-image.jpg'} alt="Case image" class="w-full h-full object-cover" />
                {/if}
              </div>
            {:else}
              <div class="h-48 bg-gray-200 flex items-center justify-center">
                <div class="text-4xl">{getTargetTypeIcon(case_.target_type)}</div>
              </div>
            {/if}
            
            <!-- Case info -->
            <div class="p-4">
              <div class="flex items-center mb-2">
                <span class="px-2 py-1 text-xs rounded-full text-white {getStatusColor(case_.status)} mr-2">
                  {case_.status}
                </span>
                <span class="text-sm text-gray-600">{formatDate(case_.created_at)}</span>
              </div>
              <h3 class="font-semibold text-lg mb-2 line-clamp-2">{case_.headline}</h3>
              <p class="text-gray-600 text-sm line-clamp-3">{case_.summary}</p>
            </div>
          </a>
        {/each}
      </div>
      
      <div class="mt-6 text-center">
        <a href="/cases" class="inline-block bg-tesla-red text-white px-6 py-3 rounded-md font-semibold hover:bg-red-700 transition">
          View All Cases
        </a>
      </div>
    {/if}
  {/if}
</div>
