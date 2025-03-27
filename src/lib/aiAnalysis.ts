import type { TwitterSearchResponse } from '$lib/types/twitter';

/**
 * AI Analysis Pipeline for processing social media content
 * This module handles the analysis of text and media content to identify Tesla vandalism incidents
 */

// Content classification thresholds
const RELEVANCE_THRESHOLD = 0.7;
const VANDALISM_THRESHOLD = 0.8;

/**
 * Analyzes text content to determine if it's related to Tesla vandalism
 * @param text The text content to analyze
 * @returns Object containing analysis results
 */
export async function analyzeTextContent(text: string) {
  // In a production environment, this would call an AI service like OpenAI
  // For now, we'll implement a keyword-based approach
  
  const teslaKeywords = ['tesla', 'cybertruck', 'model s', 'model 3', 'model x', 'model y'];
  const vandalismKeywords = ['vandalism', 'vandalized', 'damaged', 'keyed', 'scratched', 'broken', 'smashed', 'graffiti'];
  
  const textLower = text.toLowerCase();
  
  // Check for Tesla references
  const hasTeslaReference = teslaKeywords.some(keyword => textLower.includes(keyword));
  
  // Check for vandalism references
  const hasVandalismReference = vandalismKeywords.some(keyword => textLower.includes(keyword));
  
  // Calculate simple relevance score
  const teslaScore = hasTeslaReference ? 0.8 : 0;
  const vandalismScore = hasVandalismReference ? 0.8 : 0;
  
  // Combined score with higher weight on vandalism terms
  const relevanceScore = (teslaScore * 0.4) + (vandalismScore * 0.6);
  
  // Extract potential location information
  const locationInfo = extractLocationInfo(text);
  
  // Extract potential vehicle information
  const vehicleInfo = extractVehicleInfo(text);
  
  // Generate a summary if the content is relevant
  let summary = '';
  if (relevanceScore > RELEVANCE_THRESHOLD) {
    summary = generateSummary(text, locationInfo, vehicleInfo);
  }
  
  return {
    isRelevant: relevanceScore > RELEVANCE_THRESHOLD,
    isVandalism: relevanceScore > VANDALISM_THRESHOLD,
    relevanceScore,
    hasTeslaReference,
    hasVandalismReference,
    locationInfo,
    vehicleInfo,
    summary,
    entities: extractEntities(text)
  };
}

/**
 * Analyzes a Twitter search response to find relevant vandalism content
 * @param response The Twitter search API response
 * @returns Array of relevant tweets with analysis results
 */
export async function analyzeTwitterSearchResults(response: TwitterSearchResponse) {
  const relevantTweets = [];
  
  // Process each tweet in the response
  if (response.result?.timeline?.instructions) {
    for (const instruction of response.result.timeline.instructions) {
      if (instruction.entries) {
        for (const entry of instruction.entries) {
          // Process tweet content if available
          if (entry.content?.items) {
            for (const item of entry.content.items) {
              if (item.item?.itemContent?.tweet_results?.result) {
                const tweet = item.item.itemContent.tweet_results.result;
                
                // Extract the tweet text
                const tweetText = tweet.legacy?.full_text || '';
                
                // Analyze the tweet text
                const analysis = await analyzeTextContent(tweetText);
                
                // If relevant, add to our results
                if (analysis.isRelevant) {
                  relevantTweets.push({
                    tweet,
                    analysis,
                    tweetId: tweet.rest_id,
                    text: tweetText,
                    authorUsername: tweet.core?.user_results?.result?.legacy?.screen_name || '',
                    authorName: tweet.core?.user_results?.result?.legacy?.name || '',
                    postedAt: tweet.legacy?.created_at || '',
                    mediaUrls: extractMediaUrls(tweet)
                  });
                }
              }
            }
          }
        }
      }
    }
  }
  
  return relevantTweets;
}

/**
 * Extracts location information from text
 * @param text The text to analyze
 * @returns Object containing extracted location information
 */
function extractLocationInfo(text: string) {
  // In a production environment, this would use named entity recognition
  // For now, we'll use a simple pattern matching approach
  
  const cityStatePattern = /in ([A-Za-z\s]+),\s*([A-Z]{2})/;
  const cityStateMatch = text.match(cityStatePattern);
  
  let city = '';
  let state = '';
  
  if (cityStateMatch && cityStateMatch.length >= 3) {
    city = cityStateMatch[1].trim();
    state = cityStateMatch[2];
  }
  
  return {
    city,
    state,
    country: 'US', // Default assumption
    confidence: cityStateMatch ? 0.8 : 0.2
  };
}

/**
 * Extracts vehicle information from text
 * @param text The text to analyze
 * @returns Object containing extracted vehicle information
 */
function extractVehicleInfo(text: string) {
  const textLower = text.toLowerCase();
  
  // Check for Tesla model references
  const modelPatterns = [
    { pattern: /cybertruck/i, model: 'Cybertruck' },
    { pattern: /model\s*s/i, model: 'Model S' },
    { pattern: /model\s*3/i, model: 'Model 3' },
    { pattern: /model\s*x/i, model: 'Model X' },
    { pattern: /model\s*y/i, model: 'Model Y' }
  ];
  
  let model = '';
  for (const { pattern, model: modelName } of modelPatterns) {
    if (pattern.test(textLower)) {
      model = modelName;
      break;
    }
  }
  
  // Check for color references
  const colorPatterns = [
    { pattern: /white/i, color: 'white' },
    { pattern: /black/i, color: 'black' },
    { pattern: /red/i, color: 'red' },
    { pattern: /blue/i, color: 'blue' },
    { pattern: /silver/i, color: 'silver' },
    { pattern: /gray|grey/i, color: 'gray' }
  ];
  
  let color = '';
  for (const { pattern, color: colorName } of colorPatterns) {
    if (pattern.test(textLower)) {
      color = colorName;
      break;
    }
  }
  
  return {
    make: 'Tesla',
    model,
    color,
    year: extractYear(text),
    confidence: model ? 0.9 : 0.3
  };
}

/**
 * Extracts a year from text
 * @param text The text to analyze
 * @returns Extracted year or empty string
 */
function extractYear(text: string) {
  // Look for 4-digit years between 2008 (first Tesla) and current year
  const currentYear = new Date().getFullYear();
  const yearPattern = new RegExp(`\\b(20[0-9][0-9])\\b`);
  const yearMatch = text.match(yearPattern);
  
  if (yearMatch && yearMatch[1]) {
    const year = parseInt(yearMatch[1]);
    if (year >= 2008 && year <= currentYear) {
      return year.toString();
    }
  }
  
  return '';
}

/**
 * Extracts entities from text (people, organizations, etc.)
 * @param text The text to analyze
 * @returns Array of extracted entities
 */
function extractEntities(text: string) {
  // In a production environment, this would use a proper NER model
  // For now, we'll return a simplified version
  
  const entities = [];
  
  // Look for potential person names (simplified)
  const namePattern = /([A-Z][a-z]+)\s+([A-Z][a-z]+)/g;
  let nameMatch;
  
  while ((nameMatch = namePattern.exec(text)) !== null) {
    entities.push({
      type: 'PERSON',
      text: nameMatch[0],
      start: nameMatch.index,
      end: nameMatch.index + nameMatch[0].length
    });
  }
  
  return entities;
}

/**
 * Extracts media URLs from a tweet
 * @param tweet The tweet object
 * @returns Array of media URLs
 */
function extractMediaUrls(tweet: any) {
  const mediaUrls = [];
  
  if (tweet.legacy?.entities?.media) {
    for (const media of tweet.legacy.entities.media) {
      if (media.media_url_https) {
        mediaUrls.push({
          type: media.type || 'photo',
          url: media.media_url_https,
          width: media.sizes?.large?.w || 0,
          height: media.sizes?.large?.h || 0
        });
      }
    }
  }
  
  // Check extended entities for videos
  if (tweet.legacy?.extended_entities?.media) {
    for (const media of tweet.legacy.extended_entities.media) {
      if (media.video_info?.variants) {
        // Find the highest bitrate video
        const videos = media.video_info.variants
          .filter((v: any) => v.content_type === 'video/mp4' && v.bitrate)
          .sort((a: any, b: any) => b.bitrate - a.bitrate);
        
        if (videos.length > 0) {
          mediaUrls.push({
            type: 'video',
            url: videos[0].url,
            width: media.sizes?.large?.w || 0,
            height: media.sizes?.large?.h || 0,
            duration: media.video_info.duration_millis / 1000 || 0
          });
        }
      }
    }
  }
  
  return mediaUrls;
}

/**
 * Generates a summary of a vandalism incident
 * @param text The original text
 * @param locationInfo Extracted location information
 * @param vehicleInfo Extracted vehicle information
 * @returns Generated summary
 */
function generateSummary(text: string, locationInfo: any, vehicleInfo: any) {
  // In a production environment, this would use a language model
  // For now, we'll create a template-based summary
  
  let summary = 'Tesla vandalism incident';
  
  if (vehicleInfo.model) {
    summary = `Tesla ${vehicleInfo.model} vandalism incident`;
  }
  
  if (vehicleInfo.color) {
    summary = `${vehicleInfo.color} ${summary}`;
  }
  
  if (locationInfo.city && locationInfo.state) {
    summary += ` in ${locationInfo.city}, ${locationInfo.state}`;
  }
  
  // Add details about the type of vandalism
  if (text.toLowerCase().includes('key')) {
    summary += '. Vehicle was keyed';
  } else if (text.toLowerCase().includes('window') && (text.toLowerCase().includes('break') || text.toLowerCase().includes('broke') || text.toLowerCase().includes('broken'))) {
    summary += '. Windows were broken';
  } else if (text.toLowerCase().includes('graffiti')) {
    summary += '. Vehicle was tagged with graffiti';
  } else if (text.toLowerCase().includes('tire') || text.toLowerCase().includes('tyre')) {
    summary += '. Tires were damaged';
  } else {
    summary += '. Vehicle was damaged';
  }
  
  return summary;
}

/**
 * Analyzes media content to detect vandalism
 * @param mediaUrl URL of the media to analyze
 * @param mediaType Type of media (image or video)
 * @returns Analysis results
 */
export async function analyzeMediaContent(mediaUrl: string, mediaType: 'image' | 'video') {
  // In a production environment, this would use computer vision models
  // For now, we'll return placeholder results
  
  return {
    isVandalism: true,
    confidence: 0.85,
    damageType: 'unknown',
    damageLocation: 'vehicle_body',
    detectedObjects: ['car', 'person'],
    analysis: 'Media appears to show damage to a Tesla vehicle'
  };
}

/**
 * Determines if two social media posts are about the same incident
 * @param post1 First post
 * @param post2 Second post
 * @returns Similarity score and boolean indicating if they're the same incident
 */
export function detectDuplicateIncidents(post1: any, post2: any) {
  // Calculate similarity based on:
  // 1. Location proximity
  // 2. Time proximity
  // 3. Vehicle similarity
  // 4. Content similarity
  
  let similarityScore = 0;
  
  // Location similarity (simplified)
  if (post1.locationInfo.city && post2.locationInfo.city && 
      post1.locationInfo.city === post2.locationInfo.city) {
    similarityScore += 0.3;
  }
  
  // Vehicle similarity
  if (post1.vehicleInfo.model && post2.vehicleInfo.model && 
      post1.vehicleInfo.model === post2.vehicleInfo.model) {
    similarityScore += 0.2;
  }
  
  // Time proximity (if within 24 hours)
  const date1 = new Date(post1.postedAt);
  const date2 = new Date(post2.postedAt);
  const hoursDiff = Math.abs(date1.getTime() - date2.getTime()) / (1000 * 60 * 60);
  
  if (hoursDiff < 24) {
    similarityScore += 0.3 * (1 - (hoursDiff / 24));
  }
  
  // Content similarity (simplified)
  // In production, this would use text similarity algorithms
  
  return {
    similarityScore,
    isSameIncident: similarityScore > 0.7
  };
}
