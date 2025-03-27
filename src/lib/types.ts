import type { TwitterSearchResponse } from './types/twitter';

/**
 * Types for the TeslaJustice application
 */

// User profile
export interface Profile {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  role: 'admin' | 'moderator' | 'viewer';
  created_at: string;
  updated_at: string;
}

// Social media source
export interface SocialMediaSource {
  id?: string;
  platform: 'twitter' | 'instagram' | 'facebook' | 'youtube' | 'reddit' | 'tiktok';
  platform_id: string;
  url: string;
  author_username: string;
  author_display_name?: string;
  author_avatar_url?: string;
  content: string;
  posted_at: string;
  collected_at?: string;
  is_reply?: boolean;
  reply_to_id?: string;
  metadata?: Record<string, any>;
}

// Vandalism case
export interface Case {
  id: string;
  headline: string;
  summary: string;
  target_type: 'vehicle' | 'building' | 'property';
  target_details: Record<string, any>;
  location_city?: string;
  location_state?: string;
  location_country?: string;
  location_address?: string;
  location_coordinates?: [number, number];
  incident_date?: string;
  incident_date_confirmed?: boolean;
  status: 'reported' | 'verified' | 'identified' | 'apprehended' | 'prosecuted' | 'resolved' | 'unresolved';
  severity?: 'minor' | 'moderate' | 'major' | 'severe';
  damage_type?: string[];
  created_at: string;
  updated_at: string;
  created_by?: string;
  ai_confidence?: number;
  is_verified: boolean;
  verified_by?: string;
  verified_at?: string;
  is_duplicate?: boolean;
  duplicate_of?: string;
}

// Case media
export interface CaseMedia {
  id: string;
  case_id: string;
  source_id?: string;
  media_type: 'image' | 'video' | 'audio' | 'document';
  url: string;
  storage_path?: string;
  thumbnail_url?: string;
  content_type?: string;
  file_size?: number;
  duration?: number;
  width?: number;
  height?: number;
  is_primary: boolean;
  created_at: string;
  metadata?: Record<string, any>;
  ai_analysis?: Record<string, any>;
}

// Case update
export interface CaseUpdate {
  id: string;
  case_id: string;
  source_id?: string;
  update_type: 'status_change' | 'new_information' | 'suspect_identified' | 'media_added' | 'location_update' | 'other';
  title: string;
  description: string;
  previous_status?: string;
  new_status?: string;
  created_at: string;
  created_by?: string;
  is_public: boolean;
  importance: number;
}

// Suspect
export interface Suspect {
  id: string;
  name?: string;
  description?: string;
  image_url?: string;
  is_identified: boolean;
  is_apprehended: boolean;
  created_at: string;
  updated_at: string;
  metadata?: Record<string, any>;
}

// Case-Suspect relationship
export interface CaseSuspect {
  case_id: string;
  suspect_id: string;
  confidence_level: 'low' | 'medium' | 'high' | 'confirmed';
  created_at: string;
}

// Related cases
export interface RelatedCase {
  case_id: string;
  related_case_id: string;
  relationship_type: 'same_location' | 'same_suspect' | 'same_method' | 'part_of_series' | 'other';
  relationship_strength: number;
  created_at: string;
  created_by?: string;
  is_ai_generated: boolean;
}

// Tag
export interface Tag {
  id: string;
  name: string;
  category?: string;
  created_at: string;
}

// Case tag
export interface CaseTag {
  case_id: string;
  tag_id: string;
  created_at: string;
  created_by?: string;
}

// Monitoring keyword
export interface MonitoringKeyword {
  id: string;
  keyword: string;
  platform: 'twitter' | 'instagram' | 'facebook' | 'youtube' | 'reddit' | 'tiktok' | 'all';
  is_active: boolean;
  priority: number;
  created_at: string;
  created_by?: string;
}

// Monitoring account
export interface MonitoringAccount {
  id: string;
  platform: 'twitter' | 'instagram' | 'facebook' | 'youtube' | 'reddit' | 'tiktok';
  username: string;
  is_active: boolean;
  priority: number;
  created_at: string;
  created_by?: string;
}

// Analytics event
export interface AnalyticsEvent {
  id: string;
  event_type: string;
  event_data: Record<string, any>;
  occurred_at: string;
  case_id?: string;
  source_id?: string;
  user_id?: string;
}

// Pagination response
export interface PaginationResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
}

// Case creation result
export interface CaseCreationResult {
  caseId: string;
  isNewCase: boolean;
  isDuplicate: boolean;
}

// Social media monitoring result
export interface MonitoringResult {
  platform: string;
  query: string;
  timestamp: string;
  newPosts: number;
  relevantPosts: number;
  newCases: number;
  updatedCases: number;
  processingTime: number;
}
