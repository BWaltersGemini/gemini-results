// src/api/chronotrackapi.js
// FINAL WORKING VERSION — Matches the last known working version exactly
// Uses direct param auth for events + proxy + Bearer token for races/results
// Fixes 404 by using correct endpoint paths (/race instead of /races)

import axios from 'axios';

// Direct ChronoTrack API
const CHRONOTRACK_API = 'https://api.chronotrack.com/api';

// Proxy endpoint (must be deployed at /api/chrono-api on Vercel)
const PROXY_BASE = '/chrono-api';

let accessToken = null;
let tokenExpiration = 0;

// Token acquisition via proxy (bypasses CORS on oauth2/token)
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
    console.log('[ChronoTrack] Token acquired successfully');
    return access_token;
  } catch (err) {
    console.error('[ChronoTrack] Token fetch failed:', err.response?.data || err.message);
    throw new Error('Authentication failed');
  }
};

const getAuthHeader = async () => {
  if (!accessToken || Date.now() >= tokenExpiration) {
    await fetchAccessToken();
  }
  return `Bearer ${accessToken}`;
};

// EVENTS: Direct parameter auth (no CORS, proven working)
export const fetchEvents = async () => {
  const clientId = import.meta.env.VITE_CHRONOTRACK_CLIENT_ID;
  const userId = import.meta.env.VITE_CHRONOTRACK_USER;
  const userPass = import.meta.env.VITE_CHRONOTRACK_PASS;

  if (!clientId || !userId || !userPass) {
    throw new Error('Missing ChronoTrack direct API credentials');
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

    const events = response.data.event || [];
    console.log(`[ChronoTrack Direct] Fetched ${events.length} events in one call`);
    return events.map(event => ({
      id: event.event_id,
      name: event.event_name,
      start_time: event.event_start_time ? parseInt(event.event_start_time, 10) : null,
    }));
  } catch (err) {
    console.error('[ChronoTrack Direct] Failed to fetch events:', err.response?.data || err.message);
    throw err;
  }
};

// RACES: Via proxy + correct endpoint (/race, not /races)
export const fetchRacesForEvent = async (eventId) => {
  const authHeader = await getAuthHeader();
  const response = await axios.get(`${PROXY_BASE}/api/event/${eventId}/race`, {
    headers: { Authorization: authHeader },
    params: { client_id: import.meta.env.VITE_CHRONOTRACK_CLIENT_ID },
  });
  return (response.data.event_race || []).map(race => ({
    race_id: race.race_id,
    race_name: race.race_name,
    distance: race.race_distance,
    distance_unit: race.race_distance_unit,
  }));
};

// Helper: fetch all results from a bracket (paginated)
const fetchAllBracketResults = async (bracketId, bracketName, raceName) => {
  let allResults = [];
  let page = 1;
  const pageSize = 1000;

  while (true) {
    try {
      const res = await axios.get(`${PROXY_BASE}/api/bracket/${bracketId}/results`, {
        headers: { Authorization: await getAuthHeader() },
        params: {
          client_id: import.meta.env.VITE_CHRONOTRACK_CLIENT_ID,
          page,
          size: pageSize,
        },
        timeout: 30000,
      });

      const results = res.data.bracket_results || [];
      if (results.length === 0) break;

      allResults = [...allResults, ...results];
      console.log(`[ChronoTrack] ${bracketName} (page ${page}) → +${results.length} (total: ${allResults.length}) from ${raceName}`);

      if (results.length < pageSize) break;
      page++;
    } catch (err) {
      console.warn(`[ChronoTrack] Failed page ${page} for bracket "${bracketName}" in ${raceName}`, err.message || err);
      break;
    }
  }
  return allResults;
};

// RESULTS: Full logic from your last working version
export const fetchResultsForEvent = async (eventId) => {
  const authHeader = await getAuthHeader();

  // Fetch races for logging
  let races = [];
  try {
    const racesResponse = await axios.get(`${PROXY_BASE}/api/event/${eventId}/race`, {
      headers: { Authorization: authHeader },
      params: { client_id: import.meta.env.VITE_CHRONOTRACK_CLIENT_ID },
    });
    races = (racesResponse.data.event_race || []).map(race => ({
      race_id: race.race_id,
      race_name: race.race_name,
      distance: race.race_distance,
      distance_unit: race.race_distance_unit,
    }));
    console.log(`[ChronoTrack] Event ${eventId} has ${races.length} races:`);
    races.forEach(race => {
      console.log(` - Race ID: ${race.race_id} | Name: ${race.race_name} | Distance: ${race.distance}${race.distance_unit || ''}`);
    });
  } catch (err) {
    console.warn('[ChronoTrack] Failed to fetch races for event', eventId, err);
  }

  // Fetch all brackets
  let allBrackets = [];
  try {
    const bracketsResponse = await axios.get(`${PROXY_BASE}/api/event/${eventId}/bracket`, {
      headers: { Authorization: authHeader },
      params: {
        client_id: import.meta.env.VITE_CHRONOTRACK_CLIENT_ID,
        size: 500,
      },
    });
    allBrackets = bracketsResponse.data.event_bracket || [];
    console.log(`[ChronoTrack] Found ${allBrackets.length} total brackets`);
  } catch (err) {
    console.error('[ChronoTrack] Failed to fetch brackets for event', eventId, err);
    throw err;
  }

  // Filter brackets
  const divisionBrackets = allBrackets.filter(b =>
    b.bracket_wants_leaderboard === '1' && ['AGE', 'OTHER'].includes(b.bracket_type)
  );
  const genderBrackets = allBrackets.filter(b =>
    b.bracket_wants_leaderboard === '1' &&
    b.bracket_type === 'SEX' &&
    /^(Male|Female)$/i.test(b.bracket_name?.trim() || '')
  );
  const overallBrackets = allBrackets.filter(b => {
    const name = (b.bracket_name || '').toLowerCase();
    return b.bracket_wants_leaderboard === '1' && (name.includes('overall') || name.includes('all participants'));
  });

  console.log(`[ChronoTrack] Processing ${genderBrackets.length} gender brackets`);
  console.log(`[ChronoTrack] Processing ${divisionBrackets.length} division brackets`);
  console.log(`[ChronoTrack] Processing ${overallBrackets.length} overall brackets`);

  // Fetch overall results (main list)
  let allResults = [];
  let page = 1;
  const maxPages = 40;
  try {
    while (page <= maxPages) {
      const res = await axios.get(`${PROXY_BASE}/api/event/${eventId}/results`, {
        headers: { Authorization: authHeader },
        params: {
          client_id: import.meta.env.VITE_CHRONOTRACK_CLIENT_ID,
          page,
          size: 500,
        },
      });
      const results = res.data.event_results || [];
      if (results.length === 0) break;
      allResults = [...allResults, ...results];
      if (results.length < 500) break;
      page++;
    }
    console.log(`[ChronoTrack] Fetched ${allResults.length} overall results for event ${eventId}`);
  } catch (err) {
    console.error('[ChronoTrack] Failed to fetch overall results', err);
    throw err;
  }

  const getLookupKey = (r) => {
    const entryId = r.results_entry_id || r.entry_id;
    const bib = r.results_bib || r.bib;
    if (entryId) return `entry_${entryId}`;
    if (bib) return `bib_${bib}`;
    return null;
  };

  const genderPlaces = {};
  const divisionPlaces = {};

  // Process gender brackets
  for (const bracket of genderBrackets) {
    const name = (bracket.bracket_name || '').trim() || 'Unnamed Gender';
    const raceId = bracket.race_id || 'unknown';
    const raceName = races.find(r => r.race_id === raceId)?.race_name || 'Unknown Race';
    console.log(`[ChronoTrack] Processing GENDER bracket: "${name}" (Race: ${raceName})`);
    const bracketResults = await fetchAllBracketResults(bracket.bracket_id, `GENDER "${name}"`, raceName);
    console.log(`[ChronoTrack] GENDER "${name}" FINAL: ${bracketResults.length} ranked participants`);
    bracketResults.forEach(r => {
      const key = getLookupKey(r);
      if (key && r.results_rank) {
        genderPlaces[key] = parseInt(r.results_rank, 10);
      }
    });
  }

  // Process division brackets
  for (const bracket of divisionBrackets) {
    const name = (bracket.bracket_name || '').trim();
    if (!name) continue;
    const lowerName = name.toLowerCase();
    const isOverallLike = lowerName.includes('overall') || lowerName.includes('all participants');
    if (isOverallLike) continue;
    const raceId = bracket.race_id || 'unknown';
    const raceName = races.find(r => r.race_id === raceId)?.race_name || 'Unknown Race';
    console.log(`[ChronoTrack] Processing DIVISION bracket: "${name}" (Race: ${raceName})`);
    const bracketResults = await fetchAllBracketResults(bracket.bracket_id, `DIVISION "${name}"`, raceName);
    console.log(`[ChronoTrack] DIVISION "${name}" FINAL: ${bracketResults.length} ranked participants`);
    bracketResults.forEach(r => {
      const key = getLookupKey(r);
      if (key && r.results_rank) {
        const rank = parseInt(r.results_rank, 10);
        divisionPlaces[key] = { name, place: rank };
      }
    });
  }

  // Overall fallback
  for (const bracket of overallBrackets) {
    const name = (bracket.bracket_name || '').trim();
    const raceId = bracket.race_id || 'unknown';
    const raceName = races.find(r => r.race_id === raceId)?.race_name || 'Unknown Race';
    const bracketResults = await fetchAllBracketResults(bracket.bracket_id, `OVERALL "${name}"`, raceName);
    bracketResults.forEach(r => {
      const key = getLookupKey(r);
      if (key && r.results_rank) {
        const rank = parseInt(r.results_rank, 10);
        if (!divisionPlaces[key]) {
          divisionPlaces[key] = { name: 'Overall', place: rank };
        }
      }
    });
  }

  // Final mapping
  const mappedResults = allResults.map(r => {
    const lookupKey = getLookupKey(r);
    const divInfo = lookupKey ? divisionPlaces[lookupKey] : null;

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

  console.log(`[ChronoTrack] Final: ${mappedResults.length} results | ` +
    `${Object.keys(genderPlaces).length} gender places | ` +
    `${Object.keys(divisionPlaces).length} division places`);

  return mappedResults;
};