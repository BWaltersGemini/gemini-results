// src/api/chronotrackapi.js
// FINAL — Complete Production Version (December 2025)
// • CONF/FIN = official finishers (main ranked results)
// • DNF/DQ = stored with partial data, no rankings (collapsible section)
// • Full splits preserved
// • Safe bracket fetching
// • Batched entry_status calls
// • Stores BOTH finishers and DNFs in Supabase
// • Detects "STARTED" athletes (crossed start mat, no splits/finish yet)
// • STARTED athletes included in nonFinishers for search visibility
// • event_id now correctly added to every participant (fixes Supabase upsert)

import axios from 'axios';
import { supabase } from '../supabaseClient';

const CHRONOTRACK_API = 'https://api.chronotrack.com/api';
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
      event_end_time: event.event_end_time ? parseInt(event.event_end_time, 10) : null,
    }));
  } catch (err) {
    console.error('[ChronoTrack Direct] Failed to fetch events:', err.response?.data || err.message);
    throw err;
  }
};

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

const fetchAllBracketResults = async (bracketId, bracketName, raceName) => {
  let allResults = [];
  let page = 1;
  const pageSize = 1000;
  const maxPages = 50;
  const seenKeys = new Set();

  while (page <= maxPages) {
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

      const newResults = [];
      for (const r of results) {
        const key = r.results_entry_id || r.results_bib;
        if (key && !seenKeys.has(key)) {
          seenKeys.add(key);
          newResults.push(r);
        }
      }

      allResults.push(...newResults);
      console.log(`[ChronoTrack] ${bracketName} (page ${page}) → +${newResults.length} new unique (total: ${allResults.length}) from ${raceName}`);

      if (results.length < pageSize) break;
      if (page >= maxPages) {
        console.warn(`[ChronoTrack] Hit maxPages (${maxPages}) for ${bracketName}`);
        break;
      }
      page++;
    } catch (err) {
      console.warn(`[ChronoTrack] Failed page ${page} for ${bracketName}`, err.message || err);
      break;
    }
  }

  return allResults;
};

const fetchEntryStatusesInBatches = async (entryIds) => {
  if (entryIds.length === 0) return {};

  const statuses = {};
  const batchSize = 50;
  const delayMs = 600;
  let processed = 0;

  for (let i = 0; i < entryIds.length; i += batchSize) {
    const batch = entryIds.slice(i, i + batchSize);
    const batchPromises = batch.map(async (entryId) => {
      try {
        const authHeader = await getAuthHeader();
        const res = await axios.get(`${PROXY_BASE}/api/entry/${entryId}`, {
          headers: { Authorization: authHeader },
          params: { client_id: import.meta.env.VITE_CHRONOTRACK_CLIENT_ID },
          timeout: 15000,
        });
        const status = res.data.entry?.entry_status || 'FIN';
        return { entryId, status };
      } catch (err) {
        if (err.response?.status === 404) {
          return { entryId, status: 'NOT_FOUND' };
        }
        console.warn(`[ChronoTrack] Entry status fetch failed for ${entryId}:`, err.message);
        return { entryId, status: 'FIN' };
      }
    });

    const results = await Promise.all(batchPromises);
    results.forEach(({ entryId, status }) => {
      statuses[entryId] = status;
    });

    processed += results.length;
    console.log(`[ChronoTrack] Entry statuses fetched: ${processed}/${entryIds.length}`);

    if (i + batchSize < entryIds.length) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  return statuses;
};

export const fetchResultsForEvent = async (eventId) => {
  const authHeader = await getAuthHeader();

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
  } catch (err) {
    console.warn('[ChronoTrack] Failed to fetch races', err);
  }

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
  } catch (err) {
    console.error('[ChronoTrack] Failed to fetch brackets', err);
    throw err;
  }

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

  // Fetch intervals
  let rawIntervalResults = [];
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
          interval: 'ALL',
        },
      });

      const results = res.data.event_results || [];
      if (results.length === 0) break;

      rawIntervalResults = [...rawIntervalResults, ...results];

      if (results.length < 500) break;
      page++;
    }
  } catch (err) {
    console.error('[ChronoTrack] Failed to fetch intervals', err);
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

  // Process brackets (unchanged)
  for (const bracket of genderBrackets) {
    const name = (bracket.bracket_name || '').trim() || 'Unnamed Gender';
    const raceId = bracket.race_id || 'unknown';
    const raceName = races.find(r => r.race_id === raceId)?.race_name || 'Unknown Race';
    const bracketResults = await fetchAllBracketResults(bracket.bracket_id, `GENDER "${name}"`, raceName);
    bracketResults.forEach(r => {
      const key = getLookupKey(r);
      if (key && r.results_rank && r.results_interval_full === '1') {
        genderPlaces[key] = parseInt(r.results_rank, 10);
      }
    });
  }

  for (const bracket of divisionBrackets) {
    const name = (bracket.bracket_name || '').trim();
    if (!name) continue;
    const lowerName = name.toLowerCase();
    if (lowerName.includes('overall') || lowerName.includes('all participants')) continue;
    const raceId = bracket.race_id || 'unknown';
    const raceName = races.find(r => r.race_id === raceId)?.race_name || 'Unknown Race';
    const bracketResults = await fetchAllBracketResults(bracket.bracket_id, `DIVISION "${name}"`, raceName);
    bracketResults.forEach(r => {
      const key = getLookupKey(r);
      if (key && r.results_rank && r.results_interval_full === '1') {
        const rank = parseInt(r.results_rank, 10);
        divisionPlaces[key] = { name, place: rank };
      }
    });
  }

  for (const bracket of overallBrackets) {
    const name = (bracket.bracket_name || '').trim();
    const raceId = bracket.race_id || 'unknown';
    const raceName = races.find(r => r.race_id === raceId)?.race_name || 'Unknown Race';
    const bracketResults = await fetchAllBracketResults(bracket.bracket_id, `OVERALL "${name}"`, raceName);
    bracketResults.forEach(r => {
      if (r.results_interval_full !== '1') return;
      const key = getLookupKey(r);
      if (key && r.results_rank) {
        const rank = parseInt(r.results_rank, 10);
        if (!divisionPlaces[key]) {
          divisionPlaces[key] = { name: 'Overall', place: rank };
        }
      }
    });
  }

  // Group by entry_id
  const participantsByEntry = {};
  rawIntervalResults.forEach(row => {
    const entryId = row.results_entry_id;
    if (!entryId) return;
    if (!participantsByEntry[entryId]) {
      participantsByEntry[entryId] = {
        fullCourse: null,
        intervals: [],
      };
    }
    if (row.results_interval_full === '1') {
      participantsByEntry[entryId].fullCourse = row;
    } else {
      const endTime = row.results_end_chip_time ? parseFloat(row.results_end_chip_time) : 0;
      participantsByEntry[entryId].intervals.push({ row, endTime });
    }
  });

  const candidates = Object.values(participantsByEntry).filter(p => p.fullCourse !== null);
  const entryIds = candidates.map(p => p.fullCourse.results_entry_id).filter(Boolean);
  const entryStatuses = await fetchEntryStatusesInBatches(entryIds);

  const finishers = [];
  const nonFinishers = [];

  candidates.forEach(p => {
    const r = p.fullCourse;
    const entryId = r.results_entry_id;
    let status = entryStatuses[entryId] || 'FIN';

    // Detect "Started but no splits/finish yet"
    const hasStarted = r.results_begin_chip_time && parseFloat(r.results_begin_chip_time) > 0;
    const hasFinished = r.results_end_chip_time && parseFloat(r.results_end_chip_time) > 0;
    const hasSplits = p.intervals.length > 0;

    if (hasStarted && !hasFinished && !hasSplits) {
      status = 'STARTED';
    }

    const lookupKey = getLookupKey(r);
    const divInfo = lookupKey ? divisionPlaces[lookupKey] : null;

    let city = r.results_city || null;
    let state = r.results_state || r.results_state_code || null;
    let country = r.results_country || r.results_country_code || null;

    if (r.results_hometown) {
      const parts = r.results_hometown.split(',').map(part => part.trim());
      city = parts[0] || city;
      state = parts[1] || state;
      country = parts[2] || country;
    }

    const orderedIntervals = p.intervals
      .sort((a, b) => a.endTime - b.endTime)
      .map(item => item.row);

    const splits = orderedIntervals.map(row => ({
      name: row.results_interval_name || 'Split',
      time: row.results_time || null,
      pace: row.results_pace || null,
      place: row.results_rank ? parseInt(row.results_rank, 10) : null,
    }));

    const participant = {
      event_id: eventId, // ← FIXED: now included
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
      entry_id: entryId || null,
      _status: status,
    };

    // Include STARTED athletes in nonFinishers for search visibility
    if (['DNF', 'DQ', 'STARTED'].includes(status)) {
      participant.place = null;
      participant.gender_place = null;
      participant.age_group_place = null;

      participant.chip_time = participant.chip_time || '';
      participant.race_name = participant.race_name || 'Unknown Race';

      nonFinishers.push(participant);
    } else {
      finishers.push(participant);
    }
  });

  // Store BOTH in Supabase
  const allToStore = [...finishers, ...nonFinishers];
  if (allToStore.length > 0) {
    const uniqueMap = new Map();
    allToStore.forEach(record => {
      const key = record.entry_id || `${record.event_id}-${record.bib}`;
      uniqueMap.set(key, record);
    });
    const finalToStore = Array.from(uniqueMap.values());

    const { error } = await supabase
      .from('chronotrack_results')
      .upsert(finalToStore, { onConflict: 'event_id,entry_id' });

    if (error) {
      console.error('[ChronoTrack] Upsert failed:', error);
    } else {
      console.log(`[ChronoTrack] Stored ${finishers.length} finishers + ${nonFinishers.length} non-finishers (incl. STARTED) in Supabase`);
    }
  }

  console.log(`[ChronoTrack] Final: ${finishers.length} finishers | ${nonFinishers.length} non-finishers (incl. STARTED)`);
  return { finishers, nonFinishers };
};