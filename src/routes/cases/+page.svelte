<!-- src/routes/cases/+page.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabaseClient';
  import type { Case, CaseMedia } from '$lib/types';
  
  let cases: (Case & { media: CaseMedia[] })[] = [];
  let loading = true;
  let error = '';
  
  // Pagination
  let page = 1;
  let pageSize = 12;
  let totalPages = 1;
  let totalCount = 0;
  
  // Filters
  let statusFilter = '';
  let targetTypeFilter = '';
  let searchQuery = '';
  let locationFilter = '';
  
  // Status options
  const statusOptions = [
    { value: '', label: 'All Statuses' },
    { value: 'reported', label: 'Reported' },
    { value: 'verified', label: 'Verified' },
    { value: 'identified', label: 'Identified' },
    { value: 'apprehended', label: 'Apprehended' },
    { value: 'prosecuted', label: 'Prosecuted' },
    { value: 'resolved', label: 'Resolved' },
    { value: 'unresolved', label: 'Unresolved' }
  ];
  
  // Target type options
  const targetTypeOptions = [
    { value: '', label: 'All Types' },
    { value: 'vehicle', label: '🚗 Vehicle' },
    { value: 'building', label: '🏢 Building' },
    { value: 'property', label: '📱 Property' }
  ];
  
  onMount(async () => {
    await loadCases();
  });
  
  async function loadCases() {
    loading = true;
    error = '';
    
    try {
      let query = supabase
        .from('cases')
        .select('*, media:case_media(*)');
      
      // Apply filters
      if (statusFilter) {
        query = query.eq('status', statusFilter);
      }
      
      if (targetTypeFilter) {
        query = query.eq('target_type', targetTypeFilter);
      }
      
      if (locationFilter) {
        query = query.or(`location_city.ilike.%${locationFilter}%,location_state.ilike.%${locationFilter}%`);
      }
      
      if (searchQuery) {
        query = query.textSearch('search_vector', searchQuery);
      }
      
      // Get total count for pagination
      const { count, error: countError } = await query.count();
      
      if (countError) throw countError;
      
      totalCount = count || 0;
      totalPages = Math.ceil(totalCount / pageSize);
      
      // Apply pagination
      const start = (page - 1) * pageSize;
      const end = start + pageSize - 1;
      
      const { data, error: casesError } = await query
        .order('created_at', { ascending: false })
        .range(start, end);
      
      if (casesError) throw casesError;
      
      cases = data || [];
      loading = false;
    } catch (e) {
      console.error('Error loading cases:', e);
      error = 'Failed to load cases';
      loading = false;
    }
  }
  
  function handleFilterChange() {
    page = 1; // Reset to first page when filters change
    loadCases();
  }
  
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
  <title>Cases | TeslaJustice</title>
</svelte:head>

<div>
  <h1 class="text-3xl font-bold mb-6">Vandalism Cases</h1>
  
  <!-- Filters -->
  <div class="bg-white rounded-lg shadow p-4 mb-6">
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div>
        <label for="status-filter" class="block text-sm font-medium text-gray-700 mb-1">Status</label>
        <select
          id="status-filter"
          class="w-full rounded-md border-gray-300 shadow-sm focus:border-tesla-red focus:ring focus:ring-tesla-red focus:ring-opacity-50"
          bind:value={statusFilter}
          on:change={handleFilterChange}
        >
          {#each statusOptions as option}
            <option value={option.value}>{option.label}</option>
          {/each}
        </select>
      </div>
      
      <div>
        <label for="target-type-filter" class="block text-sm font-medium text-gray-700 mb-1">Target Type</label>
        <select
          id="target-type-filter"
          class="w-full rounded-md border-gray-300 shadow-sm focus:border-tesla-red focus:ring focus:ring-tesla-red focus:ring-opacity-50"
          bind:value={targetTypeFilter}
          on:change={handleFilterChange}
        >
          {#each targetTypeOptions as option}
            <option value={option.value}>{option.label}</option>
          {/each}
        </select>
      </div>
      
      <div>
        <label for="location-filter" class="block text-sm font-medium text-gray-700 mb-1">Location</label>
        <input
          id="location-filter"
          type="text"
          placeholder="City or state"
          class="w-full rounded-md border-gray-300 shadow-sm focus:border-tesla-red focus:ring focus:ring-tesla-red focus:ring-opacity-50"
          bind:value={locationFilter}
          on:input={() => {
            clearTimeout(window.locationFilterTimeout);
            window.locationFilterTimeout = setTimeout(handleFilterChange, 500);
          }}
        />
      </div>
      
      <div>
        <label for="search-query" class="block text-sm font-medium text-gray-700 mb-1">Search</label>
        <input
          id="search-query"
          type="text"
          placeholder="Search cases..."
          class="w-full rounded-md border-gray-300 shadow-sm focus:border-tesla-red focus:ring focus:ring-tesla-red focus:ring-opacity-50"
          bind:value={searchQuery}
          on:input={() => {
            clearTimeout(window.searchQueryTimeout);
            window.searchQueryTimeout = setTimeout(handleFilterChange, 500);
          }}
        />
      </div>
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
  {:else if cases.length === 0}
    <div class="bg-gray-100 p-6 rounded-lg text-center">
      <p class="text-gray-600">No cases found matching your filters.</p>
    </div>
  {:else}
    <!-- Cases grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
      {#each cases as case_}
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
            
            {#if case_.location_city || case_.location_state}
              <div class="mt-2 text-sm text-gray-500 flex items-center">
                <span class="mr-1">📍</span>
                {case_.location_city}{case_.location_city && case_.location_state ? ', ' : ''}{case_.location_state}
              </div>
            {/if}
          </div>
        </a>
      {/each}
    </div>
    
    <!-- Pagination -->
    {#if totalPages > 1}
      <div class="flex justify-center items-center space-x-2 mt-8">
        <button
          class="px-4 py-2 rounded-md bg-gray-200 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={page === 1}
          on:click={() => {
            page = 1;
            loadCases();
          }}
        >
          First
        </button>
        
        <button
          class="px-4 py-2 rounded-md bg-gray-200 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={page === 1}
          on:click={() => {
            page--;
            loadCases();
          }}
        >
          Previous
        </button>
        
        <span class="px-4 py-2">
          Page {page} of {totalPages}
        </span>
        
        <button
          class="px-4 py-2 rounded-md bg-gray-200 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={page === totalPages}
          on:click={() => {
            page++;
            loadCases();
          }}
        >
          Next
        </button>
        
        <button
          class="px-4 py-2 rounded-md bg-gray-200 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={page === totalPages}
          on:click={() => {
            page = totalPages;
            loadCases();
          }}
        >
          Last
        </button>
      </div>
    {/if}
  {/if}
</div>
