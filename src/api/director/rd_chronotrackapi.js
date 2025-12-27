// src/api/director/rd_chronotrackapi.js
// Enhanced ChronoTrack API client with participant details (email, address, chip start)
import axios from 'axios';

const PROXY_BASE = '/chrono-api';
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
    const response = await axios.get(`${PROXY_BASE}/oauth2/token`, {
      headers: { Authorization: `Basic ${basicAuth}` },
      params: { grant_type: 'password', username, password },
    });

    const { access_token, expires_in } = response.data;
    accessToken = access_token;
    tokenExpiration = Date.now() + (expires_in || 3600) * 1000;
    console.log('[RD ChronoTrack] Token acquired');
    return access_token;
  } catch (err) {
    console.error('[RD ChronoTrack] Token failed:', err.response?.data || err.message);
    throw err;
  }
};

const getAuthHeader = async () => {
  if (!accessToken || Date.now() >= tokenExpiration) {
    await fetchAccessToken();
  }
  return `Bearer ${accessToken}`;
};

/**
 * Fetch detailed participant contact info (email, address, phone, etc.)
 * Returns Map<entry_id, details>
 */
export const fetchParticipantContactDetails = async (eventId, entryIds = []) => {
  if (entryIds.length === 0) return new Map();

  const authHeader = await getAuthHeader();
  const details = new Map();

  const batchSize = 50;
  for (let i = 0; i < entryIds.length; i += batchSize) {
    const batch = entryIds.slice(i, i + batchSize);

    await Promise.all(
      batch.map(async (entryId) => {
        try {
          const res = await axios.get(`${PROXY_BASE}/api/entry/${entryId}`, {
            headers: { Authorization: authHeader },
            params: { client_id: import.meta.env.VITE_CHRONOTRACK_CLIENT_ID },
            timeout: 15000,
          });

          const entry = res.data.entry;
          if (entry) {
            details.set(entryId, {
              email: entry.athlete_email || '',
              street: entry.location_street || '',
              street2: entry.location_street2 || '',
              city: entry.location_city || '',
              state: entry.location_region || '',
              zip: entry.location_postal_code || '',
              country: entry.location_country || '',
              phone: entry.athlete_mobile_phone || entry.athlete_home_phone || '',
              birthdate: entry.athlete_birthdate || '',
            });
          }
        } catch (err) {
          console.warn(`[RD ChronoTrack] Failed entry ${entryId}:`, err.response?.status || err.message);
          details.set(entryId, {
            email: '',
            street: '',
            street2: '',
            city: '',
            state: '',
            zip: '',
            country: '',
            phone: '',
            birthdate: '',
          });
        }
      })
    );
  }

  console.log(`[RD ChronoTrack] Fetched contact details for ${details.size} participants`);
  return details;
};

/**
 * Enhanced live tracking with per-race breakdown
 */
export const fetchLiveTrackingData = async (eventId) => {
  const authHeader = await getAuthHeader();
  let rawResults = [];
  let page = 1;
  const pageSize = 500;
  const maxPages = 40;

  try {
    while (page <= maxPages) {
      const res = await axios.get(`${PROXY_BASE}/api/event/${eventId}/results`, {
        headers: { Authorization: authHeader },
        params: {
          client_id: import.meta.env.VITE_CHRONOTRACK_CLIENT_ID,
          page,
          size: pageSize,
          interval: 'ALL',
        },
        timeout: 20000,
      });

      const results = res.data.event_results || [];
      if (results.length === 0) break;
      rawResults.push(...results);
      if (results.length < pageSize) break;
      page++;
    }
    console.log(`[RD Live] Fetched ${rawResults.length} interval results`);
  } catch (err) {
    console.error('[RD Live] Failed to fetch results:', err);
    throw new Error('Failed to load live tracking data');
  }

  const participantsByEntry = new Map();
  const races = new Map();

  rawResults.forEach((row) => {
    const entryId = row.results_entry_id;
    const raceId = row.results_race_id || 'unknown';
    const raceName = row.results_race_name || `Race ${raceId}`;
    const isFullInterval = row.results_interval_full === '1';
    const hasStart = !!row.results_begin_chip_time;
    const hasFinish = isFullInterval && !!row.results_end_chip_time;

    if (!races.has(raceId)) {
      races.set(raceId, {
        raceId,
        raceName,
        total: 0,
        started: 0,
        finished: 0,
        stillOnCourse: 0,
        splits: new Map(),
      });
    }
    const race = races.get(raceId);

    if (!participantsByEntry.has(entryId)) {
      participantsByEntry.set(entryId, {
        raceId,
        hasStarted: false,
        hasFinished: false,
      });
      race.total++;
    }

    const participant = participantsByEntry.get(entryId);

    if (hasStart && !participant.hasStarted) {
      participant.hasStarted = true;
      race.started++;
      race.stillOnCourse++;
    }
    if (hasFinish && !participant.hasFinished) {
      participant.hasFinished = true;
      race.finished++;
      race.stillOnCourse--;
    }

    if (row.results_interval_name && row.results_end_chip_time) {
      const splitName = row.results_interval_name;
      race.splits.set(splitName, (race.splits.get(splitName) || 0) + 1);
    }
  });

  const raceList = Array.from(races.values()).map((race) => {
    const total = race.total;
    const splitProgress = Array.from(race.splits.entries())
      .map(([name, passed]) => ({
        name,
        passed,
        percentage: total ? Math.round((passed / total) * 100) : 0,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return {
      raceId: race.raceId,
      raceName: race.raceName,
      total,
      started: race.started,
      finished: race.finished,
      stillOnCourse: race.stillOnCourse,
      yetToStart: total - race.started,
      splitProgress,
    };
  });

  const overall = raceList.reduce(
    (acc, race) => ({
      totalParticipants: acc.totalParticipants + race.total,
      started: acc.started + race.started,
      finished: acc.finished + race.finished,
      stillOnCourse: acc.stillOnCourse + race.stillOnCourse,
      yetToStart: acc.yetToStart + race.yetToStart,
    }),
    {
      totalParticipants: 0,
      started: 0,
      finished: 0,
      stillOnCourse: 0,
      yetToStart: 0,
    }
  );

  return {
    overall,
    races: raceList.sort((a, b) => a.raceName.localeCompare(b.raceName)),
    lastUpdated: new Date().toISOString(),
  };
};