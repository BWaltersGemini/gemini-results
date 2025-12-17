// src/supabaseClient.js
import { createClient } from '@supabase/supabase-js';

// Load environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

// Early error if public config is missing
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase URL or Anon Key. Check your .env file and ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set.'
  );
}

// Public client — used everywhere for reading data (results, config, etc.)
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false, // No user auth needed for public access
  },
});

// Admin client factory — ONLY import and use this in AdminPage.jsx and MasterEvents.jsx
export const createAdminSupabaseClient = () => {
  if (!supabaseServiceRoleKey) {
    console.error(
      'VITE_SUPABASE_SERVICE_ROLE_KEY is missing! Admin saves will fail. ' +
      'Add it to your .env file (get it from Supabase → Settings → API → service_role key).'
    );
    // Fallback to public client (will fail on writes due to RLS)
    return supabase;
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      // Service role bypasses RLS completely
    },
    global: {
      headers: {
        // Optional: helpful for debugging in Supabase logs
        'x-client-info': 'admin-client',
      },
    },
  });
};