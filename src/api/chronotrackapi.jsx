// src/api/chronotrackapi.jsx
import axios from 'axios';

const baseUrl = '/chrono-api'; // Production proxy

let accessToken = null;
let tokenExpiration = 0;

const fetchAccessToken = async () => {
  try {
    const clientId = import.meta.env.VITE_CHRONOTRACK_CLIENT_ID;
    const clientSecret = import.meta.env.VITE_CHRONOTRACK_SECRET;
    const username = import.meta.env.VITE_CHRONOTRACK_USER;
    const password = import.meta.env.VITE_CHRONOTRACK_PASS;

    const credentials = btoa(`${clientId}:${clientSecret}`);

    const response = await axios.get(`${baseUrl}/oauth2/token`, {
      headers: { Authorization: `Basic ${credentials}` },
      params: {
        grant_type: 'password',
        username,
        password,
      },
    });

    const { access_token, expires_in } = response.data;
    accessToken = access_token;
    tokenExpiration = Date.now() + expires_in * 1000;
    return access_token;
  } catch (err) {
    console.error('Failed to fetch access token:', err);
    throw new Error('Could not authenticate with ChronoTrack API.');
  }
};

const getAuthHeader = async () => {
  if (!accessToken || Date.now() >= tokenExpiration) {
    await fetchAccessToken();
  }
  return `Bearer ${accessToken}`;
};

export const fetchEvents = async () => {
  try {
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
  } catch (err) {
    console.error('Failed to fetch events:', err);
    throw new Error('Could not load events from ChronoTrack.');
  }
};

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
    console.error('Failed to fetch races for event:', err);
    throw new Error('Could not load races for the selected event.');
  }
};

export const fetchResultsForEvent = async (eventId, modifiedAfter = null) => {
  try {
    const authHeader = await getAuthHeader();
    let allResults = [];
    let page = 1;
    const perPage = 50; // Keep safe limit
    let fetched;
    do {
      const params = {
        client_id: import.meta.env.VITE_CHRONOTRACK_CLIENT_ID,
        page,
        results_per_page: perPage,
      };
      if (modifiedAfter) {
        params.modified_after = modifiedAfter; // Unix seconds
      }
      const response = await axios.get(`${baseUrl}/api/event/${eventId}/results`, {
        headers: { Authorization: authHeader },
        params,
      });
      fetched = response.data.event_results || [];
      allResults = [...allResults, ...fetched];
      page++;
    } while (fetched.length === perPage);

    return allResults.map(result => ({
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
    console.error('Failed to fetch results:', err);
    throw err;
  }
};