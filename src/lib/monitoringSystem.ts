import { supabase } from '$lib/supabaseClient';
import { runTwitterMonitoringCycle } from '$lib/socialMediaIntegration';
import type { Case, CaseUpdate, MonitoringResult } from '$lib/types';
import { getCaseWithDetails, updateCase } from '$lib/caseManagement';

/**
 * Monitoring System for TeslaJustice
 * This module handles continuous monitoring for updates to existing cases
 */

/**
 * Runs a complete monitoring cycle across all platforms
 * @returns Results of the monitoring cycle
 */
export async function runFullMonitoringCycle(): Promise<{
  twitter: MonitoringResult[];
  totalNewCases: number;
  totalUpdatedCases: number;
  processingTime: number;
}> {
  const startTime = Date.now();
  
  // Run Twitter monitoring cycle
  const twitterResults = await runTwitterMonitoringCycle();
  
  // Calculate totals
  const totalNewCases = twitterResults.reduce((sum, result) => sum + result.newCases, 0);
  const totalUpdatedCases = twitterResults.reduce((sum, result) => sum + result.updatedCases, 0);
  
  const endTime = Date.now();
  const processingTime = (endTime - startTime) / 1000; // in seconds
  
  // Log the monitoring cycle
  await logMonitoringCycle({
    platforms: ['twitter'],
    totalNewCases,
    totalUpdatedCases,
    processingTime,
    timestamp: new Date().toISOString()
  });
  
  return {
    twitter: twitterResults,
    totalNewCases,
    totalUpdatedCases,
    processingTime
  };
}

/**
 * Logs a monitoring cycle to the database
 * @param cycleData Data about the monitoring cycle
 */
async function logMonitoringCycle(cycleData: any): Promise<void> {
  try {
    await supabase
      .from('analytics_events')
      .insert({
        event_type: 'monitoring_cycle',
        event_data: cycleData,
        occurred_at: new Date().toISOString()
      });
  } catch (error) {
    console.error('Error logging monitoring cycle:', error);
  }
}

/**
 * Checks for updates to a specific case
 * @param caseId The case ID to check for updates
 * @returns Results of the update check
 */
export async function checkCaseForUpdates(caseId: string): Promise<{
  caseId: string;
  updatesFound: boolean;
  newUpdates: number;
}> {
  try {
    // Get the case with all its details
    const caseDetails = await getCaseWithDetails(caseId);
    
    // Get all social media sources linked to this case
    const { data: sources, error } = await supabase
      .from('social_media_sources')
      .select('*')
      .in('id', caseDetails.updates.map(update => update.source_id).filter(Boolean));
    
    if (error) throw error;
    
    let newUpdates = 0;
    
    // For each Twitter source, check for replies
    for (const source of sources || []) {
      if (source.platform === 'twitter') {
        // In a production environment, this would call the Twitter API to get replies
        // For now, we'll simulate finding updates
        const updatesFound = await simulateCheckingForReplies(source.platform_id);
        
        if (updatesFound > 0) {
          // Create case updates for each new reply found
          await createUpdateFromReplies(caseId, source.id, updatesFound);
          newUpdates += updatesFound;
        }
      }
    }
    
    return {
      caseId,
      updatesFound: newUpdates > 0,
      newUpdates
    };
  } catch (error) {
    console.error('Error checking case for updates:', error);
    throw error;
  }
}

/**
 * Simulates checking for replies to a tweet
 * @param tweetId The tweet ID to check for replies
 * @returns Number of new replies found
 */
async function simulateCheckingForReplies(tweetId: string): Promise<number> {
  // In a production environment, this would call the Twitter API
  // For now, we'll return a random number of replies
  return Math.floor(Math.random() * 3); // 0-2 replies
}

/**
 * Creates case updates from replies to a social media post
 * @param caseId The case ID
 * @param sourceId The source ID
 * @param replyCount Number of replies to simulate
 */
async function createUpdateFromReplies(caseId: string, sourceId: string, replyCount: number): Promise<void> {
  try {
    for (let i = 0; i < replyCount; i++) {
      // Create a case update
      await supabase
        .from('case_updates')
        .insert({
          case_id: caseId,
          source_id: sourceId,
          update_type: 'new_information',
          title: 'New reply to social media post',
          description: `A new reply was found to a social media post related to this case. The reply may contain additional information about the incident.`,
          is_public: true,
          importance: 2
        });
    }
  } catch (error) {
    console.error('Error creating update from replies:', error);
    throw error;
  }
}

/**
 * Checks all active cases for updates
 * @returns Results of the update checks
 */
export async function checkAllCasesForUpdates(): Promise<{
  casesChecked: number;
  casesWithUpdates: number;
  totalNewUpdates: number;
  processingTime: number;
}> {
  const startTime = Date.now();
  
  try {
    // Get all active cases (not resolved or unresolved)
    const { data: cases, error } = await supabase
      .from('cases')
      .select('id')
      .not('status', 'in', ['resolved', 'unresolved'])
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    let casesWithUpdates = 0;
    let totalNewUpdates = 0;
    
    // Check each case for updates
    for (const case_ of cases || []) {
      const result = await checkCaseForUpdates(case_.id);
      
      if (result.updatesFound) {
        casesWithUpdates++;
        totalNewUpdates += result.newUpdates;
      }
    }
    
    const endTime = Date.now();
    const processingTime = (endTime - startTime) / 1000; // in seconds
    
    // Log the update check
    await logMonitoringCycle({
      event_type: 'case_update_check',
      casesChecked: cases?.length || 0,
      casesWithUpdates,
      totalNewUpdates,
      processingTime,
      timestamp: new Date().toISOString()
    });
    
    return {
      casesChecked: cases?.length || 0,
      casesWithUpdates,
      totalNewUpdates,
      processingTime
    };
  } catch (error) {
    console.error('Error checking all cases for updates:', error);
    throw error;
  }
}

/**
 * Sets up scheduled monitoring
 * @param intervalMinutes Minutes between monitoring cycles
 * @returns Interval ID
 */
export function setupScheduledMonitoring(intervalMinutes: number = 60): NodeJS.Timeout {
  console.log(`Setting up scheduled monitoring every ${intervalMinutes} minutes`);
  
  // Run an initial cycle immediately
  runFullMonitoringCycle().catch(console.error);
  
  // Set up recurring monitoring
  const intervalId = setInterval(() => {
    console.log('Running scheduled monitoring cycle');
    runFullMonitoringCycle().catch(console.error);
    
    // Also check for updates to existing cases
    checkAllCasesForUpdates().catch(console.error);
  }, intervalMinutes * 60 * 1000);
  
  return intervalId;
}

/**
 * Stops scheduled monitoring
 * @param intervalId The interval ID to clear
 */
export function stopScheduledMonitoring(intervalId: NodeJS.Timeout): void {
  clearInterval(intervalId);
  console.log('Scheduled monitoring stopped');
}

/**
 * Updates case status based on monitoring results
 * @param caseId The case ID
 * @param newStatus The new status
 * @param reason The reason for the status change
 */
export async function updateCaseStatus(caseId: string, newStatus: string, reason: string): Promise<void> {
  try {
    // Get the current case
    const { data: currentCase, error } = await supabase
      .from('cases')
      .select('status')
      .eq('id', caseId)
      .single();
    
    if (error) throw error;
    
    // Update the case status
    await updateCase(caseId, {
      status: newStatus as any,
    });
    
    // Create a case update
    await supabase
      .from('case_updates')
      .insert({
        case_id: caseId,
        update_type: 'status_change',
        title: `Status changed to ${newStatus}`,
        description: reason,
        previous_status: currentCase.status,
        new_status: newStatus,
        is_public: true,
        importance: 4
      });
  } catch (error) {
    console.error('Error updating case status:', error);
    throw error;
  }
}
