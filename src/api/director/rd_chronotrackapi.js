// src/api/director/rd_chronotrackapi.js
// Enhanced version for Race Directors — gets raw timestamps for live tracking

import axios from 'axios';
import { supabase } from '../../supabaseClient';

const PROXY_BASE = '/chrono-api';
const CHRONOTRACK_API = 'https://api.chronotrack.com/api';

let accessToken = null;
let tokenExpiration = 0;

// Reuse same token logic as public API
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

// Fetch raw entry results (includes begin_chip_time, end_chip_time, etc.)
const fetchEntryResults = async (entryId) => {
  const authHeader = await getAuthHeader();
  const response = await axios.get(`${PROXY_BASE}/api/entry/${entryId}/results`, {
    headers: { Authorization: authHeader },
    params: { client_id: import.meta.env.VITE_CHRONOTRACK_CLIENT_ID },
    timeout: 15000,
  });
  return response.data.entry_results?.[0] || null;
};

// Enhanced results fetch for live tracking
export const fetchLiveTrackingData = async (eventId) => {
  const authHeader = await getAuthHeader();

  // 1. Get all interval results (includes splits and full course)
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
      });
      const results = res.data.event_results || [];
      if (results.length === 0) break;
      rawResults.push(...results);
      if (results.length < pageSize) break;
      page++;
    }
  } catch (err) {
    console.error('[RD] Failed to fetch interval results:', err);
    throw err;
  }

  // Group by entry_id and collect timestamps
  const participants = new Map(); // entry_id → data
  const entryIdsNeedingRaw = [];

  rawResults.forEach((row) => {
    const entryId = row.results_entry_id;
    if (!entryId) return;

    if (!participants.has(entryId)) {
      participants.set(entryId, {
        entryId,
        hasStarted: false,
        hasFinished: false,
        splitsPassed: new Set(),
        lastSplitTime: null,
      });
    }

    const p = participants.get(entryId);

    if (row.results_interval_full === '1') {
      p.hasFinished = true;
      p.finishTime = row.results_end_chip_time || row.results_time;
    }

    if (row.results_begin_chip_time) {
      p.hasStarted = true;
      p.startTime = row.results_begin_chip_time;
    }

    if (row.results_interval_name && row.results_end_chip_time) {
      p.splitsPassed.add(row.results_interval_name);
      p.lastSplitTime = row.results_end_chip_time;
    }

    // Collect for raw fetch if needed (fallback or extra precision)
    if (row.results_interval_full === '1' && !p.rawFetched) {
      entryIdsNeedingRaw.push(entryId);
      p.rawFetched = true;
    }
  });

  // Optional: Batch fetch raw entry results for precise timestamps (uncomment when needed)
  // for (const entryId of entryIdsNeedingRaw.slice(0, 50)) { // limit for speed
  //   const raw = await fetchEntryResults(entryId);
  //   if (raw) {
  //     const p = participants.get(entryId);
  //     p.startTime = raw.results_begin_chip_time || p.startTime;
  //     p.finishTime = raw.results_end_chip_time || p.finishTime;
  //   }
  // }

  // Compute counts
  let started = 0;
  let finished = 0;
  let onCourse = 0;

  const splitCounts = {};

  for (const p of participants.values()) {
    if (p.hasStarted) started++;
    if (p.hasFinished) finished++;
    if (p.hasStarted && !p.hasFinished) onCourse++;

    p.splitsPassed.forEach((splitName) => {
      splitCounts[splitName] = (splitCounts[splitName] || 0) + 1;
    });
  }

  // Get split names sorted (you can customize order later)
  const sortedSplits = Object.keys(splitCounts).sort();

  return {
    totalParticipants: participants.size,
    started,
    finished,
    stillOnCourse: onCourse,
    yetToStart: participants.size - started,
    splitProgress: sortedSplits.map((name) => ({
      name,
      passed: splitCounts[name],
      percentage: participants.size ? (splitCounts[name] / participants.size) * 100 : 0,
    })),
    lastUpdated: new Date().toISOString(),
  };
};