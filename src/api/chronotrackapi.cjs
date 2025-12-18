/**
 * CHRONOTRACK API INTEGRATION — FINAL (Dec 2025)
 *
 * NEW FEATURES:
 * - Accurate Gender Place sourced directly from ChronoTrack SEX brackets
 *   (Male, Female, Non-Binary, X, or any custom gender bracket)
 * - Continues to fetch Age Group Place from AGE brackets (unchanged)
 * - Handles all gender identities automatically and inclusively
 * - No more client-side gender place calculation needed
 * - Full logging for debugging bracket distribution
 */

import axios from 'axios';

const baseUrl = '/chrono-api';
let accessToken = null;
let tokenExpiration = 0;

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
    const response = await axios.get(`${baseUrl}/oauth2/token`, {
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

export const fetchEvents = async () => {
  const authHeader = await getAuthHeader();
  const response = await axios.get(`${baseUrl}/api/event`, {
    headers: { Authorization: authHeader },
    params: { client_id: import.meta.env.VITE_CHRONOTRACK_CLIENT_ID },
  });

  return (response.data.event || []).map(event => ({
    id: event.event_id,
    name: event.event_name,
    date: new Date(event.event_start_time * 1000).toISOString().split('T')[0],
  }));
};

export const fetchRacesForEvent = async (eventId) => {
  const authHeader = await getAuthHeader();
  const response = await axios.get(`${baseUrl}/api/event/${eventId}/race`, {
    headers: { Authorization: authHeader },
    params: { client_id: import.meta.env.VITE_CHRONOTRACK_CLIENT_ID },
  });

  const races = (response.data.event_race || []).map(race => ({
    race_id: race.race_id,
    race_name: race.race_name || `Race ${race.race_id}`,
  }));

  console.log(`[ChronoTrack] Event ${eventId} has ${races.length} races:`);
  races.forEach(race => {
    console.log(`[ChronoTrack] → Race ID: ${race.race_id} | Name: ${race.race_name}`);
  });

  return races;
};

export const fetchResultsForEvent = async (eventId) => {
  const authHeader = await getAuthHeader();

  // === 1. Fetch main overall results (paginated) ===
  let allResults = [];
  let page = 1;
  const perPage = 50;
  let fetched = [];

  console.log(`[ChronoTrack] Fetching ALL results for event ${eventId}`);

  do {
    const response = await axios.get(`${baseUrl}/api/event/${eventId}/results`, {
      headers: { Authorization: authHeader },
      params: {
        client_id: import.meta.env.VITE_CHRONOTRACK_CLIENT_ID,
        page,
        results_per_page: perPage,
      },
    });

    fetched = response.data.event_results || [];
    allResults = [...allResults, ...fetched];
    console.log(`[ChronoTrack] Page ${page}: ${fetched.length} results → Total: ${allResults.length}`);
    page++;
  } while (fetched.length === perPage);

  console.log(`[ChronoTrack] Finished — ${allResults.length} total finishers`);

  // === 2. Fetch ALL brackets (with size=500 to get everything) ===
  let brackets = [];
  try {
    const bracketRes = await axios.get(`${baseUrl}/api/event/${eventId}/bracket`, {
      headers: { Authorization: authHeader },
      params: {
        client_id: import.meta.env.VITE_CHRONOTRACK_CLIENT_ID,
        size: 500,
      },
    });
    brackets = bracketRes.data.event_bracket || [];
    console.log(`[ChronoTrack] Found ${brackets.length} total brackets (size=500)`);
  } catch (err) {
    console.warn('[ChronoTrack] Could not fetch brackets', err.response?.data || err.message);
  }

  // === 3. Separate AGE and GENDER (SEX) brackets ===
  const ageBrackets = [];
  const genderBrackets = [];

  brackets.forEach(bracket => {
    if (!bracket.bracket_wants_leaderboard || bracket.bracket_wants_leaderboard !== '1') return;

    const isAgeBracket = bracket.bracket_type === 'AGE';
    const isGenderBracket =
      bracket.bracket_type === 'SEX' ||
      bracket.bracket_type === 'GENDER' ||
      /male|female|non.?binary|nb|x|overall/i.test(bracket.bracket_name || '');

    if (isAgeBracket) {
      ageBrackets.push(bracket);
    } else if (isGenderBracket) {
      genderBrackets.push(bracket);
    }
  });

  console.log(`[ChronoTrack] Identified ${ageBrackets.length} AGE brackets and ${genderBrackets.length} GENDER brackets`);

  // === 4. Fetch AGE group places ===
  const ageGroupPlaces = {}; // entry_id → age_group_place

  for (const bracket of ageBrackets) {
    const bracketName = bracket.bracket_name || 'Unnamed';
    try {
      const res = await axios.get(`${baseUrl}/api/bracket/${bracket.bracket_id}/results`, {
        headers: { Authorization: authHeader },
        params: { client_id: import.meta.env.VITE_CHRONOTRACK_CLIENT_ID },
      });

      const bracketResults = res.data.bracket_results || [];
      console.log(`[ChronoTrack] AGE bracket "${bracketName}" (${bracket.bracket_id}): ${bracketResults.length} ranked`);

      bracketResults.forEach(r => {
        const entryId = r.results_entry_id;
        if (entryId && r.results_rank) {
          ageGroupPlaces[entryId] = parseInt(r.results_rank, 10);
        }
      });
    } catch (err) {
      console.warn(`[ChronoTrack] Failed AGE bracket ${bracket.bracket_id} ("${bracketName}")`, err.response?.status || err.message);
    }
  }

  // === 5. Fetch GENDER places (Male, Female, Non-Binary, etc.) ===
  const genderPlaces = {}; // entry_id → gender_place

  for (const bracket of genderBrackets) {
    const bracketName = bracket.bracket_name || 'Unnamed';
    try {
      const res = await axios.get(`${baseUrl}/api/bracket/${bracket.bracket_id}/results`, {
        headers: { Authorization: authHeader },
        params: { client_id: import.meta.env.VITE_CHRONOTRACK_CLIENT_ID },
      });

      const bracketResults = res.data.bracket_results || [];
      console.log(`[ChronoTrack] GENDER bracket "${bracketName}" (${bracket.bracket_id}): ${bracketResults.length} ranked`);

      bracketResults.forEach(r => {
        const entryId = r.results_entry_id;
        if (entryId && r.results_rank) {
          genderPlaces[entryId] = parseInt(r.results_rank, 10);
        }
      });
    } catch (err) {
      console.warn(`[ChronoTrack] Failed GENDER bracket ${bracket.bracket_id} ("${bracketName}")`, err.response?.status || err.message);
    }
  }

  // === 6. Map final results with official places ===
  return allResults.map(r => {
    const entryId = r.results_entry_id;

    return {
      first_name: r.results_first_name || '',
      last_name: r.results_last_name || '',
      chip_time: r.results_time || '',
      clock_time: r.results_gun_time || '',
      place: r.results_rank ? parseInt(r.results_rank, 10) : null,
      gender_place: entryId ? genderPlaces[entryId] || null : null, // Official from ChronoTrack
      age_group_name: r.results_primary_bracket_name || '',
      age_group_place: entryId ? ageGroupPlaces[entryId] || null : null, // Official from ChronoTrack
      pace: r.results_pace || '',
      age: r.results_age ? parseInt(r.results_age, 10) : null,
      gender: r.results_sex || '',
      bib: r.results_bib || '',
      race_id: r.results_race_id || null,
      race_name: r.results_race_name || '',
      city: r.results_city || '',
      state: r.results_state || '',
      country: r.results_country || r.country || '',
      entry_id: entryId || null,
    };
  });
};