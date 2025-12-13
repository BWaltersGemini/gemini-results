// src/api/chronotrackapi.jsx (FINAL WORKING VERSION - December 2025)

import axios from 'axios';

// Proxy base path configured in vercel.json or next.config.js
// /chrono-api/* → https://api.chronotrack.com/*
const baseUrl = '/chrono-api';

let accessToken = null;
let tokenExpiration = 0;

/**
 * Fetch OAuth2 access token using password grant
 * ChronoTrack token endpoint: /oauth2/token (NO /api prefix)
 */
const fetchAccessToken = async () => {
  try {
    const clientId = import.meta.env.VITE_CHRONOTRACK_CLIENT_ID;
    const clientSecret = import.meta.env.VITE_CHRONOTRACK_SECRET;
    const username = import.meta.env.VITE_CHRONOTRACK_USER;
    const password = import.meta.env.VITE_CHRONOTRACK_PASS;

    if (!clientId || !clientSecret || !username || !password) {
      throw new Error('Missing ChronoTrack credentials in environment variables');
    }

    const credentials = btoa(`${clientId}:${clientSecret}`);

    // Correct endpoint: /oauth2/token (outside of /api)
    const response = await axios.get(`${baseUrl}/oauth2/token`, {
      headers: {
        Authorization: `Basic ${credentials}`,
      },
      params: {
        grant_type: 'password',
        username,
        password,
      },
    });

    const { access_token, expires_in } = response.data;

    if (!access_token) {
      throw new Error('No access token returned from ChronoTrack');
    }

    accessToken = access_token;
    tokenExpiration = Date.now() + expires_in * 1000;

    console.log('[ChronoTrack] Token acquired successfully');
    return access_token;
  } catch (err) {
    console.error('[ChronoTrack] Token fetch failed:', err.response?.data || err.message);
    accessToken = null;
    tokenExpiration = 0;
    throw new Error('Could not authenticate with ChronoTrack API.');
  }
};

/**
 * Get valid Bearer token (refresh if expired)
 */
const getAuthHeader = async () => {
  if (!accessToken || Date.now() >= tokenExpiration) {
    await fetchAccessToken();
  }
  return `Bearer ${accessToken}`;
};

/**
 * Fetch all events visible to the account
 */
export const fetchEvents = async () => {
  try {
    const authHeader = await getAuthHeader();

    const response = await axios.get(`${baseUrl}/api/event`, {
      headers: { Authorization: authHeader },
      params: {
        client_id: import.meta.env.VITE_CHRONOTRACK_CLIENT_ID,
      },
    });

    const events = response.data.event || [];

    return events.map((event) => ({
      id: event.event_id,
      name: event.event_name,
      date: new Date(event.event_start_time * 1000).toISOString().split('T')[0],
    }));
  } catch (err) {
    console.error('Failed to fetch events:', err.response?.data || err.message);
    throw new Error('Could not load events from ChronoTrack.');
  }
};

/**
 * Fetch races/sub-events for a specific event
 */
export const fetchRacesForEvent = async (eventId) => {
  try {
    const authHeader = await getAuthHeader();

    const response = await axios.get(`${baseUrl}/api/event/${eventId}/race`, {
      headers: { Authorization: authHeader },
      params: {
        client_id: import.meta.env.VITE_CHRONOTRACK_CLIENT_ID,
      },
    });

    const races = response.data.event_race || [];

    return races.map((race) => ({
      race_id: race.race_id,
      race_name: race.race_name || `Race ${race.race_id}`,
    }));
  } catch (err) {
    console.error('Failed to fetch races:', err.response?.data || err.message);
    throw new Error('Could not load races for the selected event.');
  }
};

/**
 * Fetch all results for an event (paginated)
 */
export const fetchResultsForEvent = async (eventId) => {
  try {
    const authHeader = await getAuthHeader();

    let allResults = [];
    let page = 1;
    const perPage = 100; // Max allowed by ChronoTrack
    let fetched = [];

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
      page++;
    } while (fetched.length === perPage);

    return allResults.map((result) => ({
      first_name: result.results_first_name || '',
      last_name: result.results_last_name || '',
      chip_time: result.results_time || '',
      clock_time: result.results_gun_time || '',
      place: result.results_rank || '',
      gender_place: result.results_primary_bracket_rank || '',
      age_group_name: result.results_primary_bracket_name || '',
      age_group_place: result.results_primary_bracket_place || '',
      pace: result.results_pace || '',
      age: result.results_age || '',
      gender: result.results_sex || '',
      bib: result.results_bib || '',
      race_id: result.results_race_id,
      race_name: result.results_race_name || '',
    }));
  } catch (err) {
    console.error('Failed to fetch results:', err.response?.data || err.message);
    throw new Error('Could not load results from ChronoTrack.');
  }
};