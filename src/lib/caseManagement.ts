import { supabase } from '$lib/supabaseClient';
import type { Case, CaseUpdate, SocialMediaSource, CaseMedia } from '$lib/types';
import { analyzeTextContent, analyzeMediaContent, detectDuplicateIncidents } from '$lib/aiAnalysis';

/**
 * Case Management System for TeslaJustice
 * This module handles the creation, updating, and linking of vandalism cases
 */

/**
 * Creates a new case from a social media post
 * @param source The social media source data
 * @param analysis The AI analysis results
 * @returns The created case ID
 */
export async function createCaseFromSocialMedia(source: SocialMediaSource, analysis: any) {
  try {
    // Determine target type (default to vehicle)
    const targetType = determineTargetType(source.content, analysis);
    
    // Create target details object based on type
    const targetDetails = createTargetDetails(targetType, analysis);
    
    // Generate headline and summary
    const headline = generateHeadline(source.content, analysis, targetType);
    const summary = analysis.summary || generateSummary(source.content, analysis, targetType);
    
    // Extract location information
    const locationInfo = analysis.locationInfo || {};
    
    // Determine damage type
    const damageType = determineDamageType(source.content, analysis);
    
    // Check for potential duplicates before creating a new case
    const potentialDuplicates = await findPotentialDuplicates(locationInfo, targetDetails, damageType);
    
    // If we found a very likely duplicate, update that case instead of creating a new one
    if (potentialDuplicates.length > 0 && potentialDuplicates[0].similarityScore > 0.85) {
      const duplicateCase = potentialDuplicates[0].case;
      
      // Add this source to the existing case
      await linkSourceToCase(source, duplicateCase.id);
      
      // Add any media from this source
      if (analysis.mediaUrls && analysis.mediaUrls.length > 0) {
        await addMediaToCase(duplicateCase.id, source.id, analysis.mediaUrls);
      }
      
      // Create an update for the case
      await createCaseUpdate({
        case_id: duplicateCase.id,
        source_id: source.id,
        update_type: 'new_information',
        title: 'Additional report of the same incident',
        description: `A new social media post about this incident was found on ${source.platform}.`,
        is_public: true,
        importance: 2
      });
      
      return {
        caseId: duplicateCase.id,
        isNewCase: false,
        isDuplicate: true
      };
    }
    
    // Create a new case
    const { data: newCase, error } = await supabase
      .from('cases')
      .insert({
        headline,
        summary,
        target_type: targetType,
        target_details: targetDetails,
        location_city: locationInfo.city || null,
        location_state: locationInfo.state || null,
        location_country: locationInfo.country || 'US',
        status: 'reported',
        damage_type: damageType,
        ai_confidence: analysis.relevanceScore || 0.7,
        is_verified: false
      })
      .select()
      .single();
    
    if (error) throw error;
    
    // Link the source to the case
    await linkSourceToCase(source, newCase.id);
    
    // Add any media from the source
    if (analysis.mediaUrls && analysis.mediaUrls.length > 0) {
      await addMediaToCase(newCase.id, source.id, analysis.mediaUrls);
    }
    
    // If we found potential duplicates but not certain enough, link them as related
    if (potentialDuplicates.length > 0) {
      for (const duplicate of potentialDuplicates) {
        if (duplicate.similarityScore > 0.6) {
          await linkRelatedCases(newCase.id, duplicate.case.id, 'possible_duplicate', duplicate.similarityScore);
        }
      }
    }
    
    return {
      caseId: newCase.id,
      isNewCase: true,
      isDuplicate: false
    };
  } catch (error) {
    console.error('Error creating case from social media:', error);
    throw error;
  }
}

/**
 * Links a social media source to a case
 * @param source The social media source
 * @param caseId The case ID
 */
async function linkSourceToCase(source: SocialMediaSource, caseId: string) {
  try {
    // First, store the source in the database if it doesn't exist
    const { data: existingSource, error: fetchError } = await supabase
      .from('social_media_sources')
      .select('id')
      .eq('platform', source.platform)
      .eq('platform_id', source.platform_id)
      .single();
    
    let sourceId = existingSource?.id;
    
    if (!sourceId) {
      // Source doesn't exist, create it
      const { data: newSource, error: insertError } = await supabase
        .from('social_media_sources')
        .insert({
          platform: source.platform,
          platform_id: source.platform_id,
          url: source.url,
          author_username: source.author_username,
          author_display_name: source.author_display_name || '',
          author_avatar_url: source.author_avatar_url || '',
          content: source.content,
          posted_at: source.posted_at,
          is_reply: source.is_reply || false,
          reply_to_id: source.reply_to_id || null,
          metadata: source.metadata || {}
        })
        .select()
        .single();
      
      if (insertError) throw insertError;
      sourceId = newSource.id;
    }
    
    // Now create a case update to link the source to the case
    await createCaseUpdate({
      case_id: caseId,
      source_id: sourceId,
      update_type: 'new_information',
      title: `New information from ${source.platform}`,
      description: `A post on ${source.platform} by @${source.author_username} has been linked to this case.`,
      is_public: true,
      importance: 3
    });
    
    return sourceId;
  } catch (error) {
    console.error('Error linking source to case:', error);
    throw error;
  }
}

/**
 * Adds media to a case
 * @param caseId The case ID
 * @param sourceId The source ID
 * @param mediaUrls Array of media URLs
 */
async function addMediaToCase(caseId: string, sourceId: string, mediaUrls: any[]) {
  try {
    for (const [index, media] of mediaUrls.entries()) {
      // Analyze the media content
      const mediaAnalysis = await analyzeMediaContent(media.url, media.type);
      
      // Add the media to the case
      await supabase
        .from('case_media')
        .insert({
          case_id: caseId,
          source_id: sourceId,
          media_type: media.type === 'video' ? 'video' : 'image',
          url: media.url,
          thumbnail_url: media.type === 'video' ? media.url.replace(/\.mp4$/, '.jpg') : media.url,
          width: media.width || 0,
          height: media.height || 0,
          duration: media.duration || 0,
          is_primary: index === 0, // First media is primary
          ai_analysis: mediaAnalysis
        });
    }
  } catch (error) {
    console.error('Error adding media to case:', error);
    throw error;
  }
}

/**
 * Creates a case update
 * @param update The update data
 */
async function createCaseUpdate(update: Partial<CaseUpdate>) {
  try {
    const { error } = await supabase
      .from('case_updates')
      .insert(update);
    
    if (error) throw error;
  } catch (error) {
    console.error('Error creating case update:', error);
    throw error;
  }
}

/**
 * Links two cases as related
 * @param caseId First case ID
 * @param relatedCaseId Second case ID
 * @param relationshipType Type of relationship
 * @param relationshipStrength Strength of relationship (0-1)
 */
async function linkRelatedCases(caseId: string, relatedCaseId: string, relationshipType: string, relationshipStrength: number) {
  try {
    // Create the relationship in both directions
    await supabase
      .from('related_cases')
      .insert([
        {
          case_id: caseId,
          related_case_id: relatedCaseId,
          relationship_type: relationshipType,
          relationship_strength: relationshipStrength,
          is_ai_generated: true
        },
        {
          case_id: relatedCaseId,
          related_case_id: caseId,
          relationship_type: relationshipType,
          relationship_strength: relationshipStrength,
          is_ai_generated: true
        }
      ]);
  } catch (error) {
    console.error('Error linking related cases:', error);
    throw error;
  }
}

/**
 * Finds potential duplicate cases
 * @param locationInfo Location information
 * @param targetDetails Target details
 * @param damageType Damage type
 * @returns Array of potential duplicates with similarity scores
 */
async function findPotentialDuplicates(locationInfo: any, targetDetails: any, damageType: string[]) {
  try {
    // Find cases with similar location and target
    const { data: cases, error } = await supabase
      .from('cases')
      .select('*')
      .eq('location_city', locationInfo.city)
      .eq('target_type', targetDetails.type)
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (error) throw error;
    
    // No potential duplicates found
    if (!cases || cases.length === 0) {
      return [];
    }
    
    // Calculate similarity scores
    const potentialDuplicates = cases.map(case_ => {
      let similarityScore = 0;
      
      // Location match
      if (case_.location_city === locationInfo.city) {
        similarityScore += 0.3;
        
        if (case_.location_state === locationInfo.state) {
          similarityScore += 0.1;
        }
      }
      
      // Target details match
      if (case_.target_type === targetDetails.type) {
        similarityScore += 0.2;
        
        // For vehicles, check make/model
        if (case_.target_type === 'vehicle' && 
            case_.target_details.make === targetDetails.make &&
            case_.target_details.model === targetDetails.model) {
          similarityScore += 0.2;
        }
      }
      
      // Damage type match
      const caseDamageTypes = case_.damage_type || [];
      const matchingDamageTypes = damageType.filter(type => caseDamageTypes.includes(type));
      
      if (matchingDamageTypes.length > 0) {
        similarityScore += 0.2 * (matchingDamageTypes.length / damageType.length);
      }
      
      // Time proximity (cases within last 48 hours get higher score)
      const caseDate = new Date(case_.created_at);
      const now = new Date();
      const hoursDiff = (now.getTime() - caseDate.getTime()) / (1000 * 60 * 60);
      
      if (hoursDiff < 48) {
        similarityScore += 0.2 * (1 - (hoursDiff / 48));
      }
      
      return {
        case: case_,
        similarityScore
      };
    });
    
    // Sort by similarity score (highest first)
    return potentialDuplicates.sort((a, b) => b.similarityScore - a.similarityScore);
  } catch (error) {
    console.error('Error finding potential duplicates:', error);
    return [];
  }
}

/**
 * Determines the target type from content and analysis
 * @param content The content text
 * @param analysis The analysis results
 * @returns The target type (vehicle, building, property)
 */
function determineTargetType(content: string, analysis: any) {
  const textLower = content.toLowerCase();
  
  // Check for building references
  if (textLower.includes('building') || 
      textLower.includes('store') || 
      textLower.includes('dealership') || 
      textLower.includes('showroom') || 
      textLower.includes('supercharger')) {
    return 'building';
  }
  
  // Check for property references
  if (textLower.includes('property') || 
      textLower.includes('sign') || 
      textLower.includes('billboard')) {
    return 'property';
  }
  
  // Default to vehicle
  return 'vehicle';
}

/**
 * Creates target details object based on target type
 * @param targetType The target type
 * @param analysis The analysis results
 * @returns Target details object
 */
function createTargetDetails(targetType: string, analysis: any) {
  if (targetType === 'vehicle') {
    return {
      type: 'vehicle',
      make: 'Tesla',
      model: analysis.vehicleInfo?.model || '',
      color: analysis.vehicleInfo?.color || '',
      year: analysis.vehicleInfo?.year || ''
    };
  } else if (targetType === 'building') {
    return {
      type: 'building',
      building_type: determineBuildingType(analysis.text || '')
    };
  } else {
    return {
      type: 'property',
      property_type: determinePropertyType(analysis.text || '')
    };
  }
}

/**
 * Determines building type from text
 * @param text The content text
 * @returns Building type
 */
function determineBuildingType(text: string) {
  const textLower = text.toLowerCase();
  
  if (textLower.includes('dealership') || textLower.includes('showroom')) {
    return 'dealership';
  } else if (textLower.includes('supercharger') || textLower.includes('charging')) {
    return 'supercharger';
  } else if (textLower.includes('store')) {
    return 'store';
  } else if (textLower.includes('factory') || textLower.includes('gigafactory')) {
    return 'factory';
  } else {
    return 'other';
  }
}

/**
 * Determines property type from text
 * @param text The content text
 * @returns Property type
 */
function determinePropertyType(text: string) {
  const textLower = text.toLowerCase();
  
  if (textLower.includes('sign') || textLower.includes('billboard')) {
    return 'sign';
  } else if (textLower.includes('equipment')) {
    return 'equipment';
  } else {
    return 'other';
  }
}

/**
 * Determines damage type from content and analysis
 * @param content The content text
 * @param analysis The analysis results
 * @returns Array of damage types
 */
function determineDamageType(content: string, analysis: any) {
  const textLower = content.toLowerCase();
  const damageTypes = [];
  
  if (textLower.includes('key') || textLower.includes('scratch')) {
    damageTypes.push('keying');
  }
  
  if (textLower.includes('window') && 
      (textLower.includes('break') || textLower.includes('broke') || textLower.includes('broken') || textLower.includes('smash'))) {
    damageTypes.push('broken_windows');
  }
  
  if (textLower.includes('graffiti') || textLower.includes('spray') || textLower.includes('paint')) {
    damageTypes.push('graffiti');
  }
  
  if (textLower.includes('tire') || textLower.includes('tyre') || textLower.includes('slash')) {
    damageTypes.push('tire_slashing');
  }
  
  if (textLower.includes('fire') || textLower.includes('burn') || textLower.includes('arson')) {
    damageTypes.push('arson');
  }
  
  if (textLower.includes('dent') || textLower.includes('hit') || textLower.includes('smash')) {
    damageTypes.push('denting');
  }
  
  // If no specific damage type was identified, use a generic one
  if (damageTypes.length === 0) {
    damageTypes.push('other_damage');
  }
  
  return damageTypes;
}

/**
 * Generates a headline for a case
 * @param content The content text
 * @param analysis The analysis results
 * @param targetType The target type
 * @returns Generated headline
 */
function generateHeadline(content: string, analysis: any, targetType: string) {
  // In a production environment, this would use a language model
  // For now, we'll create a template-based headline
  
  let headline = '';
  
  // Target information
  if (targetType === 'vehicle') {
    headline = 'Tesla';
    
    if (analysis.vehicleInfo?.model) {
      headline += ` ${analysis.vehicleInfo.model}`;
    }
    
    headline += ' vandalized';
  } else if (targetType === 'building') {
    const buildingType = determineBuildingType(content);
    headline = `Tesla ${buildingType} vandalized`;
  } else {
    const propertyType = determinePropertyType(content);
    headline = `Tesla ${propertyType} vandalized`;
  }
  
  // Location information
  if (analysis.locationInfo?.city && analysis.locationInfo?.state) {
    headline += ` in ${analysis.locationInfo.city}, ${analysis.locationInfo.state}`;
  }
  
  // Damage information
  const damageType = determineDamageType(content, analysis);
  
  if (damageType.includes('keying')) {
    headline += ': Keyed by vandal';
  } else if (damageType.includes('broken_windows')) {
    headline += ': Windows smashed';
  } else if (damageType.includes('graffiti')) {
    headline += ': Tagged with graffiti';
  } else if (damageType.includes('tire_slashing')) {
    headline += ': Tires slashed';
  } else if (damageType.includes('arson')) {
    headline += ': Set on fire';
  } else if (damageType.includes('denting')) {
    headline += ': Body damaged';
  }
  
  return headline;
}

/**
 * Generates a summary for a case
 * @param content The content text
 * @param analysis The analysis results
 * @param targetType The target type
 * @returns Generated summary
 */
function generateSummary(content: string, analysis: any, targetType: string) {
  // In a production environment, this would use a language model
  // For now, we'll create a template-based summary
  
  let summary = '';
  
  // Target information
  if (targetType === 'vehicle') {
    summary = 'A Tesla';
    
    if (analysis.vehicleInfo?.model) {
      summary += ` ${analysis.vehicleInfo.model}`;
    }
    
    if (analysis.vehicleInfo?.color) {
      summary = `A ${analysis.vehicleInfo.color} ${summary.substring(2)}`;
    }
    
    summary += ' was vandalized';
  } else if (targetType === 'building') {
    const buildingType = determineBuildingType(content);
    summary = `A Tesla ${buildingType} was vandalized`;
  } else {
    const propertyType = determinePropertyType(content);
    summary = `Tesla ${propertyType} was vandalized`;
  }
  
  // Location information
  if (analysis.locationInfo?.city && analysis.locationInfo?.state) {
    summary += ` in ${analysis.locationInfo.city}, ${analysis.locationInfo.state}`;
  }
  
  // Damage information
  const damageType = determineDamageType(content, analysis);
  
  if (damageType.includes('keying')) {
    summary += '. The vehicle was keyed, causing damage to the paint.';
  } else if (damageType.includes('broken_windows')) {
    summary += '. One or more windows were broken or smashed.';
  } else if (damageType.includes('graffiti')) {
    summary += '. The target was tagged with graffiti.';
  } else if (damageType.includes('tire_slashing')) {
    summary += '. The tires were slashed or otherwise damaged.';
  } else if (damageType.includes('arson')) {
    summary += '. The target was set on fire or damaged by arson.';
  } else if (damageType.includes('denting')) {
    summary += '. The body was dented or physically damaged.';
  } else {
    summary += '. The target sustained damage from vandalism.';
  }
  
  // Add source information
  summary += ` This incident was reported on ${analysis.platform || 'social media'}.`;
  
  return summary;
}

/**
 * Updates a case with new information
 * @param caseId The case ID
 * @param updateData The update data
 */
export async function updateCase(caseId: string, updateData: Partial<Case>) {
  try {
    const { error } = await supabase
      .from('cases')
      .update(updateData)
      .eq('id', caseId);
    
    if (error) throw error;
    
    // Create a case update to record the changes
    let updateType = 'other';
    let title = 'Case updated';
    let description = 'The case was updated with new information.';
    
    if (updateData.status && updateData.status !== 'reported') {
      updateType = 'status_change';
      title = `Status changed to ${updateData.status}`;
      description = `The case status was updated to "${updateData.status}".`;
    } else if (updateData.location_city || updateData.location_state) {
      updateType = 'location_update';
      title = 'Location information updated';
      description = 'The location information for this case was updated.';
    }
    
    await createCaseUpdate({
      case_id: caseId,
      update_type: updateType,
      title,
      description,
      is_public: true,
      importance: 3
    });
    
    return { success: true };
  } catch (error) {
    console.error('Error updating case:', error);
    throw error;
  }
}

/**
 * Gets a case by ID with all related information
 * @param caseId The case ID
 * @returns The case with related information
 */
export async function getCaseWithDetails(caseId: string) {
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
    
    // Get suspects
    const { data: suspects, error: suspectsError } = await supabase
      .from('case_suspects')
      .select('*, suspect:suspect_id(*)')
      .eq('case_id', caseId);
    
    if (suspectsError) throw suspectsError;
    
    return {
      ...case_,
      media: media || [],
      updates: updates || [],
      relatedCases: relatedCases || [],
      suspects: suspects || []
    };
  } catch (error) {
    console.error('Error getting case with details:', error);
    throw error;
  }
}

/**
 * Gets cases with filtering and pagination
 * @param filters Filter criteria
 * @param page Page number
 * @param pageSize Page size
 * @returns Paginated cases
 */
export async function getCases(filters: any = {}, page = 1, pageSize = 20) {
  try {
    let query = supabase
      .from('cases')
      .select('*, media:case_media(*)');
    
    // Apply filters
    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    
    if (filters.target_type) {
      query = query.eq('target_type', filters.target_type);
    }
    
    if (filters.location_city) {
      query = query.eq('location_city', filters.location_city);
    }
    
    if (filters.location_state) {
      query = query.eq('location_state', filters.location_state);
    }
    
    if (filters.search) {
      query = query.textSearch('search_vector', filters.search);
    }
    
    // Apply pagination
    const start = (page - 1) * pageSize;
    const end = start + pageSize - 1;
    
    query = query
      .order('created_at', { ascending: false })
      .range(start, end);
    
    const { data, error, count } = await query;
    
    if (error) throw error;
    
    // Get total count for pagination
    const { count: totalCount, error: countError } = await supabase
      .from('cases')
      .select('*', { count: 'exact', head: true });
    
    if (countError) throw countError;
    
    return {
      cases: data || [],
      pagination: {
        page,
        pageSize,
        totalCount: totalCount || 0,
        totalPages: Math.ceil((totalCount || 0) / pageSize)
      }
    };
  } catch (error) {
    console.error('Error getting cases:', error);
    throw error;
  }
}
