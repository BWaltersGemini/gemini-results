// src/api/chronotrackapi.jsx (FINAL — Stops main loop at first <50 page, full gender places)
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

  // 1. Fetch main results — stop at first page with <50 results
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
    if (fetched.length === 0) {
      console.log(`[ChronoTrack] Empty response at page ${page} — stopping`);
      break;
    }

    allResults = [...allResults, ...fetched];
    console.log(`[ChronoTrack] Page ${page}: ${fetched.length} results → Total: ${allResults.length}`);

    // Stop at the first page with fewer than 50 results — this is the real end
    if (fetched.length < perPage) {
      console.log(`[ChronoTrack] Last real page detected (${fetched.length} < ${perPage}) — finished with ${allResults.length} results`);
      break;
    }

    page++;
  }

  console.log(`[ChronoTrack] Finished — ${allResults.length} total real finishers`);

  // 2. Fetch brackets
  let brackets = [];
  try {
    const bracketRes = await axios.get(`${baseUrl}/api/event/${eventId}/bracket`, {
      headers: { Authorization: authHeader },
      params: { client_id: import.meta.env.VITE_CHRONOTRACK_CLIENT_ID },
    });
    brackets = bracketRes.data.event_bracket || [];
    console.log(`[ChronoTrack] Found ${brackets.length} total brackets`);
  } catch (err) {
    console.warn('[ChronoTrack] Could not fetch brackets', err);
  }

  // 3. Classify brackets
  const ageBrackets = [];
  const genderBrackets = [];

  brackets.forEach(bracket => {
    if (!bracket.bracket_wants_leaderboard || bracket.bracket_wants_leaderboard !== '1') return;

    const isAge = bracket.bracket_type === 'AGE';
    const isPrimaryGender =
      (bracket.bracket_type === 'SEX' || bracket.bracket_type === 'GENDER') &&
      (bracket.race_id || bracket.bracket_race_id) &&
      /^(Female|Male)$/i.test(bracket.bracket_name?.trim());

    if (isAge) ageBrackets.push(bracket);
    else if (isPrimaryGender) genderBrackets.push(bracket);
  });

  console.log(`[ChronoTrack] ${ageBrackets.length} AGE brackets | ${genderBrackets.length} PRIMARY GENDER brackets`);

  // Helper: get key for matching (entry_id preferred, bib fallback)
  const getLookupKey = (r) => r.results_entry_id || r.results_bib || null;

  // 4. Fetch AGE places — simple single request
  const ageGroupPlaces = {};
  for (const bracket of ageBrackets) {
    const name = bracket.bracket_name || 'Unnamed';
    try {
      const res = await axios.get(`${baseUrl}/api/bracket/${bracket.bracket_id}/results`, {
        headers: { Authorization: authHeader },
        params: {
          client_id: import.meta.env.VITE_CHRONOTRACK_CLIENT_ID,
          max: 50000,
        },
      });

      const results = res.data.bracket_results || [];
      console.log(`[ChronoTrack] AGE "${name}": ${results.length} ranked`);

      results.forEach(r => {
        const key = getLookupKey(r);
        if (key && r.results_rank) {
          ageGroupPlaces[key] = parseInt(r.results_rank, 10);
        }
      });
    } catch (err) {
      console.warn(`[ChronoTrack] Failed AGE "${name}"`, err);
    }
  }

  // 5. Fetch GENDER places — safe paginated
  const genderPlaces = {};
  for (const bracket of genderBrackets) {
    const name = bracket.bracket_name || 'Unnamed';
    const bracketRaceId = bracket.race_id || bracket.bracket_race_id || null;

    let allBracketResults = [];
    let page = 1;
    const pageSize = 250;
    const maxPages = 40; // 10,000 max

    try {
      while (page <= maxPages) {
        const res = await axios.get(`${baseUrl}/api/bracket/${bracket.bracket_id}/results`, {
          headers: { Authorization: authHeader },
          params: {
            client_id: import.meta.env.VITE_CHRONOTRACK_CLIENT_ID,
            page,
            size: pageSize,
            bracket: 'SEX',
          },
        });

        const results = res.data.bracket_results || [];
        if (!results || results.length === 0) {
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
      console.warn(`[ChronoTrack] Failed GENDER "${name}"`, err);
    }
  }

  // 6. Final mapping
  return allResults.map(r => {
    const entryId = r.results_entry_id || null;
    const bib = r.results_bib || null;
    const lookupKey = getLookupKey(r);

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
      city: r.results_city || r.results_hometown?.split(',')[0]?.trim() || '',
      state: r.results_state || r.results_state_code || '',
      country: r.results_country || r.results_country_code || '',
      splits,
      entry_id: entryId,
    };
  });
};