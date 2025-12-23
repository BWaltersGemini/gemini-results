// src/api/chronotrackAdminApi.js
// Admin-only API calls (privileged data like emails)
// Separate from public chronotrackapi.js to avoid any risk to results loading

import axios from 'axios';

const PROXY_BASE = '/chrono-api';
let accessToken = null;
let tokenExpiration = 0;

// Duplicate auth logic (safe — small and stable)
const fetchAccessToken = async () => {
  try {
    const clientId = import.meta.env.VITE_CHRONOTRACK_CLIENT_ID;
    const clientSecret = import.meta.env.VITE_CHRONOTRACK_SECRET;
    const username = import.meta.env.VITE_CHRONOTRACK_USER;
    const password = import.meta.env.VITE_CHRONOTRACK_PASS;

    if (!clientId || !clientSecret || !username || !password) {
      throw new Error('Missing ChronoTrack credentials');
    }

    const basicAuth = btoa(`${clientId}:${clientSecret}`);
    const response = await axios.get(`${PROXY_BASE}/oauth2/token`, {
      headers: { Authorization: `Basic ${basicAuth}` },
      params: {
        grant_type: 'password',
        username,
        password,
      },
    });

    const { access_token, expires_in } = response.data;
    if (!access_token) throw new Error('No access token returned');

    accessToken = access_token;
    tokenExpiration = Date.now() + (expires_in || 3600) * 1000;
    console.log('[ChronoTrack Admin] Token acquired');
    return access_token;
  } catch (err) {
    console.error('[ChronoTrack Admin] Token fetch failed:', err.response?.data || err.message);
    throw err;
  }
};

const getAuthHeader = async () => {
  if (!accessToken || Date.now() >= tokenExpiration) {
    await fetchAccessToken();
  }
  return `Bearer ${accessToken}`;
};

/**
 * Fetch registration details for a single entry (includes email if provided)
 */
export const fetchEntryDetails = async (entryId) => {
  if (!entryId) return null;

  try {
    const authHeader = await getAuthHeader();
    const response = await axios.get(`${PROXY_BASE}/api/entry/${entryId}`, {
      headers: { Authorization: authHeader },
      params: { client_id: import.meta.env.VITE_CHRONOTRACK_CLIENT_ID },
      timeout: 10000,
    });

    const entry = response.data.entry;
    if (!entry) return null;

    // Prefer athlete_email, fallback to transaction email
    let email = entry.athlete_email || entry.reg_transaction_account_email || null;

    // Filter out obvious placeholders
    if (email && (email.includes('none+') || !email.includes('@'))) {
      email = null;
    }

    if (!email) return null;

    return {
      email: email.toLowerCase().trim(),
      firstName: entry.athlete_first_name?.trim() || '',
      lastName: entry.athlete_last_name?.trim() || '',
      fullName: `${entry.athlete_first_name || ''} ${entry.athlete_last_name || ''}`.trim(),
    };
  } catch (err) {
    console.warn(`[AdminAPI] Failed to fetch entry ${entryId}:`, err.message);
    return null;
  }
};

/**
 * Batch fetch valid emails from list of entry_ids
 * Safe concurrency + progress friendly
 */
export const fetchEmailsForEntries = async (entryIds = [], onProgress) => {
  if (entryIds.length === 0) return [];

  const validEmails = [];
  const batchSize = 10;
  let processed = 0;

  for (let i = 0; i < entryIds.length; i += batchSize) {
    const batch = entryIds.slice(i, i + batchSize);
    const promises = batch.map(id => fetchEntryDetails(id));
    const results = await Promise.all(promises);

    const validInBatch = results.filter(Boolean);
    validEmails.push(...validInBatch);

    processed += batch.length;
    if (onProgress) {
      onProgress(processed, entryIds.length, validEmails.length);
    }

    // Optional: small delay to be gentle on API
    // await new Promise(r => setTimeout(r, 100));
  }

  return validEmails;
};