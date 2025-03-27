<!-- src/routes/map/+page.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabaseClient';
  import type { Case } from '$lib/types';
  
  let cases: Case[] = [];
  let loading = true;
  let error = '';
  let map: any = null;
  let markers: any[] = [];
  
  // Filter state
  let statusFilter = '';
  let targetTypeFilter = '';
  
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
    // Load the Google Maps API
    if (!window.google || !window.google.maps) {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=YOUR_API_KEY&libraries=places`;
      script.async = true;
      script.defer = true;
      script.onload = initMap;
      document.head.appendChild(script);
    } else {
      initMap();
    }
    
    await loadCases();
  });
  
  function initMap() {
    // Initialize the map centered on the US
    map = new google.maps.Map(document.getElementById('map'), {
      center: { lat: 39.8283, lng: -98.5795 },
      zoom: 4,
      styles: [
        {
          featureType: 'all',
          elementType: 'labels.text.fill',
          stylers: [{ color: '#7c93a3' }, { lightness: -10 }]
        },
        {
          featureType: 'administrative.country',
          elementType: 'geometry',
          stylers: [{ visibility: 'on' }]
        },
        {
          featureType: 'administrative.country',
          elementType: 'geometry.stroke',
          stylers: [{ color: '#a0a4a5' }]
        },
        {
          featureType: 'administrative.province',
          elementType: 'geometry.stroke',
          stylers: [{ color: '#62838e' }]
        },
        {
          featureType: 'landscape',
          elementType: 'geometry.fill',
          stylers: [{ color: '#f5f5f5' }]
        },
        {
          featureType: 'landscape.man_made',
          elementType: 'geometry.fill',
          stylers: [{ color: '#f5f5f5' }]
        },
        {
          featureType: 'landscape.natural',
          elementType: 'geometry.fill',
          stylers: [{ color: '#f5f5f5' }]
        },
        {
          featureType: 'road',
          elementType: 'geometry.fill',
          stylers: [{ color: '#ffffff' }]
        },
        {
          featureType: 'road',
          elementType: 'geometry.stroke',
          stylers: [{ color: '#dfdfdf' }]
        },
        {
          featureType: 'water',
          elementType: 'geometry.fill',
          stylers: [{ color: '#cfe5f4' }]
        }
      ]
    });
    
    // Add markers if cases are already loaded
    if (cases.length > 0) {
      addMarkersToMap();
    }
  }
  
  async function loadCases() {
    loading = true;
    error = '';
    
    try {
      let query = supabase
        .from('cases')
        .select('*');
      
      // Apply filters
      if (statusFilter) {
        query = query.eq('status', statusFilter);
      }
      
      if (targetTypeFilter) {
        query = query.eq('target_type', targetTypeFilter);
      }
      
      const { data, error: casesError } = await query;
      
      if (casesError) throw casesError;
      
      cases = data || [];
      loading = false;
      
      // Add markers to map if it's initialized
      if (map) {
        addMarkersToMap();
      }
    } catch (e) {
      console.error('Error loading cases:', e);
      error = 'Failed to load cases';
      loading = false;
    }
  }
  
  function addMarkersToMap() {
    // Clear existing markers
    markers.forEach(marker => marker.setMap(null));
    markers = [];
    
    // Create a bounds object to fit all markers
    const bounds = new google.maps.LatLngBounds();
    let hasValidCoordinates = false;
    
    // Add markers for each case with location data
    cases.forEach(case_ => {
      // Skip cases without location data
      if (!case_.location_city && !case_.location_state) return;
      
      // Use geocoding to get coordinates if not available
      if (!case_.location_coordinates) {
        // In a real implementation, we would geocode the address
        // For now, we'll use a placeholder based on city/state
        const geocodeLocation = async () => {
          const geocoder = new google.maps.Geocoder();
          const address = `${case_.location_city || ''}, ${case_.location_state || ''}`;
          
          geocoder.geocode({ address }, (results, status) => {
            if (status === 'OK' && results && results[0]) {
              const position = results[0].geometry.location;
              
              // Create marker
              createMarker(case_, position);
              bounds.extend(position);
              hasValidCoordinates = true;
              
              // Fit map to bounds if this is the first valid coordinate
              if (markers.length === 1 && hasValidCoordinates) {
                map.fitBounds(bounds);
                
                // Zoom out a bit if we only have one marker
                if (markers.length === 1) {
                  const listener = google.maps.event.addListener(map, 'idle', () => {
                    if (map.getZoom() > 12) map.setZoom(12);
                    google.maps.event.removeListener(listener);
                  });
                }
              }
            }
          });
        };
        
        geocodeLocation();
      } else {
        // Use existing coordinates
        const position = new google.maps.LatLng(
          case_.location_coordinates[0],
          case_.location_coordinates[1]
        );
        
        // Create marker
        createMarker(case_, position);
        bounds.extend(position);
        hasValidCoordinates = true;
      }
    });
    
    // Fit map to bounds if we have valid coordinates
    if (hasValidCoordinates) {
      map.fitBounds(bounds);
    }
  }
  
  function createMarker(case_: Case, position: any) {
    // Determine marker color based on status
    let markerColor = '#FF0000'; // Default red
    
    switch (case_.status) {
      case 'reported': markerColor = '#EAB308'; break; // Yellow
      case 'verified': markerColor = '#3B82F6'; break; // Blue
      case 'identified': markerColor = '#8B5CF6'; break; // Purple
      case 'apprehended': markerColor = '#22C55E'; break; // Green
      case 'prosecuted': markerColor = '#6366F1'; break; // Indigo
      case 'resolved': markerColor = '#15803D'; break; // Dark green
      case 'unresolved': markerColor = '#6B7280'; break; // Gray
    }
    
    // Create marker
    const marker = new google.maps.Marker({
      position,
      map,
      title: case_.headline,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        fillColor: markerColor,
        fillOpacity: 0.9,
        strokeWeight: 1,
        strokeColor: '#FFFFFF',
        scale: 10
      }
    });
    
    // Create info window
    const infoWindow = new google.maps.InfoWindow({
      content: `
        <div style="max-width: 300px;">
          <h3 style="font-weight: bold; margin-bottom: 5px;">${case_.headline}</h3>
          <p style="font-size: 0.9em; color: #666; margin-bottom: 8px;">
            ${case_.location_city}${case_.location_city && case_.location_state ? ', ' : ''}${case_.location_state}
          </p>
          <p style="margin-bottom: 10px;">${case_.summary.substring(0, 150)}${case_.summary.length > 150 ? '...' : ''}</p>
          <a href="/cases/${case_.id}" style="color: #E32212; font-weight: bold; text-decoration: none;">
            View Details
          </a>
        </div>
      `
    });
    
    // Add click listener
    marker.addListener('click', () => {
      // Close all open info windows
      markers.forEach(m => m.infoWindow.close());
      
      // Open this info window
      infoWindow.open(map, marker);
    });
    
    // Store info window with marker for later reference
    marker.infoWindow = infoWindow;
    
    // Add to markers array
    markers.push(marker);
    
    return marker;
  }
  
  function handleFilterChange() {
    loadCases();
  }
</script>

<svelte:head>
  <title>Map | TeslaJustice</title>
</svelte:head>

<div>
  <h1 class="text-3xl font-bold mb-6">Vandalism Map</h1>
  
  <!-- Filters -->
  <div class="bg-white rounded-lg shadow p-4 mb-6">
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
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
    </div>
  </div>
  
  {#if loading && cases.length === 0}
    <div class="flex justify-center items-center py-12">
      <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-tesla-red"></div>
    </div>
  {:else if error}
    <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-8">
      <p>{error}</p>
    </div>
  {:else}
    <!-- Map container -->
    <div class="bg-white rounded-lg shadow overflow-hidden mb-8">
      <div id="map" class="w-full h-[600px]"></div>
    </div>
    
    <!-- Map legend -->
    <div class="bg-white rounded-lg shadow p-4 mb-8">
      <h2 class="text-lg font-semibold mb-3">Map Legend</h2>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div class="flex items-center">
          <div class="w-4 h-4 rounded-full bg-yellow-500 mr-2"></div>
          <span>Reported</span>
        </div>
        <div class="flex items-center">
          <div class="w-4 h-4 rounded-full bg-blue-500 mr-2"></div>
          <span>Verified</span>
        </div>
        <div class="flex items-center">
          <div class="w-4 h-4 rounded-full bg-purple-500 mr-2"></div>
          <span>Identified</span>
        </div>
        <div class="flex items-center">
          <div class="w-4 h-4 rounded-full bg-green-500 mr-2"></div>
          <span>Apprehended</span>
        </div>
        <div class="flex items-center">
          <div class="w-4 h-4 rounded-full bg-indigo-500 mr-2"></div>
          <span>Prosecuted</span>
        </div>
        <div class="flex items-center">
          <div class="w-4 h-4 rounded-full bg-green-700 mr-2"></div>
          <span>Resolved</span>
        </div>
        <div class="flex items-center">
          <div class="w-4 h-4 rounded-full bg-gray-500 mr-2"></div>
          <span>Unresolved</span>
        </div>
      </div>
    </div>
    
    <!-- Map instructions -->
    <div class="bg-gray-100 p-4 rounded-lg text-gray-700 text-sm">
      <p>Click on a marker to view case details. Use the filters above to narrow down the displayed cases.</p>
      <p class="mt-2">Note: Some cases may not appear on the map if location information is not available.</p>
    </div>
  {/if}
</div>
