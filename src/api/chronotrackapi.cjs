/**
 * CHRONOTRACK API INTEGRATION — FINAL (December 2025)
 *
 * LATEST FIXES:
 * - Gender place now correctly tied to the athlete's specific race
 *   (prevents overwrite from other races' Female/Male brackets)
 * - Uses 'max' parameter (official ChronoTrack alias for unlimited rows)
 *   to bypass 50/1000 caps on bracket results where possible
 * - Prioritizes race-specific gender brackets and avoids overwrites
 * - Excludes "Overall" mixed brackets from gender place
 * - Full support for Male, Female, Non-Binary, X, custom genders
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

  // 1. Fetch main overall results (paginated)
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

  // 2. Fetch all brackets (size=500)
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

    const isGender =
      (bracket.bracket_type === 'SEX' || bracket.bracket_type === 'GENDER') ||
      (/male|female|non.?binary|nb|x/i.test(bracket.bracket_name || '')) &&
      !/overall/i.test(bracket.bracket_name || '');

    if (isAge) ageBrackets.push(bracket);
    else if (isGender) genderBrackets.push(bracket);
  });

  console.log(`[ChronoTrack] ${ageBrackets.length} AGE brackets | ${genderBrackets.length} GENDER brackets`);

  // 4. Fetch AGE group places — use 'max' for unlimited
  const ageGroupPlaces = {};

  for (const bracket of ageBrackets) {
    const name = bracket.bracket_name || 'Unnamed';
    try {
      const res = await axios.get(`${baseUrl}/api/bracket/${bracket.bracket_id}/results`, {
        headers: { Authorization: authHeader },
        params: {
          client_id: import.meta.env.VITE_CHRONOTRACK_CLIENT_ID,
          max: 50000, // Official alias for unlimited rows
        },
      });

      const results = res.data.bracket_results || [];
      console.log(`[ChronoTrack] AGE "${name}" (${bracket.bracket_id}): ${results.length} ranked`);

      results.forEach(r => {
        const entryId = r.results_entry_id;
        if (entryId && r.results_rank) {
          ageGroupPlaces[entryId] = parseInt(r.results_rank, 10);
        }
      });
    } catch (err) {
      console.warn(`[ChronoTrack] Failed AGE "${name}" (${bracket.bracket_id})`, err);
    }
  }

  // 5. Fetch GENDER places — race-specific + prioritize primary + use 'max'
  const genderPlaces = {};

  // Prioritize race-specific brackets (those with race_id)
  genderBrackets.sort((a, b) => {
    const aHasRace = !!(a.race_id || a.bracket_race_id);
    const bHasRace = !!(b.race_id || b.bracket_race_id);
    return bHasRace - aHasRace; // race-specific first
  });

  for (const bracket of genderBrackets) {
    const name = bracket.bracket_name || 'Unnamed';
    const bracketRaceId = bracket.race_id || bracket.bracket_race_id || null;

    try {
      const res = await axios.get(`${baseUrl}/api/bracket/${bracket.bracket_id}/results`, {
        headers: { Authorization: authHeader },
        params: {
          client_id: import.meta.env.VITE_CHRONOTRACK_CLIENT_ID,
          max: 50000, // Use 'max' to request all rows (bypasses default 50 or 1000 caps where possible)
        },
      });

      const results = res.data.bracket_results || [];
      console.log(`[ChronoTrack] GENDER "${name}" (${bracket.bracket_id}) race ${bracketRaceId || 'event-wide'}: ${results.length} ranked`);

      results.forEach(r => {
        const entryId = r.results_entry_id;
        const athleteRaceId = r.results_race_id;

        if (entryId && r.results_rank) {
          // Only set if not already set (prioritizes first/race-specific bracket)
          if (!genderPlaces[entryId]) {
            if (!bracketRaceId || athleteRaceId === bracketRaceId) {
              genderPlaces[entryId] = parseInt(r.results_rank, 10);
            }
          }
        }
      });
    } catch (err) {
      console.warn(`[ChronoTrack] Failed GENDER "${name}" (${bracket.bracket_id})`, err);
    }
  }

  // 6. Map final results with accurate official places
  return allResults.map(r => {
    const entryId = r.results_entry_id;

    return {
      first_name: r.results_first_name || '',
      last_name: r.results_last_name || '',
      chip_time: r.results_time || '',
      clock_time: r.results_gun_time || '',
      place: r.results_rank ? parseInt(r.results_rank, 10) : null,
      gender_place: entryId ? genderPlaces[entryId] || null : null,
      age_group_name: r.results_primary_bracket_name || '',
      age_group_place: entryId ? ageGroupPlaces[entryId] || null : null,
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