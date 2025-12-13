// server.js (full proxy for ChronoTrack API - secure backend version)
const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(cors()); // Allow your Vercel domain or localhost
app.use(express.json());

// Helper to get/refresh token (cached in memory - fine for low traffic)
let accessToken = null;
let tokenExpiration = 0;

const getAccessToken = async () => {
  if (accessToken && Date.now() < tokenExpiration) {
    return accessToken;
  }

  const clientId = process.env.VITE_CHRONOTRACK_CLIENT_ID; // Or separate CHRONOTRACK_CLIENT_ID
  const clientSecret = process.env.VITE_CHRONOTRACK_SECRET;
  const username = process.env.VITE_CHRONOTRACK_USER;
  const password = process.env.VITE_CHRONOTRACK_PASS;

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  try {
    const response = await axios.get('https://api.chronotrack.com/oauth2/token', {
      headers: { Authorization: `Basic ${credentials}` },
      params: {
        grant_type: 'password',
        username,
        password,
      },
    });

    accessToken = response.data.access_token;
    tokenExpiration = Date.now() + (response.data.expires_in || 3600) * 1000;
    console.log('New ChronoTrack token acquired');
    return accessToken;
  } catch (err) {
    console.error('Token error:', err.response?.data || err.message);
    throw err;
  }
};

// Proxy: Get events
app.get('/api/chronotrack/events', async (req, res) => {
  try {
    const token = await getAccessToken();
    const response = await axios.get('https://api.chronotrack.com/api/event', {
      headers: { Authorization: `Bearer ${token}` },
      params: { client_id: process.env.VITE_CHRONOTRACK_CLIENT_ID },
    });
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch events', details: err.response?.data });
  }
});

// Proxy: Get races for event
app.get('/api/chronotrack/event/:eventId/races', async (req, res) => {
  try {
    const token = await getAccessToken();
    const response = await axios.get(`https://api.chronotrack.com/api/event/${req.params.eventId}/race`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { client_id: process.env.VITE_CHRONOTRACK_CLIENT_ID },
    });
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch races', details: err.response?.data });
  }
});

// Proxy: Get results for event (with pagination)
app.get('/api/chronotrack/event/:eventId/results', async (req, res) => {
  try {
    const token = await getAccessToken();
    let allResults = [];
    let page = 1;
    const perPage = 100;
    let fetched;

    do {
      const response = await axios.get(`https://api.chronotrack.com/api/event/${req.params.eventId}/results`, {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          client_id: process.env.VITE_CHRONOTRACK_CLIENT_ID,
          page,
          results_per_page: perPage,
        },
      });
      fetched = response.data.event_results || [];
      allResults = [...allResults, ...fetched];
      page++;
    } while (fetched.length === perPage);

    res.json({ event_results: allResults });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch results', details: err.response?.data });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Proxy server running on port ${PORT}`));