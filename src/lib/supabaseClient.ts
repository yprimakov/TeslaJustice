import { createClient } from '@supabase/supabase-js';
import type { Database } from './types/supabase';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ciddpvnorrsxtfwssaxb.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpZGRwdm5vcnJzeHRmd3NzYXhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI5MjE2NTQsImV4cCI6MjA1ODQ5NzY1NH0.3KLdHJyIjB9rnRWZXXz3MwYzXJjXhKCjkHrYcDSHD0M';

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
