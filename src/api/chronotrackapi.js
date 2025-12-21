// src/api/chronotrackapi.js
// FINAL — Hybrid: Direct param auth for events (no CORS) + Proxy for token/results (bypasses CORS on oauth2/token)

import axios from 'axios';

const CHRONOTRACK_API = 'https://api.chronotrack.com/api';
const PROXY_BASE = '/chrono-api'; // Your Vercel serverless proxy

let accessToken = null;
let tokenExpiration = 0;

// Token management via proxy (avoids CORS on oauth2/token endpoint)
const fetchAccessToken = async () => {
  const clientId = import.meta.env.VITE_CHRONOTRACK_CLIENT_ID;
  const clientSecret = import.meta.env.VITE_CHRONOTRACK_SECRET;
  const username = import.meta.env.VITE_CHRONOTRACK_USER;
  const password = import.meta.env.VITE_CHRONOTRACK_PASS;

  if (!clientId || !clientSecret || !username || !password) {
    throw new Error('Missing ChronoTrack credentials in .env');
  }

  try {
    const basicAuth = btoa(`${clientId}:${clientSecret}`);
    const response = await axios.get(`${PROXY_BASE}/oauth2/token`, {
      headers: { Authorization: `Basic ${basicAuth}` },
      params: {
        grant_type: 'password',
        username,
        password,
      },
      timeout: 20000,
    });

    const { access_token, expires_in } = response.data;
    if (!access_token) throw new Error('No access_token returned');

    accessToken = access_token;
    tokenExpiration = Date.now() + (expires_in || 3600) * 1000;
    console.log('[ChronoTrack] Token acquired successfully via proxy');
    return access_token;
  } catch (err) {
    console.error('[ChronoTrack] Token fetch failed:', err.response?.data || err.message);
    throw err;
  }
};

const getAuthHeader = async () => {
  if (!accessToken || Date.now() >= tokenExpiration) {
    await fetchAccessToken();
  }
  return `Bearer ${accessToken}`;
};

// EVENTS: Direct parameter authentication (no CORS issues, proven to work)
export const fetchEvents = async () => {
  const clientId = import.meta.env.VITE_CHRONOTRACK_CLIENT_ID;
  const userId = import.meta.env.VITE_CHRONOTRACK_USER;
  const userPass = import.meta.env.VITE_CHRONOTRACK_PASS;

  if (!clientId || !userId || !userPass) {
    throw new Error('Missing direct auth credentials for events');
  }

  try {
    const response = await axios.get(`${CHRONOTRACK_API}/event`, {
      params: {
        format: 'json',
        client_id: clientId,
        user_id: userId,
        user_pass: userPass,
        size: 600,
        include_test_events: true,
      },
      timeout: 30000,
    });

    const events = response.data.events || response.data.event || [];
    console.log(`[ChronoTrack Direct] Fetched ${events.length} events`);
    return events;
  } catch (err) {
    console.error('[ChronoTrack Direct] fetchEvents failed:', err.response?.data || err.message);
    throw err;
  }
};

// RACES: Via proxy + Bearer token
export const fetchRacesForEvent = async (eventId) => {
  try {
    const authHeader = await getAuthHeader();
    const response = await axios.get(`${PROXY_BASE}/api/event/${eventId}/races`, {
      headers: { Authorization: authHeader },
      timeout: 20000,
    });

    const races = response.data.races || response.data.event_race || [];
    console.log(`[ChronoTrack Proxy] Fetched ${races.length} races for event ${eventId}`);
    return races;
  } catch (err) {
    console.error(`[ChronoTrack Proxy] fetchRacesForEvent failed:`, err.response?.data || err.message);
    throw err;
  }
};

// Helper: fetch all results from one bracket via proxy
const fetchAllBracketResults = async (bracketId) => {
  let page = 1;
  const pageSize = 1000;
  let allResults = [];

  while (true) {
    try {
      const authHeader = await getAuthHeader();
      const response = await axios.get(`${PROXY_BASE}/api/bracket/${bracketId}/results`, {
        headers: { Authorization: authHeader },
        params: {
          format: 'json',
          page,
          size: pageSize,
        },
        timeout: 30000,
      });

      const results = response.data.results || response.data.bracket_results || [];
      if (results.length === 0) break;

      allResults = allResults.concat(results);
      console.log(`[ChronoTrack Proxy] Bracket ${bracketId} page ${page}: +${results.length} (total: ${allResults.length})`);

      if (results.length < pageSize) break;
      page++;
    } catch (err) {
      console.error(`[ChronoTrack Proxy] Bracket ${bracketId} page ${page} failed:`, err.response?.data || err.message);
      break;
    }
  }

  return allResults;
};

// RESULTS: Via proxy + full pagination + gender/division places
export const fetchResultsForEvent = async (eventId) => {
  if (!eventId) throw new Error('eventId required');

  try {
    // Fetch races (for logging/context)
    const races = await fetchRacesForEvent(eventId);

    // Fetch all brackets
    const authHeader = await getAuthHeader();
    const bracketsResponse = await axios.get(`${PROXY_BASE}/api/event/${eventId}/bracket`, {
      headers: { Authorization: authHeader },
      params: { size: 500 },
      timeout: 20000,
    });

    const allBrackets = bracketsResponse.data.event_bracket || [];

    const leaderboardBrackets = allBrackets
      .filter(b => b.bracket_wants_leaderboard === '1')
      .map(b => b.bracket_id)
      .filter(Boolean);

    if (leaderboardBrackets.length === 0) {
      console.log(`[ChronoTrack] No leaderboard brackets for event ${eventId}`);
      return [];
    }

    console.log(`[ChronoTrack] Fetching results from ${leaderboardBrackets.length} brackets`);

    // Batch fetch
    const batchSize = 5;
    const allBracketResults = [];

    for (let i = 0; i < leaderboardBrackets.length; i += batchSize) {
      const batch = leaderboardBrackets.slice(i, i + batchSize);
      const promises = batch.map(id => fetchAllBracketResults(id));
      const results = await Promise.all(promises);
      results.forEach(res => allBracketResults.push(...res));
    }

    // Deduplicate by entry_id
    const seen = new Set();
    const deduped = allBracketResults.filter(r => {
      const id = r.results_entry_id || r.entry_id;
      if (!id) return true;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });

    // Build gender & division place maps
    const genderPlaces = {};
    const divisionPlaces = {};

    deduped.forEach(r => {
      const entryId = r.results_entry_id || r.entry_id;
      if (!entryId) return;

      if (r.results_gender_rank) {
        genderPlaces[entryId] = parseInt(r.results_gender_rank, 10);
      }

      if (r.results_bracket_rank && r.results_primary_bracket_name) {
        const place = parseInt(r.results_bracket_rank, 10);
        const existing = divisionPlaces[entryId];
        if (!existing || place < existing.place) {
          divisionPlaces[entryId] = {
            name: r.results_primary_bracket_name.trim(),
            place,
          };
        }
      }
    });

    // Final mapping
    const mappedResults = deduped.map(r => {
      const entryId = r.results_entry_id || r.entry_id;

      let city = r.results_city || null;
      let state = r.results_state || r.results_state_code || null;
      let country = r.results_country || r.results_country_code || null;

      if (r.results_hometown) {
        const parts = r.results_hometown.split(',').map(p => p.trim());
        city = parts[0] || city;
        state = parts[1] || state;
        country = parts[2] || country;
      }

      const rawSplits = r.splits || r.interval_results || r.results_splits || [];
      const splits = Array.isArray(rawSplits)
        ? rawSplits.map(s => ({
            name: s.interval_name || s.split_name || 'Split',
            time: s.interval_time || s.split_time,
            pace: s.interval_pace || s.split_pace,
            place: s.interval_place || s.split_place,
          }))
        : [];

      return {
        first_name: r.results_first_name || '',
        last_name: r.results_last_name || '',
        chip_time: r.results_time || '',
        clock_time: r.results_gun_time || '',
        place: r.results_rank ? parseInt(r.results_rank, 10) : null,
        gender_place: entryId ? genderPlaces[entryId] : null,
        age_group_name: entryId && divisionPlaces[entryId] ? divisionPlaces[entryId].name : (r.results_primary_bracket_name || ''),
        age_group_place: entryId && divisionPlaces[entryId] ? divisionPlaces[entryId].place : null,
        pace: r.results_pace || '',
        age: r.results_age ? parseInt(r.results_age, 10) : null,
        gender: r.results_sex || '',
        bib: r.results_bib || '',
        race_id: r.results_race_id || null,
        race_name: r.results_race_name || '',
        city,
        state,
        country,
        splits,
        entry_id: entryId || null,
      };
    });

    console.log(`[ChronoTrack] Final: ${mappedResults.length} unique results for event ${eventId}`);
    return mappedResults;
  } catch (err) {
    console.error(`[ChronoTrack] fetchResultsForEvent failed:`, err);
    throw err;
  }
};