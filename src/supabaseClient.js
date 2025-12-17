// src/supabaseClient.js
import { createClient } from '@supabase/supabase-js';

// Load environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

// Early validation for public credentials
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase URL or Anon Key. Check your .env file and ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set.'
  );
}

// Public client — used by all public-facing code (results, config reads, etc.)
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false, // No user authentication needed for public access
  },
});

// Admin client factory — ONLY import this in AdminPage.jsx and MasterEvents.jsx
export const createAdminSupabaseClient = () => {
  if (!supabaseServiceRoleKey) {
    console.error(
      'VITE_SUPABASE_SERVICE_ROLE_KEY is missing in .env! ' +
      'Admin saves will fail due to RLS. Add the service_role key from Supabase → Settings → API.'
    );
    // Fallback to public client (writes will fail with 401/RLS error)
    return supabase;
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        'x-client-info': 'admin-client', // Helpful for debugging in Supabase logs
      },
    },
  });
};