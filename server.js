// server.js (new file for proxy to bypass CORS; run with node server.js)
const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config(); // Load .env

const app = express();
app.use(cors()); // Enable CORS for localhost

// Proxy for ChronoTrack token
app.get('/proxy/chronotrack/token', async (req, res) => {
  try {
    const clientId = process.env.VITE_CHRONOTRACK_CLIENT_ID;
    const clientSecret = process.env.VITE_CHRONOTRACK_SECRET;
    const username = process.env.VITE_CHRONOTRACK_USER;
    const password = process.env.VITE_CHRONOTRACK_PASS;

    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const response = await axios.get('https://api.chronotrack.com/oauth2/token', {
      headers: { Authorization: `Basic ${credentials}` },
      params: {
        grant_type: 'password',
        username,
        password,
      },
    });
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch token' });
  }
});

// Proxy for ChronoTrack events
app.get('/proxy/chronotrack/event', async (req, res) => {
  try {
    const token = req.query.token; // Pass token from client
    const response = await axios.get('https://api.chronotrack.com/api/event', {
      headers: { Authorization: `Bearer ${token}` },
      params: { client_id: process.env.VITE_CHRONOTRACK_CLIENT_ID },
    });
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// Add similar proxies for /race and /result

app.listen(3000, () => console.log('Proxy server on port 3000'));