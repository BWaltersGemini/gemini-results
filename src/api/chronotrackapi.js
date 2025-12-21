// src/api/chronotrackapi.js
// FINAL — Robust OAuth2 password grant (direct, no proxy) + Full pagination + Detailed logging
import axios from 'axios';

const CHRONOTRACK_API = 'https://api.chronotrack.com/api';

// Credentials from .env
const CLIENT_ID = import.meta.env.VITE_CHRONOTRACK_CLIENT_ID;
const CLIENT_SECRET = import.meta.env.VITE_CHRONOTRACK_SECRET;
const USERNAME = import.meta.env.VITE_CHRONOTRACK_USER;
const PASSWORD = import.meta.env.VITE_CHRONOTRACK_PASS;

// Token management
let accessToken = null;
let tokenExpiration = 0;

const fetchAccessToken = async () => {
  if (!CLIENT_ID || !CLIENT_SECRET || !USERNAME || !PASSWORD) {
    throw new Error('Missing ChronoTrack credentials. Check .env: VITE_CHRONOTRACK_CLIENT_ID, CLIENT_SECRET, USER, PASS');
  }

  try {
    const basicAuth = btoa(`${CLIENT_ID}:${CLIENT_SECRET}`);
    const response = await axios.get(`${CHRONOTRACK_API}/oauth2/token`, {
      params: {
        grant_type: 'password',
        username: USERNAME,
        password: PASSWORD,
      },
      headers: {
        Authorization: `Basic ${basicAuth}`,
      },
      timeout: 20000,
    });

    const { access_token, expires_in } = response.data;
    if (!access_token) {
      throw new Error('No access_token returned from ChronoTrack');
    }

    accessToken = access_token;
    tokenExpiration = Date.now() + (expires_in || 3600) * 1000 - 60000; // Refresh 1 min early
    console.log('[ChronoTrack] Access token acquired successfully');
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

// Fetch ALL events (max size 600)
export const fetchEvents = async () => {
  try {
    const authHeader = await getAuthHeader();
    const response = await axios.get(`${CHRONOTRACK_API}/event`, {
      params: {
        format: 'json',
        size: 600,
      },
      headers: { Authorization: authHeader },
      timeout: 30000,
    });

    const data = response.data;
    if (!data?.events || data.events.length === 0) {
      console.warn('[ChronoTrack] No events returned — check credentials or account access');
      return [];
    }

    console.log(`[ChronoTrack] Successfully fetched ${data.events.length} events`);
    return data.events;
  } catch (err) {
    console.error('[ChronoTrack] fetchEvents failed:', err.response?.data || err.message);
    throw err;
  }
};

// Fetch races for a specific event
export const fetchRacesForEvent = async (eventId) => {
  try {
    const authHeader = await getAuthHeader();
    const response = await axios.get(`${CHRONOTRACK_API}/event/${eventId}/races`, {
      params: { format: 'json' },
      headers: { Authorization: authHeader },
      timeout: 20000,
    });

    const data = response.data;
    if (!data?.races || data.races.length === 0) {
      console.warn(`[ChronoTrack] No races found for event ${eventId}`);
      return [];
    }

    console.log(`[ChronoTrack] Fetched ${data.races.length} races for event ${eventId}`);
    return data.races;
  } catch (err) {
    console.error(`[ChronoTrack] fetchRacesForEvent failed for ${eventId}:`, err.response?.data || err.message);
    throw err;
  }
};

// Helper: Fetch all results from a single bracket (full pagination)
const fetchAllBracketResults = async (bracketId) => {
  let page = 1;
  const pageSize = 1000;
  let allResults = [];

  while (true) {
    try {
      const authHeader = await getAuthHeader();
      const response = await axios.get(`${CHRONOTRACK_API}/bracket/${bracketId}/results`, {
        params: {
          format: 'json',
          page,
          size: pageSize,
        },
        headers: { Authorization: authHeader },
        timeout: 30000,
      });

      const data = response.data;
      if (!data?.results || data.results.length === 0) {
        break;
      }

      allResults = allResults.concat(data.results);
      console.log(`[ChronoTrack] Bracket ${bracketId} — page ${page}: ${data.results.length} results (total: ${allResults.length})`);

      if (data.results.length < pageSize) break; // Last page
      page++;
    } catch (err) {
      console.error(`[ChronoTrack] Bracket ${bracketId} page ${page} failed:`, err.response?.data || err.message);
      break;
    }
  }

  return allResults;
};

// Main: Fetch complete results for an event
export const fetchResultsForEvent = async (eventId) => {
  if (!eventId) throw new Error('eventId required');

  try {
    const races = await fetchRacesForEvent(eventId);
    if (races.length === 0) {
      console.log(`[ChronoTrack] No races found for event ${eventId}`);
      return [];
    }

    const bracketIds = races
      .filter(race => race.brackets && race.brackets.length > 0)
      .flatMap(race => race.brackets.map(b => b.bracket_id))
      .filter(Boolean);

    if (bracketIds.length === 0) {
      console.log(`[ChronoTrack] No brackets found for event ${eventId}`);
      return [];
    }

    console.log(`[ChronoTrack] Fetching results from ${bracketIds.length} brackets for event ${eventId}`);

    // Parallel batch fetching
    const batchSize = 5;
    const allBracketResults = [];

    for (let i = 0; i < bracketIds.length; i += batchSize) {
      const batch = bracketIds.slice(i, i + batchSize);
      const batchPromises = batch.map(id => fetchAllBracketResults(id));
      const batchResults = await Promise.all(batchPromises);
      batchResults.forEach(results => allBracketResults.push(...results));
    }

    // Deduplicate by entry_id
    const seen = new Set();
    const deduped = allBracketResults.filter(r => {
      if (!r.results_entry_id) return true;
      if (seen.has(r.results_entry_id)) return false;
      seen.add(r.results_entry_id);
      return true;
    });

    // Build gender and division place lookups
    const genderPlaces = {};
    const divisionPlaces = {};

    deduped.forEach(r => {
      const genderKey = `${r.results_race_id}-${r.results_sex}-${r.results_entry_id}`;
      if (r.results_gender_rank) {
        genderPlaces[genderKey] = parseInt(r.results_gender_rank, 10);
      }

      if (r.results_primary_bracket_id && r.results_bracket_rank) {
        const divKey = `${r.results_race_id}-${r.results_primary_bracket_id}-${r.results_entry_id}`;
        const existing = divisionPlaces[divKey];
        const newPlace = parseInt(r.results_bracket_rank, 10);
        if (!existing || newPlace < existing.place) {
          divisionPlaces[divKey] = {
            name: r.results_primary_bracket_name || '',
            place: newPlace,
          };
        }
      }
    });

    // Final mapping
    const mappedResults = deduped.map(r => {
      const genderKey = r.results_entry_id ? `${r.results_race_id}-${r.results_sex}-${r.results_entry_id}` : null;
      const divKey = r.results_entry_id ? `${r.results_race_id}-${r.results_primary_bracket_id}-${r.results_entry_id}` : null;
      const divInfo = divKey ? divisionPlaces[divKey] : null;

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
        ? rawSplits.map(split => ({
            name: split.interval_name || split.split_name || 'Split',
            time: split.interval_time || split.split_time || null,
            pace: split.interval_pace || split.split_pace || null,
            place: split.interval_place || split.split_place || null,
          }))
        : [];

      return {
        first_name: r.results_first_name || '',
        last_name: r.results_last_name || '',
        chip_time: r.results_time || '',
        clock_time: r.results_gun_time || '',
        place: r.results_rank ? parseInt(r.results_rank, 10) : null,
        gender_place: genderKey ? genderPlaces[genderKey] || null : null,
        age_group_name: divInfo ? divInfo.name : (r.results_primary_bracket_name || ''),
        age_group_place: divInfo ? divInfo.place : null,
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
        entry_id: r.results_entry_id || null,
      };
    });

    console.log(`[ChronoTrack] Final: ${mappedResults.length} unique results processed for event ${eventId}`);
    return mappedResults;
  } catch (err) {
    console.error(`[ChronoTrack] fetchResultsForEvent failed for ${eventId}:`, err);
    throw err;
  }
};