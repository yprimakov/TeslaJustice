import { runFullMonitoringCycle } from '$lib/monitoringSystem';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
  try {
    const results = await runFullMonitoringCycle();
    
    return json({
      success: true,
      message: 'Monitoring cycle completed successfully',
      results: {
        newCases: results.totalNewCases,
        updatedCases: results.totalUpdatedCases,
        processingTime: results.processingTime,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error running monitoring cycle:', error);
    
    return json({
      success: false,
      message: 'Failed to run monitoring cycle',
      error: error.message || 'Unknown error'
    }, { status: 500 });
  }
};
