// src/api/chronotrackapi.jsx (FINAL — Restored bracket fetching for ALL races)

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
  return (response.data.event_race || []).map(race => ({
    race_id: race.race_id,
    race_name: race.race_name || `Race ${race.race_id}`,
  }));
};

export const fetchResultsForEvent = async (eventId) => {
  const authHeader = await getAuthHeader();

  // Fetch main results with full pagination
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

  // Fetch all brackets
  let brackets = [];
  try {
    const bracketRes = await axios.get(`${baseUrl}/api/event/${eventId}/bracket`, {
      headers: { Authorization: authHeader },
      params: { client_id: import.meta.env.VITE_CHRONOTRACK_CLIENT_ID },
    });
    brackets = bracketRes.data.event_bracket || [];
    console.log(`[ChronoTrack] Found ${brackets.length} total brackets (across all races)`);
  } catch (err) {
    console.warn('[ChronoTrack] Could not fetch brackets', err);
  }

  // Build map: entry_id → age group place
  const bracketPlaces = {};

  for (const bracket of brackets) {
    if (bracket.bracket_type !== 'AGE') continue;

    const raceId = bracket.race_id || bracket.bracket_race_id || 'unknown';
    const bracketName = bracket.bracket_name || 'Unnamed';

    console.log(`[ChronoTrack] Processing AGE bracket ${bracket.bracket_id} (race_id: ${raceId}) - "${bracketName}"`);

    try {
      const res = await axios.get(`${baseUrl}/api/bracket/${bracket.bracket_id}/results`, {
        headers: { Authorization: authHeader },
        params: { client_id: import.meta.env.VITE_CHRONOTRACK_CLIENT_ID },
      });

      const bracketResults = res.data.bracket_results || [];
      console.log(`[ChronoTrack] Bracket ${bracket.bracket_id} returned ${bracketResults.length} ranked results`);

      bracketResults.forEach(r => {
        const entryId = r.results_entry_id;
        if (entryId) {
          bracketPlaces[entryId] = r.results_rank ? parseInt(r.results_rank, 10) : null;
        }
      });
    } catch (err) {
      console.warn(`[ChronoTrack] Failed bracket ${bracket.bracket_id} (race_id: ${raceId})`, err.response?.status || err.message);
    }
  }

  // Map final results with correct age group places
  return allResults.map(r => {
    const entryId = r.results_entry_id;
    const ageGroupPlace = entryId ? bracketPlaces[entryId] : null;

    return {
      first_name: r.results_first_name || '',
      last_name: r.results_last_name || '',
      chip_time: r.results_time || '',
      clock_time: r.results_gun_time || '',
      place: r.results_rank ? parseInt(r.results_rank, 10) : null,
      gender_place: null, // Will be calculated in frontend if needed
      age_group_name: r.results_primary_bracket_name || '',
      age_group_place: ageGroupPlace,
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