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

// Singleton instances
let publicClient = null;
let adminClient = null;

/**
 * Public Supabase client (anon key) — used everywhere in the app
 * Created only once to prevent multiple GoTrueClient warnings
 */
export const supabase = (() => {
  if (!publicClient) {
    publicClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,        // ← NOW ENABLED: Sessions saved to localStorage
        autoRefreshToken: true,      // ← Auto-refreshes expired tokens
        detectSessionInUrl: true,    // ← Handles OAuth/magic link redirects
        storage: localStorage,       // ← Explicitly use localStorage (default but safe)
      },
    });
  }
  return publicClient;
})();

/**
 * Admin Supabase client factory (service_role key)
 * Returns the same instance on every call — avoids multiple auth clients
 */
export const createAdminSupabaseClient = () => {
  if (adminClient) {
    return adminClient;
  }
  if (!supabaseServiceRoleKey) {
    console.error(
      'VITE_SUPABASE_SERVICE_ROLE_KEY is missing in .env! ' +
      'Admin actions will fail due to RLS. Add the service_role key from Supabase → Settings → API.'
    );
    // Fallback to public client (writes will be blocked by RLS)
    return supabase;
  }
  adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        'x-client-info': 'admin-client', // Helpful for Supabase logs
      },
    },
  });
  return adminClient;
};