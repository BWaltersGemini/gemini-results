// src/api/chronotrackapi.cjs (FINAL COMPLETE — Full Place Calculation for All Races)
const fetch = require('node-fetch');
const NodeCache = require('node-cache');

const tokenCache = new NodeCache({ stdTTL: 3500 }); // Token expires in ~1 hour

const CHRONOTRACK_CLIENT_ID = process.env.CHRONOTRACK_CLIENT_ID;
const CHRONOTRACK_CLIENT_SECRET = process.env.CHRONOTRACK_CLIENT_SECRET;

const getChronoTrackToken = async () => {
  const cached = tokenCache.get('token');
  if (cached) return cached;

  console.log('[ChronoTrack] Acquiring new token...');
  const response = await fetch('https://api.chronotrack.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: CHRONOTRACK_CLIENT_ID,
      client_secret: CHRONOTRACK_CLIENT_SECRET,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Token fetch failed: ${response.status} ${err}`);
  }

  const data = await response.json();
  if (!data.access_token) throw new Error('No access token in response');

  tokenCache.set('token', data.access_token);
  console.log('[ChronoTrack] Token acquired successfully');
  return data.access_token;
};

const fetchPage = async (url, token) => {
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`HTTP ${response.status}: ${err}`);
  }

  return response.json();
};

// Fetch all events (size=600 to get everything in one call)
export const fetchEvents = async () => {
  console.log('[ChronoTrack Direct] Fetching all events in one call');
  const token = await getChronoTrackToken();
  const url = 'https://api.chronotrack.com/api/event?size=600';
  const data = await fetchPage(url, token);

  const events = (data.results || []).map(event => ({
    id: event.event_id,
    name: event.event_name || 'Unnamed Event',
    start_time: event.event_start_date ? Math.floor(new Date(event.event_start_date).getTime() / 1000) : null,
    races: (event.races || []).map(race => ({
      race_id: race.race_id,
      race_name: race.race_name || 'Unknown Race',
      race_tag: race.race_tag || null,
      race_type: race.race_type || null,
      race_subtype: race.race_subtype || null,
      distance: race.race_course_distance || null,
      distance_unit: race.race_pref_distance_unit || 'meters',
      planned_start_time: race.race_planned_start_time ? parseInt(race.race_planned_start_time, 10) : null,
      actual_start_time: race.race_actual_start_time ? parseFloat(race.race_actual_start_time) : null,
    })),
  }));

  console.log('[ChronoTrack Direct] Fetched', events.length, 'events in one call');
  return events;
};

// Fetch races for a specific event
export const fetchRacesForEvent = async (eventId) => {
  const token = await getChronoTrackToken();
  const url = `https://api.chronotrack.com/api/event/${eventId}/race`;
  const data = await fetchPage(url, token);
  return data.results || [];
};

// Fetch ALL results for an event with full pagination and place calculation
export const fetchResultsForEvent = async (eventId) => {
  console.log('[ChronoTrack] Fetching ALL results for event', eventId);
  const token = await getChronoTrackToken();

  let allResults = [];
  let page = 1;
  let total = 0;

  do {
    const url = `https://api.chronotrack.com/api/results/${eventId}?page=${page}&size=50`;
    const data = await fetchPage(url, token);

    const results = data.results || [];
    allResults = [...allResults, ...results];
    total = data.total || results.length;

    console.log(`[ChronoTrack] Page ${page}: ${results.length} → Total: ${allResults.length}`);

    page++;
  } while (allResults.length < total && total > 0);

  console.log('[ChronoTrack] Finished —', allResults.length, 'total finishers');

  // === FULL BRACKET/PLACE CALCULATION FOR ALL RACES ===
  const raceMap = {};
  allResults.forEach(r => {
    const raceId = r.race_id || 'overall';
    if (!raceMap[raceId]) raceMap[raceId] = [];
    raceMap[raceId].push(r);
  });

  console.log('[ChronoTrack] Found', Object.keys(raceMap).length, 'races with results');

  Object.entries(raceMap).forEach(([raceId, participants]) => {
    // Ensure chip_time is string for sorting
    participants.forEach(p => {
      if (p.chip_time === null || p.chip_time === undefined) p.chip_time = '99:99:99.999';
      if (typeof p.chip_time === 'number') p.chip_time = p.chip_time.toFixed(3);
      if (typeof p.chip_time === 'string') p.chip_time = p.chip_time.trim();
    });

    // Sort by chip_time
    participants.sort((a, b) => a.chip_time.localeCompare(b.chip_time));

    // Overall place
    participants.forEach((p, i) => {
      p.place = i + 1;
    });

    // Gender groups
    const genderGroups = {};
    participants.forEach(p => {
      const g = p.gender || 'X';
      if (!genderGroups[g]) genderGroups[g] = [];
      genderGroups[g].push(p);
    });

    Object.values(genderGroups).forEach(group => {
      group.sort((a, b) => a.chip_time.localeCompare(b.chip_time));
      group.forEach((p, i) => {
        p.gender_place = i + 1;
      });
    });

    // Age group (division) groups
    const ageGroups = {};
    participants.forEach(p => {
      const ag = p.age_group_name || 'Unknown';
      if (!ageGroups[ag]) ageGroups[ag] = [];
      ageGroups[ag].push(p);
    });

    Object.entries(ageGroups).forEach(([agName, group]) => {
      group.sort((a, b) => a.chip_time.localeCompare(b.chip_time));
      group.forEach((p, i) => {
        p.age_group_place = i + 1;
        p.age_group_name = agName;
      });
    });

    console.log(`[ChronoTrack] Processed race ${raceId}: ${participants.length} participants — places assigned`);
  });

  return allResults;
};

module.exports = {
  fetchEvents,
  fetchRacesForEvent,
  fetchResultsForEvent,
};