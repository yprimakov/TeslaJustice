<!-- src/routes/cases/[id]/+page.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { supabase } from '$lib/supabaseClient';
  import type { Case, CaseMedia, CaseUpdate, RelatedCase } from '$lib/types';
  
  const caseId = $page.params.id;
  
  let caseDetails: Case & {
    media: CaseMedia[];
    updates: CaseUpdate[];
    relatedCases: RelatedCase[];
  } | null = null;
  let loading = true;
  let error = '';
  
  onMount(async () => {
    await loadCaseDetails();
  });
  
  async function loadCaseDetails() {
    loading = true;
    error = '';
    
    try {
      // Get the case
      const { data: case_, error: caseError } = await supabase
        .from('cases')
        .select('*')
        .eq('id', caseId)
        .single();
      
      if (caseError) throw caseError;
      
      // Get case media
      const { data: media, error: mediaError } = await supabase
        .from('case_media')
        .select('*')
        .eq('case_id', caseId)
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: false });
      
      if (mediaError) throw mediaError;
      
      // Get case updates
      const { data: updates, error: updatesError } = await supabase
        .from('case_updates')
        .select('*, social_media_sources(*)')
        .eq('case_id', caseId)
        .eq('is_public', true)
        .order('created_at', { ascending: false });
      
      if (updatesError) throw updatesError;
      
      // Get related cases
      const { data: relatedCases, error: relatedError } = await supabase
        .from('related_cases')
        .select('*, related_case:related_case_id(*)')
        .eq('case_id', caseId)
        .order('relationship_strength', { ascending: false });
      
      if (relatedError) throw relatedError;
      
      caseDetails = {
        ...case_,
        media: media || [],
        updates: updates || [],
        relatedCases: relatedCases || []
      };
      
      loading = false;
    } catch (e) {
      console.error('Error loading case details:', e);
      error = 'Failed to load case details';
      loading = false;
    }
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
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric'
    }).format(date);
  }
  
  function getUpdateTypeIcon(type: string): string {
    switch (type) {
      case 'status_change': return '🔄';
      case 'new_information': return '📝';
      case 'suspect_identified': return '👤';
      case 'media_added': return '📷';
      case 'location_update': return '📍';
      default: return 'ℹ️';
    }
  }
</script>

<svelte:head>
  <title>{caseDetails ? caseDetails.headline : 'Loading Case'} | TeslaJustice</title>
</svelte:head>

<div>
  <div class="mb-4">
    <a href="/cases" class="text-tesla-red hover:underline flex items-center">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M9.707 14.707a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 1.414L7.414 9H15a1 1 0 110 2H7.414l2.293 2.293a1 1 0 010 1.414z" clip-rule="evenodd" />
      </svg>
      Back to Cases
    </a>
  </div>
  
  {#if loading}
    <div class="flex justify-center items-center py-12">
      <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-tesla-red"></div>
    </div>
  {:else if error}
    <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-8">
      <p>{error}</p>
    </div>
  {:else if caseDetails}
    <div class="bg-white rounded-lg shadow-lg overflow-hidden mb-8">
      <!-- Case header -->
      <div class="p-6 border-b">
        <div class="flex items-center mb-4">
          <span class="px-3 py-1 text-sm rounded-full text-white {getStatusColor(caseDetails.status)} mr-3">
            {caseDetails.status}
          </span>
          <span class="text-gray-600">{formatDate(caseDetails.created_at)}</span>
        </div>
        <h1 class="text-2xl md:text-3xl font-bold mb-2">{caseDetails.headline}</h1>
        
        <div class="flex flex-wrap items-center text-gray-600 mb-4">
          <div class="flex items-center mr-4 mb-2">
            <span class="mr-1">{getTargetTypeIcon(caseDetails.target_type)}</span>
            <span class="capitalize">{caseDetails.target_type}</span>
          </div>
          
          {#if caseDetails.location_city || caseDetails.location_state}
            <div class="flex items-center mr-4 mb-2">
              <span class="mr-1">📍</span>
              <span>
                {caseDetails.location_city}{caseDetails.location_city && caseDetails.location_state ? ', ' : ''}{caseDetails.location_state}
              </span>
            </div>
          {/if}
          
          {#if caseDetails.damage_type && caseDetails.damage_type.length > 0}
            <div class="flex items-center mb-2">
              <span class="mr-1">🛠️</span>
              <span>{caseDetails.damage_type.join(', ')}</span>
            </div>
          {/if}
        </div>
        
        <p class="text-gray-800">{caseDetails.summary}</p>
      </div>
      
      <!-- Media gallery -->
      {#if caseDetails.media && caseDetails.media.length > 0}
        <div class="p-6 border-b">
          <h2 class="text-xl font-semibold mb-4">Evidence</h2>
          
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {#each caseDetails.media as media}
              <div class="bg-gray-100 rounded-lg overflow-hidden">
                {#if media.media_type === 'video'}
                  <div class="aspect-w-16 aspect-h-9">
                    <video controls class="w-full h-full object-cover">
                      <source src={media.url} type="video/mp4">
                      Your browser does not support the video tag.
                    </video>
                  </div>
                {:else}
                  <div class="aspect-w-16 aspect-h-9">
                    <img src={media.url} alt="Case evidence" class="w-full h-full object-cover" />
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        </div>
      {/if}
      
      <!-- Target details -->
      <div class="p-6 border-b">
        <h2 class="text-xl font-semibold mb-4">Target Details</h2>
        
        {#if caseDetails.target_type === 'vehicle'}
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <h3 class="text-sm text-gray-500">Make</h3>
              <p>{caseDetails.target_details.make || 'Unknown'}</p>
            </div>
            <div>
              <h3 class="text-sm text-gray-500">Model</h3>
              <p>{caseDetails.target_details.model || 'Unknown'}</p>
            </div>
            <div>
              <h3 class="text-sm text-gray-500">Color</h3>
              <p>{caseDetails.target_details.color || 'Unknown'}</p>
            </div>
            <div>
              <h3 class="text-sm text-gray-500">Year</h3>
              <p>{caseDetails.target_details.year || 'Unknown'}</p>
            </div>
          </div>
        {:else if caseDetails.target_type === 'building'}
          <div>
            <h3 class="text-sm text-gray-500">Building Type</h3>
            <p class="capitalize">{caseDetails.target_details.building_type || 'Unknown'}</p>
          </div>
        {:else if caseDetails.target_type === 'property'}
          <div>
            <h3 class="text-sm text-gray-500">Property Type</h3>
            <p class="capitalize">{caseDetails.target_details.property_type || 'Unknown'}</p>
          </div>
        {/if}
      </div>
      
      <!-- Case updates -->
      <div class="p-6">
        <h2 class="text-xl font-semibold mb-4">Updates</h2>
        
        {#if caseDetails.updates.length === 0}
          <p class="text-gray-600">No updates available for this case yet.</p>
        {:else}
          <div class="space-y-6">
            {#each caseDetails.updates as update}
              <div class="border-l-4 border-tesla-red pl-4">
                <div class="flex items-center mb-2">
                  <span class="mr-2">{getUpdateTypeIcon(update.update_type)}</span>
                  <h3 class="font-semibold">{update.title}</h3>
                  <span class="ml-auto text-sm text-gray-500">{formatDate(update.created_at)}</span>
                </div>
                <p class="text-gray-700 mb-2">{update.description}</p>
                
                {#if update.social_media_sources}
                  <div class="mt-2 text-sm">
                    <a href={update.social_media_sources.url} target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline flex items-center">
                      <span class="mr-1">
                        {#if update.social_media_sources.platform === 'twitter'}
                          🐦
                        {:else if update.social_media_sources.platform === 'instagram'}
                          📸
                        {:else if update.social_media_sources.platform === 'facebook'}
                          👍
                        {:else}
                          🔗
                        {/if}
                      </span>
                      View on {update.social_media_sources.platform}
                    </a>
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
    
    <!-- Related cases -->
    {#if caseDetails.relatedCases && caseDetails.relatedCases.length > 0}
      <div class="bg-white rounded-lg shadow-lg p-6 mb-8">
        <h2 class="text-xl font-semibold mb-4">Related Cases</h2>
        
        <div class="space-y-4">
          {#each caseDetails.relatedCases as relatedCase}
            {#if relatedCase.related_case}
              <a href="/cases/{relatedCase.related_case_id}" class="block p-4 border rounded-lg hover:bg-gray-50 transition">
                <div class="flex items-center mb-2">
                  <span class="px-2 py-1 text-xs rounded-full text-white {getStatusColor(relatedCase.related_case.status)} mr-2">
                    {relatedCase.related_case.status}
                  </span>
                  <span class="text-sm text-gray-600">{formatDate(relatedCase.related_case.created_at)}</span>
                  
                  <span class="ml-auto text-sm text-gray-500 capitalize">
                    {relatedCase.relationship_type.replace('_', ' ')}
                    {#if relatedCase.relationship_strength}
                      ({Math.round(relatedCase.relationship_strength * 100)}% match)
                    {/if}
                  </span>
                </div>
                <h3 class="font-semibold">{relatedCase.related_case.headline}</h3>
              </a>
            {/if}
          {/each}
        </div>
      </div>
    {/if}
  {/if}
</div>
