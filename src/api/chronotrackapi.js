// src/api/chronotrackapi.js
// FINAL — Direct parameter authentication for ALL endpoints (events + results)
// No proxy, no OAuth2 token — uses client_id/user_id/user_pass params (official supported method)

import axios from 'axios';

// Direct ChronoTrack API base
const CHRONOTRACK_API = 'https://api.chronotrack.com/api';

// Shared credentials (loaded once)
const CLIENT_ID = import.meta.env.VITE_CHRONOTRACK_CLIENT_ID;
const USER_ID = import.meta.env.VITE_CHRONOTRACK_USER;
const USER_PASS = import.meta.env.VITE_CHRONOTRACK_PASS;

// Common auth params for all requests
const AUTH_PARAMS = {
  client_id: CLIENT_ID,
  user_id: USER_ID,
  user_pass: USER_PASS,
};

// Validate credentials on import
if (!CLIENT_ID || !USER_ID || !USER_PASS) {
  console.error('[ChronoTrack] Missing required credentials (VITE_CHRONOTRACK_CLIENT_ID, VITE_CHRONOTRACK_USER, VITE_CHRONOTRACK_PASS)');
}

// Fetch ALL events in one call (size=600 is the documented max)
export const fetchEvents = async () => {
  if (!AUTH_PARAMS.client_id) throw new Error('Missing ChronoTrack credentials');

  try {
    const response = await axios.get(`${CHRONOTRACK_API}/event`, {
      params: {
        ...AUTH_PARAMS,
        format: 'json',
        size: 600, // Max allowed
      },
      timeout: 30000,
    });

    const data = response.data;
    if (!data || !data.events) {
      console.warn('[ChronoTrack] No events returned');
      return [];
    }

    console.log(`[ChronoTrack] Fetched ${data.events.length} events`);
    return data.events;
  } catch (err) {
    console.error('[ChronoTrack] fetchEvents failed:', err.response?.data || err.message);
    throw err;
  }
};

// Fetch races for a specific event
export const fetchRacesForEvent = async (eventId) => {
  if (!AUTH_PARAMS.client_id) throw new Error('Missing ChronoTrack credentials');

  try {
    const response = await axios.get(`${CHRONOTRACK_API}/event/${eventId}/races`, {
      params: {
        ...AUTH_PARAMS,
        format: 'json',
      },
      timeout: 20000,
    });

    const data = response.data;
    if (!data || !data.races) {
      console.warn(`[ChronoTrack] No races for event ${eventId}`);
      return [];
    }

    console.log(`[ChronoTrack] Fetched ${data.races.length} races for event ${eventId}`);
    return data.races;
  } catch (err) {
    console.error(`[ChronoTrack] fetchRacesForEvent ${eventId} failed:`, err.response?.data || err.message);
    throw err;
  }
};

// Helper: Fetch all results from a single bracket with full pagination (max 1000 per page)
const fetchAllBracketResults = async (bracketId) => {
  if (!AUTH_PARAMS.client_id) throw new Error('Missing ChronoTrack credentials');

  let page = 1;
  const pageSize = 1000;
  let allResults = [];

  while (true) {
    try {
      const response = await axios.get(`${CHRONOTRACK_API}/bracket/${bracketId}/results`, {
        params: {
          ...AUTH_PARAMS,
          format: 'json',
          page,
          size: pageSize,
        },
        timeout: 30000,
      });

      const data = response.data;
      if (!data || !data.results || data.results.length === 0) {
        break; // No more data
      }

      allResults = allResults.concat(data.results);
      console.log(`[ChronoTrack] Bracket ${bracketId} — page ${page}: ${data.results.length} results (total: ${allResults.length})`);

      if (data.results.length < pageSize) break; // Last page
      page++;
    } catch (err) {
      console.error(`[ChronoTrack] Bracket ${bracketId} page ${page} failed:`, err.response?.data || err.message);
      break; // Stop on error
    }
  }

  return allResults;
};

// Main: Fetch complete results for an entire event (all brackets)
export const fetchResultsForEvent = async (eventId) => {
  if (!eventId) throw new Error('eventId required');

  try {
    // First get all brackets/races for the event
    const races = await fetchRacesForEvent(eventId);
    if (races.length === 0) {
      console.log(`[ChronoTrack] No races found for event ${eventId}`);
      return [];
    }

    // Collect all bracket IDs
    const bracketIds = races
      .filter(race => race.brackets && race.brackets.length > 0)
      .flatMap(race => race.brackets.map(b => b.bracket_id))
      .filter(id => id);

    if (bracketIds.length === 0) {
      console.log(`[ChronoTrack] No brackets found for event ${eventId}`);
      return [];
    }

    console.log(`[ChronoTrack] Fetching results for ${bracketIds.length} brackets in event ${eventId}`);

    // Fetch results from all brackets in parallel (with concurrency limit to avoid overwhelming)
    const batchSize = 5;
    const allBracketResults = [];

    for (let i = 0; i < bracketIds.length; i += batchSize) {
      const batch = bracketIds.slice(i, i + batchSize);
      const batchPromises = batch.map(id => fetchAllBracketResults(id));
      const batchResults = await Promise.all(batchPromises);
      batchResults.forEach(results => allBracketResults.push(...results));
    }

    // Deduplicate by entry_id (some participants appear in multiple brackets)
    const seen = new Set();
    const deduped = allBracketResults.filter(r => {
      if (!r.results_entry_id) return true;
      if (seen.has(r.results_entry_id)) return false;
      seen.add(r.results_entry_id);
      return true;
    });

    // Build lookup tables for gender and division places
    const genderPlaces = {};
    const divisionPlaces = {};

    deduped.forEach(r => {
      const genderKey = `${r.results_race_id}-${r.results_sex}`;
      if (r.results_gender_rank) {
        genderPlaces[genderKey + '-' + r.results_entry_id] = parseInt(r.results_gender_rank, 10);
      }

      if (r.results_primary_bracket_id && r.results_bracket_rank) {
        const divKey = `${r.results_race_id}-${r.results_primary_bracket_id}`;
        const info = divisionPlaces[divKey + '-' + r.results_entry_id];
        if (!info || parseInt(r.results_bracket_rank, 10) < info.place) {
          divisionPlaces[divKey + '-' + r.results_entry_id] = {
            name: r.results_primary_bracket_name || '',
            place: parseInt(r.results_bracket_rank, 10),
          };
        }
      }
    });

    // Final mapping with hometown parsing and splits
    const mappedResults = deduped.map(r => {
      const lookupKey = r.results_entry_id ? `${r.results_race_id}-${r.results_sex}-${r.results_entry_id}` : null;
      const divLookupKey = r.results_entry_id ? `${r.results_race_id}-${r.results_primary_bracket_id}-${r.results_entry_id}` : null;
      const divInfo = divLookupKey ? divisionPlaces[divLookupKey] : null;

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
        gender_place: lookupKey ? genderPlaces[lookupKey] || null : null,
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
    console.error(`[ChronoTrack] fetchResultsForEvent ${eventId} failed:`, err);
    throw err;
  }
};