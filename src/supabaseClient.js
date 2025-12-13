import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://frurvzrazckqqtyqsdmy.supabase.co';  // Replace with your actual URL
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZydXJ2enJhemNrcXF0eXFzZG15Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1Njk1NzQsImV4cCI6MjA4MTE0NTU3NH0.HEtfpyZw0PnzuC9tSqgJcTfx1v3DpjvqtptwrFDL07c';  // From Supabase dashboard

export const supabase = createClient(supabaseUrl, supabaseAnonKey);