-- TeslaJustice Supabase Schema for Social Media Monitoring

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- For text search

-- User Profiles
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL CHECK (role IN ('admin', 'moderator', 'viewer')) DEFAULT 'viewer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Social Media Sources
CREATE TABLE social_media_sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  platform TEXT NOT NULL CHECK (platform IN ('twitter', 'instagram', 'facebook', 'youtube', 'reddit', 'tiktok')),
  platform_id TEXT NOT NULL,  -- Original ID from the platform
  url TEXT NOT NULL,
  author_username TEXT NOT NULL,
  author_display_name TEXT,
  author_avatar_url TEXT,
  content TEXT,
  posted_at TIMESTAMPTZ NOT NULL,
  collected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_reply BOOLEAN DEFAULT FALSE,
  reply_to_id UUID REFERENCES social_media_sources(id),
  metadata JSONB,
  UNIQUE(platform, platform_id)
);

-- Vandalism Cases
CREATE TABLE cases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  headline TEXT NOT NULL,
  summary TEXT NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('vehicle', 'building', 'property')),
  target_details JSONB,  -- Structured data about the target (vehicle make/model, building type, etc.)
  location_city TEXT,
  location_state TEXT,
  location_country TEXT,
  location_address TEXT,
  location_coordinates POINT,
  incident_date TIMESTAMPTZ,
  incident_date_confirmed BOOLEAN DEFAULT FALSE,
  status TEXT NOT NULL CHECK (status IN ('reported', 'verified', 'identified', 'apprehended', 'prosecuted', 'resolved', 'unresolved')) DEFAULT 'reported',
  severity TEXT CHECK (severity IN ('minor', 'moderate', 'major', 'severe')),
  damage_type TEXT[] DEFAULT '{}',  -- Array of damage types (graffiti, broken windows, etc.)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  ai_confidence REAL CHECK (ai_confidence >= 0 AND ai_confidence <= 1),
  is_verified BOOLEAN DEFAULT FALSE,
  verified_by UUID REFERENCES profiles(id),
  verified_at TIMESTAMPTZ,
  is_duplicate BOOLEAN DEFAULT FALSE,
  duplicate_of UUID REFERENCES cases(id),
  search_vector TSVECTOR
);

-- Case Media
CREATE TABLE case_media (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  source_id UUID REFERENCES social_media_sources(id),
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video', 'audio', 'document')),
  url TEXT NOT NULL,
  storage_path TEXT,  -- Path in S3-compatible storage
  thumbnail_url TEXT,
  content_type TEXT,
  file_size INTEGER,
  duration INTEGER,  -- For video/audio in seconds
  width INTEGER,     -- For images/videos
  height INTEGER,    -- For images/videos
  is_primary BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB,    -- Additional metadata from analysis
  ai_analysis JSONB  -- Results from AI analysis
);

-- Case Updates
CREATE TABLE case_updates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  source_id UUID REFERENCES social_media_sources(id),
  update_type TEXT NOT NULL CHECK (update_type IN ('status_change', 'new_information', 'suspect_identified', 'media_added', 'location_update', 'other')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  previous_status TEXT,
  new_status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  is_public BOOLEAN DEFAULT TRUE,
  importance INTEGER CHECK (importance >= 1 AND importance <= 5) DEFAULT 3
);

-- Suspects
CREATE TABLE suspects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT,
  description TEXT,
  image_url TEXT,
  is_identified BOOLEAN DEFAULT FALSE,
  is_apprehended BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB
);

-- Case-Suspect Relationship
CREATE TABLE case_suspects (
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  suspect_id UUID NOT NULL REFERENCES suspects(id) ON DELETE CASCADE,
  confidence_level TEXT CHECK (confidence_level IN ('low', 'medium', 'high', 'confirmed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (case_id, suspect_id)
);

-- Related Cases
CREATE TABLE related_cases (
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  related_case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL CHECK (relationship_type IN ('same_location', 'same_suspect', 'same_method', 'part_of_series', 'other')),
  relationship_strength REAL CHECK (relationship_strength >= 0 AND relationship_strength <= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  is_ai_generated BOOLEAN DEFAULT TRUE,
  PRIMARY KEY (case_id, related_case_id)
);

-- Tags
CREATE TABLE tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  category TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Case Tags
CREATE TABLE case_tags (
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  PRIMARY KEY (case_id, tag_id)
);

-- Monitoring Keywords
CREATE TABLE monitoring_keywords (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  keyword TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('twitter', 'instagram', 'facebook', 'youtube', 'reddit', 'tiktok', 'all')),
  is_active BOOLEAN DEFAULT TRUE,
  priority INTEGER CHECK (priority >= 1 AND priority <= 5) DEFAULT 3,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id)
);

-- Monitoring Accounts
CREATE TABLE monitoring_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  platform TEXT NOT NULL CHECK (platform IN ('twitter', 'instagram', 'facebook', 'youtube', 'reddit', 'tiktok')),
  username TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  priority INTEGER CHECK (priority >= 1 AND priority <= 5) DEFAULT 3,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  UNIQUE(platform, username)
);

-- Analytics Events
CREATE TABLE analytics_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type TEXT NOT NULL,
  event_data JSONB NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  case_id UUID REFERENCES cases(id) ON DELETE SET NULL,
  source_id UUID REFERENCES social_media_sources(id) ON DELETE SET NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL
);

-- Create indexes for performance
CREATE INDEX idx_social_media_sources_platform_posted ON social_media_sources(platform, posted_at);
CREATE INDEX idx_cases_status ON cases(status);
CREATE INDEX idx_cases_location ON cases(location_city, location_state, location_country);
CREATE INDEX idx_cases_incident_date ON cases(incident_date);
CREATE INDEX idx_cases_search_vector ON cases USING GIN(search_vector);
CREATE INDEX idx_case_media_case_id ON case_media(case_id);
CREATE INDEX idx_case_updates_case_id ON case_updates(case_id);
CREATE INDEX idx_case_suspects_suspect_id ON case_suspects(suspect_id);
CREATE INDEX idx_case_tags_tag_id ON case_tags(tag_id);

-- Create function to update search vector
CREATE OR REPLACE FUNCTION cases_search_update() RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector = 
    setweight(to_tsvector('english', COALESCE(NEW.headline, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.summary, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.location_city, '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(NEW.location_state, '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(NEW.location_country, '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(NEW.location_address, '')), 'D');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for search vector updates
CREATE TRIGGER cases_search_update_trigger
BEFORE INSERT OR UPDATE ON cases
FOR EACH ROW EXECUTE FUNCTION cases_search_update();

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION update_timestamp() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for timestamp updates
CREATE TRIGGER update_profiles_timestamp
BEFORE UPDATE ON profiles
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_cases_timestamp
BEFORE UPDATE ON cases
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_suspects_timestamp
BEFORE UPDATE ON suspects
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- Row Level Security Policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_media_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE suspects ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_suspects ENABLE ROW LEVEL SECURITY;
ALTER TABLE related_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitoring_keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitoring_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

-- Policies for profiles
CREATE POLICY "Public profiles are viewable by everyone" ON profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Policies for cases
CREATE POLICY "Cases are viewable by everyone" ON cases
  FOR SELECT USING (true);

CREATE POLICY "Admins can insert cases" ON cases
  FOR INSERT WITH CHECK (
    auth.uid() IN (
      SELECT id FROM profiles WHERE role = 'admin' OR role = 'moderator'
    )
  );

CREATE POLICY "Admins can update cases" ON cases
  FOR UPDATE USING (
    auth.uid() IN (
      SELECT id FROM profiles WHERE role = 'admin' OR role = 'moderator'
    )
  );

-- Policies for case_media
CREATE POLICY "Case media is viewable by everyone" ON case_media
  FOR SELECT USING (true);

CREATE POLICY "Admins can insert case media" ON case_media
  FOR INSERT WITH CHECK (
    auth.uid() IN (
      SELECT id FROM profiles WHERE role = 'admin' OR role = 'moderator'
    )
  );

-- Policies for case_updates
CREATE POLICY "Public updates are viewable by everyone" ON case_updates
  FOR SELECT USING (is_public = true);

CREATE POLICY "Admins can view all updates" ON case_updates
  FOR SELECT USING (
    auth.uid() IN (
      SELECT id FROM profiles WHERE role = 'admin' OR role = 'moderator'
    )
  );

CREATE POLICY "Admins can insert updates" ON case_updates
  FOR INSERT WITH CHECK (
    auth.uid() IN (
      SELECT id FROM profiles WHERE role = 'admin' OR role = 'moderator'
    )
  );

-- Initial data
INSERT INTO tags (name, category) VALUES
  ('Graffiti', 'damage_type'),
  ('Broken Windows', 'damage_type'),
  ('Keying', 'damage_type'),
  ('Tire Slashing', 'damage_type'),
  ('Arson', 'damage_type'),
  ('Cybertruck', 'vehicle_model'),
  ('Model S', 'vehicle_model'),
  ('Model 3', 'vehicle_model'),
  ('Model X', 'vehicle_model'),
  ('Model Y', 'vehicle_model');

INSERT INTO monitoring_keywords (keyword, platform, priority) VALUES
  ('tesla vandalism', 'all', 5),
  ('tesla damage', 'all', 4),
  ('cybertruck vandalized', 'all', 5),
  ('keyed tesla', 'all', 4),
  ('tesla windows broken', 'all', 4),
  ('tesla graffiti', 'all', 3),
  ('#TeslaJustice', 'all', 5),
  ('@TeslaJustice', 'twitter', 5);
