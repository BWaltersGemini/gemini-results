// src/api/chronotrackapi.jsx (FINAL WORKING VERSION - Dec 2025)
import axios from 'axios';

// Proxy base (Vercel/Vite will forward /chrono-api → https://api.chronotrack.com)
const baseUrl = '/chrono-api';

let accessToken = null;
let tokenExpiration = 0;

/**
 * Fetch OAuth2 token using Resource Owner Password Credentials flow
 * Correct endpoint: https://api.chronotrack.com/api/oauth2/token
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

    const response = await axios.post(
      `${baseUrl}/api/oauth2/token`, // CORRECT PATH
      new URLSearchParams({
        grant_type: 'password',
        username,
        password,
      }),
      {
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    const { access_token, expires_in } = response.data;

    if (!access_token) {
      throw new Error('No access token returned');
    }

    accessToken = access_token;
    tokenExpiration = Date.now() + expires_in * 1000;

    console.log('[ChronoTrack] Token acquired successfully');
    return access_token;
  } catch (err) {
    console.error('[ChronoTrack] Token fetch failed:', err.response?.data || err.message);
    accessToken = null;
    throw new Error('Could not authenticate with ChronoTrack API.');
  }
};

/**
 * Get valid Bearer token (refreshes automatically if expired)
 */
const getAuthHeader = async () => {
  if (!accessToken || Date.now() >= tokenExpiration) {
    await fetchAccessToken();
  }
  return `Bearer ${accessToken}`;
};

/**
 * Fetch all events
 */
export const fetchEvents = async () => {
  try {
    const authHeader = await getAuthHeader();
    const response = await axios.get(`${baseUrl}/api/event`, {
      headers: { Authorization: authHeader },
      params: { client_id: import.meta.env.VITE_CHRONOTRACK_CLIENT_ID },
    });

    const events = response.data.event || [];
    return events.map(event => ({
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
 * Fetch races for a specific event
 */
export const fetchRacesForEvent = async (eventId) => {
  try {
    const authHeader = await getAuthHeader();
    const response = await axios.get(`${baseUrl}/api/event/${eventId}/race`, {
      headers: { Authorization: authHeader },
      params: { client_id: import.meta.env.VITE_CHRONOTRACK_CLIENT_ID },
    });

    const races = response.data.event_race || [];
    return races.map(race => ({
      race_id: race.race_id,
      race_name: race.race_name || `Race ${race.race_id}`,
    }));
  } catch (err) {
    console.error('Failed to fetch races:', err.response?.data || err.message);
    throw new Error('Could not load races for the selected event.');
  }
};

/**
 * Fetch ALL results for an event with pagination
 */
export const fetchResultsForEvent = async (eventId, modifiedAfter = null) => {
  try {
    const authHeader = await getAuthHeader();
    let allResults = [];
    let page = 1;
    const perPage = 100; // Increased for faster loading
    let fetched = [];

    do {
      const params = {
        client_id: import.meta.env.VITE_CHRONOTRACK_CLIENT_ID,
        page,
        results_per_page: perPage,
      };
      if (modifiedAfter) {
        params.modified_after = modifiedAfter;
      }

      const response = await axios.get(`${baseUrl}/api/event/${eventId}/results`, {
        headers: { Authorization: authHeader },
        params,
      });

      fetched = response.data.event_results || [];
      allResults.push(...fetched);
      page++;
    } while (fetched.length === perPage);

    // Normalize result fields
    return allResults.map(r => ({
      first_name: r.results_first_name || '',
      last_name: r.results_last_name || '',
      chip_time: r.results_time || '',
      clock_time: r.results_gun_time || '',
      place: r.results_rank || '',
      gender_place: r.results_primary_bracket_rank || '',
      age_group_name: r.results_primary_bracket_name || '',
      age_group_place: r.results_primary_bracket_place || '',
      pace: r.results_pace || '',
      age: r.results_age || '',
      gender: r.results_sex || '',
      bib: r.results_bib || '',
      race_id: r.results_race_id,
      race_name: r.results_race_name || '',
    }));
  } catch (err) {
    {
    console.error('Failed to fetch results:', err.response?.data || err.message);
    throw err;
  }
}; 