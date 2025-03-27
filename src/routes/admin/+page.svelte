<!-- src/routes/admin/+page.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabaseClient';
  import type { Case, CaseUpdate, MonitoringKeyword, MonitoringAccount } from '$lib/types';
  import { runFullMonitoringCycle } from '$lib/monitoringSystem';
  
  let user = null;
  let profile = null;
  let isAdmin = false;
  let loading = true;
  let error = '';
  
  // Dashboard data
  let recentCases: Case[] = [];
  let recentUpdates: CaseUpdate[] = [];
  let monitoringKeywords: MonitoringKeyword[] = [];
  let monitoringAccounts: MonitoringAccount[] = [];
  let caseStats = {
    total: 0,
    byStatus: {},
    byTargetType: {},
    byMonth: []
  };
  
  // Monitoring state
  let isRunningMonitoring = false;
  let monitoringResults = null;
  
  onMount(async () => {
    // Check if user is authenticated and has admin role
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
      isAdmin = profile?.role === 'admin' || profile?.role === 'moderator';
      
      if (isAdmin) {
        await loadAdminData();
      } else {
        error = 'You do not have permission to access this page.';
      }
    } else {
      error = 'You must be logged in to access this page.';
    }
    
    loading = false;
  });
  
  async function loadAdminData() {
    try {
      // Load recent cases
      const { data: cases, error: casesError } = await supabase
        .from('cases')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (casesError) throw casesError;
      recentCases = cases || [];
      
      // Load recent updates
      const { data: updates, error: updatesError } = await supabase
        .from('case_updates')
        .select('*, cases(*)')
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (updatesError) throw updatesError;
      recentUpdates = updates || [];
      
      // Load monitoring keywords
      const { data: keywords, error: keywordsError } = await supabase
        .from('monitoring_keywords')
        .select('*')
        .order('priority', { ascending: false });
      
      if (keywordsError) throw keywordsError;
      monitoringKeywords = keywords || [];
      
      // Load monitoring accounts
      const { data: accounts, error: accountsError } = await supabase
        .from('monitoring_accounts')
        .select('*')
        .order('priority', { ascending: false });
      
      if (accountsError) throw accountsError;
      monitoringAccounts = accounts || [];
      
      // Load case statistics
      await loadCaseStats();
    } catch (e) {
      console.error('Error loading admin data:', e);
      error = 'Failed to load admin dashboard data';
    }
  }
  
  async function loadCaseStats() {
    try {
      // Get total case count
      const { count, error: countError } = await supabase
        .from('cases')
        .select('*', { count: 'exact' });
      
      if (countError) throw countError;
      caseStats.total = count || 0;
      
      // Get case counts by status
      const { data: statusCounts, error: statusError } = await supabase
        .from('cases')
        .select('status, count(*)')
        .group('status');
      
      if (statusError) throw statusError;
      caseStats.byStatus = statusCounts?.reduce((acc, item) => {
        acc[item.status] = item.count;
        return acc;
      }, {}) || {};
      
      // Get case counts by target type
      const { data: targetCounts, error: targetError } = await supabase
        .from('cases')
        .select('target_type, count(*)')
        .group('target_type');
      
      if (targetError) throw targetError;
      caseStats.byTargetType = targetCounts?.reduce((acc, item) => {
        acc[item.target_type] = item.count;
        return acc;
      }, {}) || {};
      
      // Get case counts by month (last 6 months)
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      
      const { data: monthlyCounts, error: monthlyError } = await supabase
        .from('cases')
        .select('created_at')
        .gte('created_at', sixMonthsAgo.toISOString());
      
      if (monthlyError) throw monthlyError;
      
      // Group by month
      const monthCounts = {};
      monthlyCounts?.forEach(item => {
        const date = new Date(item.created_at);
        const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        if (!monthCounts[monthYear]) {
          monthCounts[monthYear] = 0;
        }
        
        monthCounts[monthYear]++;
      });
      
      // Convert to array and sort
      caseStats.byMonth = Object.entries(monthCounts)
        .map(([month, count]) => ({ month, count }))
        .sort((a, b) => a.month.localeCompare(b.month));
    } catch (e) {
      console.error('Error loading case stats:', e);
      error = 'Failed to load case statistics';
    }
  }
  
  async function runMonitoring() {
    if (isRunningMonitoring) return;
    
    isRunningMonitoring = true;
    monitoringResults = null;
    
    try {
      monitoringResults = await runFullMonitoringCycle();
    } catch (e) {
      console.error('Error running monitoring cycle:', e);
      error = 'Failed to run monitoring cycle';
    } finally {
      isRunningMonitoring = false;
    }
  }
  
  async function addMonitoringKeyword(event) {
    event.preventDefault();
    const form = event.target;
    const keyword = form.keyword.value.trim();
    const platform = form.platform.value;
    const priority = parseInt(form.priority.value);
    
    if (!keyword) return;
    
    try {
      const { error: insertError } = await supabase
        .from('monitoring_keywords')
        .insert({
          keyword,
          platform,
          priority,
          is_active: true
        });
      
      if (insertError) throw insertError;
      
      // Reload keywords
      const { data: keywords, error: keywordsError } = await supabase
        .from('monitoring_keywords')
        .select('*')
        .order('priority', { ascending: false });
      
      if (keywordsError) throw keywordsError;
      monitoringKeywords = keywords || [];
      
      // Reset form
      form.reset();
    } catch (e) {
      console.error('Error adding monitoring keyword:', e);
      error = 'Failed to add monitoring keyword';
    }
  }
  
  async function addMonitoringAccount(event) {
    event.preventDefault();
    const form = event.target;
    const username = form.username.value.trim();
    const platform = form.platform.value;
    const priority = parseInt(form.priority.value);
    
    if (!username) return;
    
    try {
      const { error: insertError } = await supabase
        .from('monitoring_accounts')
        .insert({
          username,
          platform,
          priority,
          is_active: true
        });
      
      if (insertError) throw insertError;
      
      // Reload accounts
      const { data: accounts, error: accountsError } = await supabase
        .from('monitoring_accounts')
        .select('*')
        .order('priority', { ascending: false });
      
      if (accountsError) throw accountsError;
      monitoringAccounts = accounts || [];
      
      // Reset form
      form.reset();
    } catch (e) {
      console.error('Error adding monitoring account:', e);
      error = 'Failed to add monitoring account';
    }
  }
  
  async function toggleKeywordStatus(id, currentStatus) {
    try {
      const { error: updateError } = await supabase
        .from('monitoring_keywords')
        .update({ is_active: !currentStatus })
        .eq('id', id);
      
      if (updateError) throw updateError;
      
      // Update local state
      monitoringKeywords = monitoringKeywords.map(keyword => 
        keyword.id === id ? { ...keyword, is_active: !currentStatus } : keyword
      );
    } catch (e) {
      console.error('Error toggling keyword status:', e);
      error = 'Failed to update keyword status';
    }
  }
  
  async function toggleAccountStatus(id, currentStatus) {
    try {
      const { error: updateError } = await supabase
        .from('monitoring_accounts')
        .update({ is_active: !currentStatus })
        .eq('id', id);
      
      if (updateError) throw updateError;
      
      // Update local state
      monitoringAccounts = monitoringAccounts.map(account => 
        account.id === id ? { ...account, is_active: !currentStatus } : account
      );
    } catch (e) {
      console.error('Error toggling account status:', e);
      error = 'Failed to update account status';
    }
  }
  
  function formatDate(dateString) {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric'
    }).format(date);
  }
  
  function formatMonth(monthStr) {
    const [year, month] = monthStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    return new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' }).format(date);
  }
  
  function getStatusColor(status) {
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
</script>

<svelte:head>
  <title>Admin Dashboard | TeslaJustice</title>
</svelte:head>

<div>
  <h1 class="text-3xl font-bold mb-6">Admin Dashboard</h1>
  
  {#if loading}
    <div class="flex justify-center items-center py-12">
      <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-tesla-red"></div>
    </div>
  {:else if error}
    <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-8">
      <p>{error}</p>
    </div>
  {:else if !isAdmin}
    <div class="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-8">
      <p>You do not have permission to access this page.</p>
    </div>
  {:else}
    <!-- Stats overview -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <div class="bg-white rounded-lg shadow p-6">
        <h2 class="text-lg font-semibold mb-2">Total Cases</h2>
        <p class="text-3xl font-bold text-tesla-red">{caseStats.total}</p>
      </div>
      
      <div class="bg-white rounded-lg shadow p-6">
        <h2 class="text-lg font-semibold mb-2">Identified Suspects</h2>
        <p class="text-3xl font-bold text-tesla-red">{caseStats.byStatus?.identified || 0}</p>
      </div>
      
      <div class="bg-white rounded-lg shadow p-6">
        <h2 class="text-lg font-semibold mb-2">Resolved Cases</h2>
        <p class="text-3xl font-bold text-tesla-red">{caseStats.byStatus?.resolved || 0}</p>
      </div>
      
      <div class="bg-white rounded-lg shadow p-6">
        <h2 class="text-lg font-semibold mb-2">Monitoring Keywords</h2>
        <p class="text-3xl font-bold text-tesla-red">{monitoringKeywords.length}</p>
      </div>
    </div>
    
    <!-- Case trend chart -->
    <div class="bg-white rounded-lg shadow p-6 mb-8">
      <h2 class="text-xl font-semibold mb-4">Case Trend (Last 6 Months)</h2>
      
      {#if caseStats.byMonth.length === 0}
        <p class="text-gray-600">No data available for the selected period.</p>
      {:else}
        <div class="h-64">
          <div class="flex h-full items-end">
            {#each caseStats.byMonth as item}
              <div class="flex-1 flex flex-col items-center">
                <div class="w-full px-1">
                  <div 
                    class="bg-tesla-red rounded-t" 
                    style="height: {Math.max(20, (item.count / Math.max(...caseStats.byMonth.map(m => m.count))) * 200)}px"
                  ></div>
                </div>
                <div class="text-xs mt-2 text-gray-600">{formatMonth(item.month)}</div>
                <div class="text-sm font-semibold">{item.count}</div>
              </div>
            {/each}
          </div>
        </div>
      {/if}
    </div>
    
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
      <!-- Recent cases -->
      <div class="bg-white rounded-lg shadow p-6">
        <h2 class="text-xl font-semibold mb-4">Recent Cases</h2>
        
        {#if recentCases.length === 0}
          <p class="text-gray-600">No recent cases found.</p>
        {:else}
          <div class="space-y-4">
            {#each recentCases as case_}
              <a href="/cases/{case_.id}" class="block p-4 border rounded-lg hover:bg-gray-50 transition">
                <div class="flex items-center mb-2">
                  <span class="px-2 py-1 text-xs rounded-full text-white {getStatusColor(case_.status)} mr-2">
                    {case_.status}
                  </span>
                  <span class="text-sm text-gray-600">{formatDate(case_.created_at)}</span>
                </div>
                <h3 class="font-semibold">{case_.headline}</h3>
              </a>
            {/each}
          </div>
          
          <div class="mt-4 text-right">
            <a href="/cases" class="text-tesla-red hover:underline">View all cases</a>
          </div>
        {/if}
      </div>
      
      <!-- Recent updates -->
      <div class="bg-white rounded-lg shadow p-6">
        <h2 class="text-xl font-semibold mb-4">Recent Updates</h2>
        
        {#if recentUpdates.length === 0}
          <p class="text-gray-600">No recent updates found.</p>
        {:else}
          <div class="space-y-4">
            {#each recentUpdates as update}
              <a href="/cases/{update.case_id}" class="block p-4 border rounded-lg hover:bg-gray-50 transition">
                <div class="flex items-center mb-2">
                  <span class="text-sm text-gray-600">{formatDate(update.created_at)}</span>
                </div>
                <h3 class="font-semibold">{update.title}</h3>
                <p class="text-sm text-gray-600 mt-1">{update.description.substring(0, 100)}...</p>
                {#if update.cases}
                  <p class="text-xs text-tesla-red mt-2">Case: {update.cases.headline}</p>
                {/if}
              </a>
            {/each}
          </div>
        {/if}
      </div>
    </div>
    
    <!-- Monitoring controls -->
    <div class="bg-white rounded-lg shadow p-6 mb-8">
      <h2 class="text-xl font-semibold mb-4">Monitoring Controls</h2>
      
      <div class="mb-6">
        <button 
          class="bg-tesla-red text-white px-6 py-3 rounded-md font-semibold hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          on:click={runMonitoring}
          disabled={isRunningMonitoring}
        >
          {#if isRunningMonitoring}
            <span class="inline-block animate-spin mr-2">⟳</span> Running Monitoring Cycle...
          {:else}
            Run Monitoring Cycle Now
          {/if}
        </button>
      </div>
      
      {#if monitoringResults}
        <div class="bg-gray-100 p-4 rounded-lg mb-6">
          <h3 class="font-semibold mb-2">Monitoring Results</h3>
          <div class="space-y-2">
            <p><strong>New Cases:</strong> {monitoringResults.totalNewCases}</p>
            <p><strong>Updated Cases:</strong> {monitoringResults.totalUpdatedCases}</p>
            <p><strong>Processing Time:</strong> {monitoringResults.processingTime.toFixed(2)} seconds</p>
          </div>
        </div>
      {/if}
      
      <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
        <!-- Monitoring keywords -->
        <div>
          <h3 class="text-lg font-semibold mb-3">Monitoring Keywords</h3>
          
          <form class="mb-4 p-4 bg-gray-100 rounded-lg" on:submit={addMonitoringKeyword}>
            <div class="grid grid-cols-1 gap-3">
              <div>
                <label for="keyword" class="block text-sm font-medium text-gray-700 mb-1">Keyword</label>
                <input 
                  type="text" 
                  id="keyword" 
                  name="keyword" 
                  placeholder="Enter keyword to monitor" 
                  class="w-full rounded-md border-gray-300 shadow-sm focus:border-tesla-red focus:ring focus:ring-tesla-red focus:ring-opacity-50"
                  required
                />
              </div>
              
              <div>
                <label for="platform" class="block text-sm font-medium text-gray-700 mb-1">Platform</label>
                <select 
                  id="platform" 
                  name="platform" 
                  class="w-full rounded-md border-gray-300 shadow-sm focus:border-tesla-red focus:ring focus:ring-tesla-red focus:ring-opacity-50"
                >
                  <option value="twitter">Twitter</option>
                  <option value="all">All Platforms</option>
                </select>
              </div>
              
              <div>
                <label for="priority" class="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                <select 
                  id="priority" 
                  name="priority" 
                  class="w-full rounded-md border-gray-300 shadow-sm focus:border-tesla-red focus:ring focus:ring-tesla-red focus:ring-opacity-50"
                >
                  <option value="1">Low</option>
                  <option value="2">Medium</option>
                  <option value="3" selected>High</option>
                </select>
              </div>
              
              <button 
                type="submit" 
                class="bg-tesla-red text-white px-4 py-2 rounded-md font-semibold hover:bg-red-700 transition"
              >
                Add Keyword
              </button>
            </div>
          </form>
          
          {#if monitoringKeywords.length === 0}
            <p class="text-gray-600">No monitoring keywords configured.</p>
          {:else}
            <div class="space-y-2 max-h-80 overflow-y-auto">
              {#each monitoringKeywords as keyword}
                <div class="flex items-center justify-between p-3 border rounded-lg {keyword.is_active ? 'bg-white' : 'bg-gray-100'}">
                  <div>
                    <div class="font-semibold">{keyword.keyword}</div>
                    <div class="text-sm text-gray-600">
                      {keyword.platform === 'all' ? 'All Platforms' : keyword.platform}
                      {' • '}
                      {keyword.priority === 3 ? 'High' : keyword.priority === 2 ? 'Medium' : 'Low'} Priority
                    </div>
                  </div>
                  <button 
                    class="px-3 py-1 rounded-md text-sm {keyword.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}"
                    on:click={() => toggleKeywordStatus(keyword.id, keyword.is_active)}
                  >
                    {keyword.is_active ? 'Active' : 'Inactive'}
                  </button>
                </div>
              {/each}
            </div>
          {/if}
        </div>
        
        <!-- Monitoring accounts -->
        <div>
          <h3 class="text-lg font-semibold mb-3">Monitoring Accounts</h3>
          
          <form class="mb-4 p-4 bg-gray-100 rounded-lg" on:submit={addMonitoringAccount}>
            <div class="grid grid-cols-1 gap-3">
              <div>
                <label for="username" class="block text-sm font-medium text-gray-700 mb-1">Username</label>
                <input 
                  type="text" 
                  id="username" 
                  name="username" 
                  placeholder="Enter username to monitor" 
                  class="w-full rounded-md border-gray-300 shadow-sm focus:border-tesla-red focus:ring focus:ring-tesla-red focus:ring-opacity-50"
                  required
                />
              </div>
              
              <div>
                <label for="account-platform" class="block text-sm font-medium text-gray-700 mb-1">Platform</label>
                <select 
                  id="account-platform" 
                  name="platform" 
                  class="w-full rounded-md border-gray-300 shadow-sm focus:border-tesla-red focus:ring focus:ring-tesla-red focus:ring-opacity-50"
                >
                  <option value="twitter">Twitter</option>
                </select>
              </div>
              
              <div>
                <label for="account-priority" class="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                <select 
                  id="account-priority" 
                  name="priority" 
                  class="w-full rounded-md border-gray-300 shadow-sm focus:border-tesla-red focus:ring focus:ring-tesla-red focus:ring-opacity-50"
                >
                  <option value="1">Low</option>
                  <option value="2">Medium</option>
                  <option value="3" selected>High</option>
                </select>
              </div>
              
              <button 
                type="submit" 
                class="bg-tesla-red text-white px-4 py-2 rounded-md font-semibold hover:bg-red-700 transition"
              >
                Add Account
              </button>
            </div>
          </form>
          
          {#if monitoringAccounts.length === 0}
            <p class="text-gray-600">No monitoring accounts configured.</p>
          {:else}
            <div class="space-y-2 max-h-80 overflow-y-auto">
              {#each monitoringAccounts as account}
                <div class="flex items-center justify-between p-3 border rounded-lg {account.is_active ? 'bg-white' : 'bg-gray-100'}">
                  <div>
                    <div class="font-semibold">@{account.username}</div>
                    <div class="text-sm text-gray-600">
                      {account.platform}
                      {' • '}
                      {account.priority === 3 ? 'High' : account.priority === 2 ? 'Medium' : 'Low'} Priority
                    </div>
                  </div>
                  <button 
                    class="px-3 py-1 rounded-md text-sm {account.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}"
                    on:click={() => toggleAccountStatus(account.id, account.is_active)}
                  >
                    {account.is_active ? 'Active' : 'Inactive'}
                  </button>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      </div>
    </div>
  {/if}
</div>
