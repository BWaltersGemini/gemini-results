// src/supabaseClient.js
import { createClient } from '@supabase/supabase-js';

// Use Vite's import.meta.env for environment variables (must be prefixed with VITE_)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Throw early if missing (helps catch config errors in dev)
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase URL or Anon Key. Check your .env file and ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set.');
}

// Create the Supabase client
const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false, // Set to true if you plan to use authentication later
  },
});

// Export as named export (standard ESM syntax)
export { supabaseClient as supabase };