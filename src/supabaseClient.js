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
 * Public Supabase client (anon key) — used everywhere in the app (including Director auth)
 */
export const supabase = (() => {
  if (!publicClient) {
    publicClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,           // ← CRITICAL: Sessions now saved to localStorage
        autoRefreshToken: true,         // ← Automatically refreshes expired tokens
        detectSessionInUrl: true,       // ← Handles magic links / redirects properly
        storage: localStorage,          // ← Explicitly use localStorage (default, but safe to specify)
      },
    });
  }
  return publicClient;
})();

/**
 * Admin Supabase client factory (service_role key) — ONLY for server-side/admin actions
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
    return supabase; // Fallback to public client (writes will fail due to RLS)
  }

  adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,          // ← Admin client doesn't need session persistence
    },
    global: {
      headers: {
        'x-client-info': 'admin-client',
      },
    },
  });

  return adminClient;
};