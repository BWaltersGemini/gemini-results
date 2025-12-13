// src/supabaseClient.js

import { createClient } from '@supabase/supabase-js';

// These values come from your .env file (Vite automatically prefixes with VITE_)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Optional: throw early if missing (helps catch config errors in dev)
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase URL or Anon Key. Check your .env file and ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set.');
}

// Create the Supabase client (v2 syntax)
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false, // Set to true if you plan to use authentication later
  },
});