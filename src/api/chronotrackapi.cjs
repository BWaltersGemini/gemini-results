// src/api/chronotrackapi.jsx (FINAL — Updated for new schema: races embedded in chronotrack_events)
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

// Fetch all events — now includes embedded races from DB later
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
    // races will be populated from DB in RaceContext
  }));
};

// Fetch races for an event — used to sync into embedded races JSONB
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

// Fetch results — unchanged except better deduplication and field mapping
export const fetchResultsForEvent = async (eventId) => {
  const authHeader = await getAuthHeader();

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

  // Fetch brackets for age/gender places
  let brackets = [];
  try {
    const bracketRes = await axios.get(`${baseUrl}/api/event/${eventId}/bracket`, {
      headers: { Authorization: authHeader },
      params: { client_id: import.meta.env.VITE_CHRONOTRACK_CLIENT_ID },
    });
    brackets = bracketRes.data.event_bracket || [];
  } catch (err) {
    console.warn('[ChronoTrack] Could not fetch brackets', err);
  }

  const ageBrackets = brackets.filter(b => 
    b.bracket_wants_leaderboard === '1' && b.bracket_type === 'AGE'
  );

  const genderBrackets = brackets.filter(b => 
    b.bracket_wants_leaderboard === '1' && 
    ['SEX', 'GENDER'].includes(b.bracket_type) &&
    /^(Female|Male)$/i.test(b.bracket_name?.trim())
  );

  const getLookupKey = (r) => r.results_entry_id || r.results_bib || null;

  const ageGroupPlaces = {};
  for (const bracket of ageBrackets) {
    try {
      const res = await axios.get(`${baseUrl}/api/bracket/${bracket.bracket_id}/results`, {
        headers: { Authorization: authHeader },
        params: { client_id: import.meta.env.VITE_CHRONOTRACK_CLIENT_ID, max: 50000 },
      });
      (res.data.bracket_results || []).forEach(r => {
        const key = getLookupKey(r);
        if (key && r.results_rank) {
          ageGroupPlaces[key] = parseInt(r.results_rank, 10);
        }
      });
    } catch (err) {
      console.warn(`[ChronoTrack] Failed AGE bracket ${bracket.bracket_id}`, err);
    }
  }

  const genderPlaces = {};
  for (const bracket of genderBrackets) {
    try {
      let bracketResults = [];
      let bPage = 1;
      const pageSize = 250;
      while (true) {
        const res = await axios.get(`${baseUrl}/api/bracket/${bracket.bracket_id}/results`, {
          headers: { Authorization: authHeader },
          params: {
            client_id: import.meta.env.VITE_CHRONOTRACK_CLIENT_ID,
            page: bPage,
            size: pageSize,
          },
        });
        const results = res.data.bracket_results || [];
        if (results.length === 0) break;
        bracketResults = [...bracketResults, ...results];
        if (results.length < pageSize) break;
        bPage++;
      }
      bracketResults.forEach(r => {
        const key = getLookupKey(r);
        if (key && r.results_rank) {
          genderPlaces[key] = parseInt(r.results_rank, 10);
        }
      });
    } catch (err) {
      console.warn(`[ChronoTrack] Failed GENDER bracket ${bracket.bracket_id}`, err);
    }
  }

  // Final mapping
  return allResults.map(r => {
    const lookupKey = getLookupKey(r);

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
      city: r.results_city || '',
      state: r.results_state || '',
      country: r.results_country || '',
      splits,
      entry_id: r.results_entry_id || null,
    };
  });
};