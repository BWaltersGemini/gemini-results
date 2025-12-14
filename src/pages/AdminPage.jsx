// src/pages/AdminPage.jsx (COMPLETE FINAL — Fixed refresh with event_id, full features)
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchEvents as fetchChronoEvents, fetchRacesForEvent, fetchResultsForEvent } from '../api/chronotrackapi';
import { supabase } from '../lib/supabase';

export default function AdminPage() {
  const navigate = useNavigate();

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);

  const [editedEvents, setEditedEvents] = useState(() => {
    const stored = localStorage.getItem('editedEvents');
    return stored ? JSON.parse(stored) : {};
  });
  const [expandedEvents, setExpandedEvents] = useState({});
  const [raceEvents, setRaceEvents] = useState({});
  const [hiddenEvents, setHiddenEvents] = useState(() => {
    const stored = localStorage.getItem('hiddenEvents');
    return stored ? JSON.parse(stored) : [];
  });
  const [hiddenRaces, setHiddenRaces] = useState(() => {
    const stored = localStorage.getItem('hiddenRaces');
    return stored ? JSON.parse(stored) : {};
  });
  const [hiddenMasters, setHiddenMasters] = useState(() => {
    const stored = localStorage.getItem('hiddenMasters');
    return stored ? JSON.parse(stored) : [];
  });
  const [showAdsPerMaster, setShowAdsPerMaster] = useState(() => {
    const stored = localStorage.getItem('showAdsPerMaster');
    return stored ? JSON.parse(stored) : {};
  });
  const [apiFrequency, setApiFrequency] = useState(localStorage.getItem('apiFrequency') || 60);
  const [eventLogos, setEventLogos] = useState(() => {
    const stored = localStorage.getItem('eventLogos');
    return stored ? JSON.parse(stored) : {};
  });
  const [ads, setAds] = useState(() => {
    const stored = localStorage.getItem('ads');
    return stored ? JSON.parse(stored) : [];
  });
  const [chronotrackEnabled, setChronotrackEnabled] = useState(() => {
    const stored = localStorage.getItem('chronotrackEnabled');
    return stored === null || stored === 'true';
  });
  const [loading, setLoading] = useState(true);
  const [chronoEvents, setChronoEvents] = useState([]);
  const [masterGroups, setMasterGroups] = useState(() => {
    const stored = localStorage.getItem('masterGroups');
    return stored ? JSON.parse(stored) : {};
  });
  const [newMasterKeys, setNewMasterKeys] = useState({});
  const [selectedEventId, setSelectedEventId] = useState('');
  const [refreshStatus, setRefreshStatus] = useState('');

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Date TBD';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return 'Invalid Date';
    const [year, month, day] = parts.map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  // Persist ChronoTrack toggle
  useEffect(() => {
    localStorage.setItem('chronotrackEnabled', chronotrackEnabled);
  }, [chronotrackEnabled]);

  // Fetch events
  useEffect(() => {
    if (isLoggedIn && chronotrackEnabled) {
      const fetchRaces = async () => {
        try {
          const events = await fetchChronoEvents();
          const sortedEvents = events.sort((a, b) => new Date(b.date) - new Date(a.date));
          setChronoEvents(sortedEvents);
        } catch (err) {
          console.error('Failed to fetch ChronoEvents:', err);
          setError('Could not load events.');
        } finally {
          setLoading(false);
        }
      };
      fetchRaces();
    } else if (isLoggedIn) {
      setLoading(false);
    }
  }, [isLoggedIn, chronotrackEnabled]);

  const handleLogin = (e) => {
    e.preventDefault();
    if (username === 'G3M1N1_1912' && password === 'Br@nd0n81') {
      setIsLoggedIn(true);
      setError(null);
    } else {
      setError('Invalid credentials');
    }
  };

  const toggleExpandEvent = (eventId) => {
    setExpandedEvents(prev => ({ ...prev, [eventId]: !prev[eventId] }));
    if (!expandedEvents[eventId] && chronotrackEnabled) {
      fetchRacesForEventId(eventId);
    }
  };

  const fetchRacesForEventId = async (eventId) => {
    try {
      const races = await fetchRacesForEvent(eventId);
      setRaceEvents(prev => ({ ...prev, [eventId]: races }));
    } catch (err) {
      console.error('Failed to fetch races:', err);
    }
  };

  const handleEditName = (id, value) => {
    setEditedEvents(prev => ({
      ...prev,
      [id]: { ...prev[id], name: value },
    }));
  };

  const handleEditRaceName = (eventId, raceId, value) => {
    setEditedEvents(prev => ({
      ...prev,
      [eventId]: {
        ...prev[eventId],
        races: { ...(prev[eventId]?.races || {}), [raceId]: value },
      },
    }));
  };

  const toggleEventVisibility = (eventId) => {
    setHiddenEvents(prev => prev.includes(eventId)
      ? prev.filter(id => id !== eventId)
      : [...prev, eventId]
    );
  };

  const toggleRaceVisibility = (eventId, raceId) => {
    setHiddenRaces(prev => {
      const races = prev[eventId] || [];
      return {
        ...prev,
        [eventId]: races.includes(raceId)
          ? races.filter(id => id !== raceId)
          : [...races, raceId],
      };
    });
  };

  const toggleMasterVisibility = (masterKey) => {
    setHiddenMasters(prev => prev.includes(masterKey)
      ? prev.filter(k => k !== masterKey)
      : [...prev, masterKey]
    );
  };

  const toggleShowAds = (masterKey) => {
    setShowAdsPerMaster(prev => ({ ...prev, [masterKey]: !prev[masterKey] }));
  };

  const assignToMaster = (eventId, masterKey) => {
    if (!masterKey) return;
    const newGroups = { ...masterGroups };
    Object.keys(newGroups).forEach(key => {
      newGroups[key] = newGroups[key].filter(id => id !== eventId);
      if (newGroups[key].length === 0) delete newGroups[key];
    });
    if (!newGroups[masterKey]) newGroups[masterKey] = [];
    newGroups[masterKey].push(eventId);
    setMasterGroups(newGroups);
    setNewMasterKeys(prev => ({ ...prev, [eventId]: '' }));
  };

  const handleFileUpload = (e, type, id) => {
    const files = Array.from(e.target.files);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (type === 'logo') {
          setEventLogos(prev => ({ ...prev, [id]: reader.result }));
        } else if (type === 'ad') {
          setAds(prev => [...prev, reader.result]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFrequencyChange = (e) => {
    setApiFrequency(e.target.value);
  };

  const handleSaveChanges = () => {
    localStorage.setItem('editedEvents', JSON.stringify(editedEvents));
    localStorage.setItem('hiddenEvents', JSON.stringify(hiddenEvents));
    localStorage.setItem('hiddenRaces', JSON.stringify(hiddenRaces));
    localStorage.setItem('hiddenMasters', JSON.stringify(hiddenMasters));
    localStorage.setItem('showAdsPerMaster', JSON.stringify(showAdsPerMaster));
    localStorage.setItem('apiFrequency', apiFrequency);
    localStorage.setItem('eventLogos', JSON.stringify(eventLogos));
    localStorage.setItem('ads', JSON.stringify(ads));
    localStorage.setItem('masterGroups', JSON.stringify(masterGroups));
    localStorage.setItem('chronotrackEnabled', chronotrackEnabled);
    alert('All changes saved successfully!');
  };

  // Refresh & Publish — Fixed with explicit event_id
  const handleRefreshAndPublish = async () => {
    if (!selectedEventId) {
      setRefreshStatus('Please select an event first');
      return;
    }
    if (!chronotrackEnabled) {
      setRefreshStatus('ChronoTrack API is disabled');
      return;
    }

    setRefreshStatus('Fetching fresh results from ChronoTrack...');
    try {
      const allResults = await fetchResultsForEvent(selectedEventId);
      setRefreshStatus(`Fetched ${allResults.length} results. Clearing old cache...`);

      // Clear old results for this event
      const { error: deleteError } = await supabase
        .from('chronotrack_results')
        .delete()
        .eq('event_id', selectedEventId);

      if (deleteError) throw deleteError;

      setRefreshStatus('Inserting fresh results...');

      // Insert fresh results — explicitly include event_id
      const toInsert = allResults.map(r => ({
        event_id: selectedEventId, // ← Critical fix
        race_id: r.race_id || null,
        bib: r.bib || null,
        first_name: r.first_name || null,
        last_name: r.last_name || null,
        gender: r.gender || null,
        age: r.age ? parseInt(r.age, 10) : null,
        city: r.city || null,
        state: r.state || null,
        country: r.country || null,
        chip_time: r.chip_time || null,
        clock_time: r.clock_time || null,
        place: r.place ? parseInt(r.place, 10) : null,
        gender_place: r.gender_place ? parseInt(r.gender_place, 10) : null,
        age_group_name: r.age_group_name || null,
        age_group_place: r.age_group_place ? parseInt(r.age_group_place, 10) : null,
        pace: r.pace || null,
        splits: r.splits || [],
      }));

      const chunkSize = 500;
      for (let i = 0; i < toInsert.length; i += chunkSize) {
        const chunk = toInsert.slice(i, i + chunkSize);
        const { error: insertError } = await supabase
          .from('chronotrack_results')
          .insert(chunk);
        if (insertError) throw insertError;
      }

      setRefreshStatus(`Success! ${allResults.length} results refreshed and published to all users.`);
    } catch (err) {
      console.error('Refresh & publish failed:', err);
      setRefreshStatus(`Error: ${err.message || 'Unknown error'}`);
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <form onSubmit={handleLogin} className="bg-white p-10 rounded-2xl shadow-2xl w-full max-w-md">
          <h2 className="text-3xl font-bold text-center mb-8 text-gemini-dark-gray">Admin Login</h2>
          {error && <p className="text-red-600 text-center mb-4">{error}</p>}
          <input
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            placeholder="Username"
            className="w-full p-4 mb-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gemini-blue"
            required
          />
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full p-4 mb-6 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gemini-blue"
            required
          />
          <button type="submit" className="w-full bg-gemini-blue text-white py-4 rounded-lg font-bold hover:bg-gemini-blue/90 transition">
            Login
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gemini-light-gray pt-40 py-12">
      <div className="max-w-7xl mx-auto px-6">
        <h1 className="text-5xl font-bold text-center mb-12 text-gemini-dark-gray">Admin Dashboard</h1>

        {/* ChronoTrack API Toggle */}
        <section className="mb-12 bg-white p-8 rounded-2xl shadow-xl border-2 border-gemini-blue">
          <h2 className="text-3xl font-bold mb-6 text-gemini-dark-gray">ChronoTrack API Control</h2>
          <div className="flex items-center justify-between max-w-lg">
            <div>
              <p className="text-xl font-semibold">Live Data Feed</p>
              <p className="text-gray-600">
                {chronotrackEnabled ? 'Active — fetching real-time results' : 'Disabled — no API calls'}
              </p>
            </div>
            <button
              onClick={() => setChronotrackEnabled(prev => !prev)}
              className={`relative inline-flex h-14 w-28 items-center rounded-full transition-colors duration-300 ${
                chronotrackEnabled ? 'bg-gemini-blue' : 'bg-gray-400'
              }`}
            >
              <span
                className={`inline-block h-12 w-12 transform rounded-full bg-white shadow-lg transition-transform duration-300 ${
                  chronotrackEnabled ? 'translate-x-14' : 'translate-x-2'
                }`}
              />
            </button>
          </div>
          <p className="mt-6 text-sm text-gray-600 max-w-3xl">
            Turn off to stop all ChronoTrack API calls. Useful for maintenance, testing, or switching to cached data only.
          </p>
        </section>

        {/* Refresh & Publish Results */}
        <section className="mb-12 p-8 bg-green-50 rounded-xl border border-green-200">
          <h2 className="text-3xl font-bold mb-6">Refresh & Publish Results</h2>
          <p className="mb-4 text-gray-700">
            Force a fresh fetch from ChronoTrack and publish the latest results to all users instantly.
          </p>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <select
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              className="p-3 border border-gray-300 rounded-lg w-full sm:w-auto"
              disabled={!chronotrackEnabled}
            >
              <option value="">Select Event</option>
              {chronoEvents.map(event => (
                <option key={event.id} value={event.id}>
                  {event.name} ({formatDate(event.date)})
                </option>
              ))}
            </select>
            <button
              onClick={handleRefreshAndPublish}
              disabled={!selectedEventId || !chronotrackEnabled}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-bold py-3 px-8 rounded-lg transition w-full sm:w-auto"
            >
              Refresh & Publish Results
            </button>
          </div>
          {refreshStatus && (
            <p className={`mt-6 text-lg font-medium ${refreshStatus.includes('Success') ? 'text-green-800' : 'text-red-700'}`}>
              {refreshStatus}
            </p>
          )}
        </section>

        {/* Manage Events */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold mb-6">Manage Events</h2>
          {chronoEvents.map((event) => {
            const currentMaster = Object.keys(masterGroups).find(key => masterGroups[key].includes(event.id)) || 'None';
            return (
              <div key={event.id} className="mb-4 p-6 bg-white rounded-xl shadow">
                <div className="flex items-center justify-between cursor-pointer" onClick={() => toggleExpandEvent(event.id)}>
                  <div className="flex flex-col space-y-1 flex-1">
                    <span className="text-sm text-gray-500">Original: {event.name}</span>
                    <input
                      type="text"
                      value={editedEvents[event.id]?.name || event.name}
                      onChange={e => handleEditName(event.id, e.target.value)}
                      onClick={e => e.stopPropagation()}
                      className="text-2xl font-bold p-2 border border-gray-300 rounded"
                    />
                  </div>
                  <span className="ml-2 text-xl text-gray-600">({formatDate(event.date)})</span>
                  <span>{expandedEvents[event.id] ? '▲' : '▼'}</span>
                </div>
                <div className="flex items-center mt-2">
                  <input
                    type="checkbox"
                    checked={!hiddenEvents.includes(event.id)}
                    onChange={() => toggleEventVisibility(event.id)}
                    className="mr-2"
                  />
                  <span>Visible in App</span>
                </div>
                <div className="mt-4">
                  <p className="font-bold">Current Master: {currentMaster}</p>
                  <div className="flex items-center gap-2">
                    <input
                      list="master-keys"
                      placeholder="Enter or select Master Key"
                      value={newMasterKeys[event.id] || ''}
                      onChange={e => setNewMasterKeys(prev => ({ ...prev, [event.id]: e.target.value }))}
                      className="p-2 border border-gray-300 rounded flex-1"
                    />
                    <datalist id="master-keys">
                      {Object.keys(masterGroups).map(key => (
                        <option key={key} value={key} />
                      ))}
                    </datalist>
                    <button
                      onClick={() => assignToMaster(event.id, newMasterKeys[event.id])}
                      className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
                    >
                      Assign
                    </button>
                  </div>
                </div>
                {expandedEvents[event.id] && raceEvents[event.id] && (
                  <div className="mt-4">
                    <h3 className="text-xl font-bold mb-2">Races</h3>
                    {raceEvents[event.id].map(race => (
                      <div key={race.race_id} className="flex items-center mb-1 ml-4">
                        <input
                          type="checkbox"
                          checked={! (hiddenRaces[event.id] || []).includes(race.race_id)}
                          onChange={() => toggleRaceVisibility(event.id, race.race_id)}
                          className="mr-2"
                        />
                        <div className="flex flex-col space-y-1 flex-1">
                          <span className="text-sm text-gray-500">Original: {race.race_name}</span>
                          <input
                            type="text"
                            value={editedEvents[event.id]?.races?.[race.race_id] || race.race_name}
                            onChange={e => handleEditRaceName(event.id, race.race_id, e.target.value)}
                            className="w-full p-1 border border-gray-300 rounded"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </section>

        {/* API Frequency */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold mb-4">API Frequency (minutes)</h2>
          <input
            type="number"
            value={apiFrequency}
            onChange={handleFrequencyChange}
            className="w-full max-w-xs p-4 rounded-lg border border-gray-300"
          />
        </section>

        {/* Upload Advertisements */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold mb-4">Upload Advertisements</h2>
          <input type="file" onChange={e => handleFileUpload(e, 'ad')} accept="image/*" multiple />
          <div className="grid grid-cols-3 gap-4 mt-4">
            {ads.map((ad, index) => (
              <img key={index} src={ad} alt={`Ad ${index}`} className="w-full h-auto rounded" />
            ))}
          </div>
        </section>

        <button onClick={handleSaveChanges} className="mt-12 bg-gemini-blue text-white px-10 py-5 rounded-xl hover:bg-gemini-blue/90 font-bold text-xl">
          Save All Changes
        </button>
      </div>
    </div>
  );
}