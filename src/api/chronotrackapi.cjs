// src/api/chronotrackapi.jsx (FINAL — Fully restored & improved gender_place fetching + hometown parsing)
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
    start_time: event.event_start_time ? parseInt(event.event_start_time, 10) : null,
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
    race_tag: race.race_tag || null,
    race_type: race.race_type || null,
    race_subtype: race.race_subtype || null,
    race_course_distance: race.race_course_distance || null,
    race_pref_distance_unit: race.race_pref_distance_unit || 'meters',
    race_planned_start_time: race.race_planned_start_time || null,
    race_actual_start_time: race.race_actual_start_time || null,
  }));
};

export const fetchResultsForEvent = async (eventId) => {
  const authHeader = await getAuthHeader();

  // 1. Fetch main results with full pagination
  let allResults = [];
  let page = 1;
  const perPage = 50;

  console.log(`[ChronoTrack] Fetching ALL results for event ${eventId}`);

  while (true) {
    const response = await axios.get(`${baseUrl}/api/event/${eventId}/results`, {
      headers: { Authorization: authHeader },
      params: {
        client_id: import.meta.env.VITE_CHRONOTRACK_CLIENT_ID,
        page,
        results_per_page: perPage,
      },
    });

    const fetched = response.data.event_results || [];
    if (fetched.length === 0) break;

    allResults = [...allResults, ...fetched];
    console.log(`[ChronoTrack] Page ${page}: ${fetched.length} → Total: ${allResults.length}`);

    if (fetched.length < perPage) break;
    page++;
  }

  console.log(`[ChronoTrack] Finished — ${allResults.length} total finishers`);

  // 2. Fetch brackets
  let brackets = [];
  try {
    const bracketRes = await axios.get(`${baseUrl}/api/event/${eventId}/bracket`, {
      headers: { Authorization: authHeader },
      params: { client_id: import.meta.env.VITE_CHRONOTRACK_CLIENT_ID },
    });
    brackets = bracketRes.data.event_bracket || [];
    console.log(`[ChronoTrack] Found ${brackets.length} brackets`);
  } catch (err) {
    console.warn('[ChronoTrack] Could not fetch brackets', err);
  }

  // 3. Identify AGE and PRIMARY GENDER brackets
  const ageBrackets = [];
  const genderBrackets = [];

  brackets.forEach(bracket => {
    if (!bracket.bracket_wants_leaderboard || bracket.bracket_wants_leaderboard !== '1') return;

    const isAge = bracket.bracket_type === 'AGE';
    const isPrimaryGender =
      (bracket.bracket_type === 'SEX' || bracket.bracket_type === 'GENDER') &&
      /^(Female|Male)$/i.test(bracket.bracket_name?.trim());

    if (isAge) ageBrackets.push(bracket);
    if (isPrimaryGender) genderBrackets.push(bracket);
  });

  console.log(`[ChronoTrack] ${ageBrackets.length} AGE brackets | ${genderBrackets.length} PRIMARY GENDER brackets`);

  // Helper: get unique key for matching
  const getLookupKey = (r) => r.results_entry_id || r.results_bib || null;

  // 4. Fetch AGE group places
  const ageGroupPlaces = {};
  for (const bracket of ageBrackets) {
    try {
      const res = await axios.get(`${baseUrl}/api/bracket/${bracket.bracket_id}/results`, {
        headers: { Authorization: authHeader },
        params: {
          client_id: import.meta.env.VITE_CHRONOTRACK_CLIENT_ID,
          max: 50000,
        },
      });
      const results = res.data.bracket_results || [];
      results.forEach(r => {
        const key = getLookupKey(r);
        if (key && r.results_rank) {
          ageGroupPlaces[key] = parseInt(r.results_rank, 10);
        }
      });
    } catch (err) {
      console.warn(`[ChronoTrack] Failed to fetch AGE bracket ${bracket.bracket_id}`, err);
    }
  }

  // 5. Fetch GENDER places — fully restored paginated version
  const genderPlaces = {};
  for (const bracket of genderBrackets) {
    const name = bracket.bracket_name?.trim() || 'Unnamed';
    const bracketRaceId = bracket.race_id || bracket.bracket_race_id || null;
    let allBracketResults = [];
    let page = 1;
    const pageSize = 250;
    const maxPages = 40; // safety limit ~10,000 results

    try {
      while (page <= maxPages) {
        const res = await axios.get(`${baseUrl}/api/bracket/${bracket.bracket_id}/results`, {
          headers: { Authorization: authHeader },
          params: {
            client_id: import.meta.env.VITE_CHRONOTRACK_CLIENT_ID,
            page,
            size: pageSize,
            bracket: 'SEX', // some events require this param
          },
        });
        const results = res.data.bracket_results || [];
        if (results.length === 0) {
          console.log(`[ChronoTrack] GENDER "${name}" — no more results at page ${page}`);
          break;
        }
        allBracketResults = [...allBracketResults, ...results];
        console.log(`[ChronoTrack] GENDER "${name}" page ${page}: ${results.length} → Total: ${allBracketResults.length}`);
        page++;
      }
      console.log(`[ChronoTrack] GENDER "${name}" FINAL: ${allBracketResults.length} ranked`);

      allBracketResults.forEach(r => {
        const key = getLookupKey(r);
        if (key && r.results_rank) {
          const athleteRaceId = r.results_race_id;
          if (!bracketRaceId || athleteRaceId === bracketRaceId) {
            genderPlaces[key] = parseInt(r.results_rank, 10);
          }
        }
      });
    } catch (err) {
      console.warn(`[ChronoTrack] Failed to fetch GENDER bracket ${bracket.bracket_id}`, err);
    }
  }

  // 6. Final result mapping with improved city/state/country from hometown
  return allResults.map(r => {
    const lookupKey = getLookupKey(r);

    // Parse hometown if available (e.g., "San Clemente, CA, US")
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
      age_group_name: r.results_primary_bracket_name || '',
      age_group_place: lookupKey ? ageGroupPlaces[lookupKey] || null : null,
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
};