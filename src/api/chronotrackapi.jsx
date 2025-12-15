// src/api/chronotrackapi.jsx (COMPLETE FINAL — Per-race bracket fetching for accurate age group place)
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

  // Step 1: Fetch main overall results
  let allResults = [];
  let page = 1;
  const perPage = 50;
  let fetched = [];

  console.log(`[ChronoTrack] Fetching overall results for event ${eventId}`);

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

  console.log(`[ChronoTrack] Finished fetching overall — ${allResults.length} total finishers`);

  // Step 2: Group results by race_id
  const resultsByRace = {};
  allResults.forEach(r => {
    const raceId = r.results_race_id || 'overall';
    if (!resultsByRace[raceId]) resultsByRace[raceId] = [];
    resultsByRace[raceId].push(r);
  });

  // Step 3: Fetch brackets and bracket results per race
  const enrichedResults = [];

  for (const raceId in resultsByRace) {
    const raceResults = resultsByRace[raceId];

    let brackets = [];
    try {
      const bracketRes = await axios.get(`${baseUrl}/api/event/${eventId}/bracket`, {
        headers: { Authorization: authHeader },
        params: { client_id: import.meta.env.VITE_CHRONOTRACK_CLIENT_ID },
      });
      brackets = (bracketRes.data.event_bracket || []).filter(b => 
        (b.race_id === raceId || b.race_id == null) && 
        b.bracket_wants_leaderboard === '1'
      );
      console.log(`[ChronoTrack] Race ${raceId}: Found ${brackets.length} brackets`);
    } catch (err) {
      console.warn(`[ChronoTrack] Could not fetch brackets for race ${raceId}`, err);
    }

    const bracketPlaces = {}; // bib → { age_group_place }
    for (const bracket of brackets) {
      try {
        const res = await axios.get(`${baseUrl}/api/bracket/${bracket.bracket_id}/results`, {
          headers: { Authorization: authHeader },
          params: { client_id: import.meta.env.VITE_CHRONOTRACK_CLIENT_ID },
        });

        const bracketResults = res.data.bracket_results || [];
        bracketResults.forEach(r => {
          const bib = r.results_bib;
          if (!bracketPlaces[bib]) bracketPlaces[bib] = {};

          if (bracket.bracket_type === 'AGE') {
            bracketPlaces[bib].age_group_place = r.results_rank ? parseInt(r.results_rank, 10) : null;
          }
        });
      } catch (err) {
        console.warn(`[ChronoTrack] Failed to fetch bracket ${bracket.bracket_id} for race ${raceId}`, err);
      }
    }

    // Map and enrich this race's results
    raceResults.forEach(r => {
      const bib = r.results_bib;
      const places = bracketPlaces[bib] || {};

      const rawSplits = r.splits || r.interval_results || r.results_splits || [];
      const splits = Array.isArray(rawSplits)
        ? rawSplits.map(split => ({
            name: split.interval_name || split.split_name || 'Split',
            distance: split.interval_distance || null,
            time: split.interval_time || split.split_time || null,
            pace: split.interval_pace || split.split_pace || null,
            place: split.interval_place || split.split_place || null,
          }))
        : [];

      enrichedResults.push({
        first_name: r.results_first_name || '',
        last_name: r.results_last_name || '',
        chip_time: r.results_time || '',
        clock_time: r.results_gun_time || '',
        place: r.results_rank ? parseInt(r.results_rank, 10) : null,
        gender_place: null, // Calculated client-side in RaceContext
        age_group_name: r.results_primary_bracket_name || '',
        age_group_place: places.age_group_place || null,
        pace: r.results_pace || '',
        age: r.results_age ? parseInt(r.results_age, 10) : null,
        gender: r.results_sex || '',
        bib: r.results_bib || '',
        race_id: r.results_race_id || null,
        race_name: r.results_race_name || '',
        city: r.results_city || '',
        state: r.results_state || '',
        country: r.results_country || r.country || '',
        splits,
      });
    });
  }

  return enrichedResults;
};