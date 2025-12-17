// src/pages/AdminPage.jsx (COMPLETE — Safe localStorage + all features)
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchEvents as fetchChronoEvents, fetchRacesForEvent, fetchResultsForEvent } from '../api/chronotrackapi.cjs';
import { supabase } from '../lib/supabase';
import { useLocalStorage } from '../utils/useLocalStorage';

export default function AdminPage() {
  const navigate = useNavigate();

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);

  const [editedEvents, setEditedEvents] = useLocalStorage('editedEvents', {});
  const [expandedEvents, setExpandedEvents] = useState({});
  const [raceEvents, setRaceEvents] = useState({});
  const [hiddenEvents, setHiddenEvents] = useLocalStorage('hiddenEvents', []);
  const [hiddenRaces, setHiddenRaces] = useLocalStorage('hiddenRaces', {});
  const [hiddenMasters, setHiddenMasters] = useLocalStorage('hiddenMasters', []);
  const [showAdsPerMaster, setShowAdsPerMaster] = useLocalStorage('showAdsPerMaster', {});
  const [apiFrequency, setApiFrequency] = useLocalStorage('apiFrequency', 60);
  const [eventLogos, setEventLogos] = useLocalStorage('eventLogos', {});
  const [ads, setAds] = useLocalStorage('ads', []);
  const [chronotrackEnabled, setChronotrackEnabled] = useLocalStorage('chronotrackEnabled', true);
  const [loading, setLoading] = useState(true);
  const [chronoEvents, setChronoEvents] = useState([]);
  const [masterGroups, setMasterGroups] = useLocalStorage('masterGroups', {});
  const [newMasterKeys, setNewMasterKeys] = useState({});
  const [selectedEventId, setSelectedEventId] = useState('');
  const [refreshStatus, setRefreshStatus] = useState('');
  const [activeTab, setActiveTab] = useState('event');
  const [refreshingEvents, setRefreshingEvents] = useState(false);
  const [showAssignedEvents, setShowAssignedEvents] = useState(false);
  const [collapsedYears, setCollapsedYears] = useState({});
  const [syncingEvents, setSyncingEvents] = useState([]);
  const [eventResultsCount, setEventResultsCount] = useState({});
  const [autoSyncOnAssign, setAutoSyncOnAssign] = useLocalStorage('autoSyncOnAssign', {});

  // Login check on mount
  useEffect(() => {
    const loggedIn = typeof window !== 'undefined' && localStorage.getItem('adminLoggedIn') === 'true';
    setIsLoggedIn(loggedIn);
  }, []);

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Date TBD';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return 'Invalid Date';
    const [year, month, day] = parts.map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  // Initial load of events + cached result counts
  useEffect(() => {
    if (isLoggedIn && chronotrackEnabled) {
      const loadEvents = async () => {
        try {
          setLoading(true);
          const events = await fetchChronoEvents();
          const sortedEvents = events.sort((a, b) => new Date(b.date) - new Date(a.date));
          setChronoEvents(sortedEvents);

          // Collapse all years by default
          const years = [...new Set(events.map(e => e.date.split('-')[0]))];
          const initialCollapsed = {};
          years.forEach(y => initialCollapsed[y] = true);
          setCollapsedYears(initialCollapsed);

          // Fetch cached result counts
          const counts = {};
          for (const event of events) {
            try {
              const { count } = await supabase
                .from('chronotrack_results')
                .select('*', { count: 'exact', head: true })
                .eq('event_id', event.id.toString());
              counts[event.id] = count || 0;
            } catch (err) {
              counts[event.id] = 0;
            }
          }
          setEventResultsCount(counts);
        } catch (err) {
          console.error('Failed to fetch ChronoEvents:', err);
          setError('Could not load events.');
        } finally {
          setLoading(false);
        }
      };
      loadEvents();
    } else if (isLoggedIn) {
      setLoading(false);
    }
  }, [isLoggedIn, chronotrackEnabled]);

  // Manual refresh all events
  const handleRefreshAllEvents = async () => {
    if (!chronotrackEnabled) {
      alert('ChronoTrack integration is disabled.');
      return;
    }
    if (refreshingEvents) return;
    setRefreshingEvents(true);
    setRefreshStatus('Fetching all events from ChronoTrack...');
    try {
      const events = await fetchChronoEvents();
      const sortedEvents = events.sort((a, b) => new Date(b.date) - new Date(a.date));
      setChronoEvents(sortedEvents);
      const years = [...new Set(events.map(e => e.date.split('-')[0]))];
      const initialCollapsed = {};
      years.forEach(y => initialCollapsed[y] = true);
      setCollapsedYears(initialCollapsed);
      setRefreshStatus(`Success: Loaded ${events.length} events!`);
    } catch (err) {
      console.error('Failed to refresh events:', err);
      setRefreshStatus('Error: Failed to fetch events.');
    } finally {
      setRefreshingEvents(false);
      setTimeout(() => setRefreshStatus(''), 5000);
    }
  };

  // Sync results for a single event
  const handleSyncResults = async (eventId) => {
    if (syncingEvents.includes(eventId)) return;
    setSyncingEvents(prev => [...prev, eventId]);
    try {
      const rawResults = await fetchResultsForEvent(eventId);
      console.log(`Synced ${rawResults.length} results for event ${eventId}`);

      const genderPlaceMap = {};
      ['M', 'F'].forEach(gender => {
        const genderResults = rawResults.filter(r => r.gender === gender)
          .sort((a, b) => parseTime(a.chip_time) - parseTime(b.chip_time));
        genderResults.forEach((r, index) => {
          genderPlaceMap[r.entry_id] = index + 1;
        });
      });

      const toInsert = rawResults.map(r => ({
        event_id: eventId.toString(),
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
        gender_place: genderPlaceMap[r.entry_id] || null,
        age_group_name: r.age_group_name || null,
        age_group_place: r.age_group_place ? parseInt(r.age_group_place, 10) : null,
        pace: r.pace || null,
        splits: r.splits || [],
      }));

      await supabase.from('chronotrack_results').delete().eq('event_id', eventId.toString());

      const chunkSize = 500;
      for (let i = 0; i < toInsert.length; i += chunkSize) {
        const chunk = toInsert.slice(i, i + chunkSize);
        const { error } = await supabase.from('chronotrack_results').insert(chunk);
        if (error) throw error;
      }

      setEventResultsCount(prev => ({ ...prev, [eventId]: rawResults.length }));
    } catch (err) {
      console.error('Sync failed for event', eventId, err);
      alert('Failed to sync results for this event.');
    } finally {
      setSyncingEvents(prev => prev.filter(id => id !== eventId));
    }
  };

  const handleRefreshAndPublish = async () => {
    if (!selectedEventId) return;
    setRefreshStatus('Refreshing...');
    try {
      await handleSyncResults(selectedEventId);
      setRefreshStatus('Success: Results refreshed and published!');
    } catch (err) {
      setRefreshStatus('Error: Failed to refresh results.');
    }
  };

  const handleLogin = (e) => {
    e.preventDefault();
    if (username === 'G3M1N1_1912' && password === 'Br@nd0n81') {
      localStorage.setItem('adminLoggedIn', 'true');
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

  const assignToMaster = async (eventId, masterKey) => {
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
    if (autoSyncOnAssign[eventId]) {
      await handleSyncResults(eventId);
      setAutoSyncOnAssign(prev => ({ ...prev, [eventId]: false }));
    }
  };

  const handleSaveChanges = () => {
    alert('All changes saved successfully!');
  };

  const parseTime = (t) => {
    if (!t) return Infinity;
    const parts = t.split(':').map(Number);
    const hours = parts.length > 2 ? parts[0] : 0;
    const minutes = parts.length > 2 ? parts[1] : parts[0];
    const seconds = parts.length > 2 ? parts[2] : parts[1];
    return hours * 3600 + minutes * 60 + (seconds || 0);
  };

  const eventsByYear = chronoEvents.reduce((acc, event) => {
    const year = event.date.split('-')[0];
    if (!acc[year]) acc[year] = [];
    acc[year].push(event);
    return acc;
  }, {});

  const years = Object.keys(eventsByYear).sort((a, b) => b - a);
  const assignedEventIds = new Set(Object.values(masterGroups).flat());

  const toggleYearCollapse = (year) => {
    setCollapsedYears(prev => ({ ...prev, [year]: !prev[year] }));
  };

  const handleFileUpload = (e, type) => {
    const files = Array.from(e.target.files);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (type === 'ad') {
          setAds(prev => [...prev, reader.result]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  return (
    <div className="min-h-screen bg-gemini-light-gray pt-32 py-12">
      <div className="max-w-7xl mx-auto px-6">
        {!isLoggedIn ? (
          <form onSubmit={handleLogin} className="max-w-md mx-auto bg-white p-8 rounded-lg shadow">
            <h2 className="text-3xl font-bold mb-6 text-center">Admin Login</h2>
            {error && <p className="text-gemini-red mb-4">{error}</p>}
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Username"
              className="w-full p-4 mb-4 rounded-lg border border-gray-300"
              required
            />
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full p-4 mb-6 rounded-lg border border-gray-300"
              required
            />
            <button type="submit" className="w-full bg-gemini-blue text-white p-4 rounded-lg hover:bg-gemini-blue/90">
              Login
            </button>
          </form>
        ) : (
          <>
            <h1 className="text-4xl font-bold mb-12 text-center text-gemini-dark-gray">Admin Dashboard</h1>

            {/* Tabs */}
            <div className="flex mb-8">
              <button
                onClick={() => setActiveTab('event')}
                className={`flex-1 py-4 text-center font-bold rounded-t-xl ${activeTab === 'event' ? 'bg-white shadow' : 'bg-gray-200'}`}
              >
                Event Management
              </button>
              <button
                onClick={() => setActiveTab('website')}
                className={`flex-1 py-4 text-center font-bold rounded-t-xl ${activeTab === 'website' ? 'bg-white shadow' : 'bg-gray-200'}`}
              >
                Website Management
              </button>
            </div>

            {/* Event Management Tab */}
            {activeTab === 'event' && (
              <>
                <div className="flex justify-between items-center mb-8">
                  <button
                    onClick={() => navigate('/master-events')}
                    className="bg-blue-500 text-white px-6 py-3 rounded-xl hover:bg-blue-600"
                  >
                    Manage Master Events
                  </button>
                  <button
                    onClick={handleRefreshAllEvents}
                    disabled={refreshingEvents || !chronotrackEnabled}
                    className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white font-bold px-8 py-4 rounded-xl shadow-lg transition flex items-center gap-3"
                  >
                    {refreshingEvents ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-white"></div>
                        Fetching Events...
                      </>
                    ) : (
                      '↻ Refresh All Events'
                    )}
                  </button>
                </div>

                {refreshStatus && (
                  <div className={`mb-6 p-4 rounded-lg text-center font-medium ${refreshStatus.includes('Success') ? 'bg-green-100 text-green-800' : refreshStatus.includes('Error') ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>
                    {refreshStatus}
                  </div>
                )}

                {/* Toggle to show assigned events */}
                <div className="flex items-center justify-end mb-6">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showAssignedEvents}
                      onChange={e => setShowAssignedEvents(e.target.checked)}
                      className="mr-3"
                    />
                    <span className="text-gray-700 font-medium">Show events already assigned to a master</span>
                  </label>
                </div>

                {/* ChronoTrack Toggle */}
                <div className="flex items-center mb-8">
                  <input
                    type="checkbox"
                    checked={chronotrackEnabled}
                    onChange={e => setChronotrackEnabled(e.target.checked)}
                    className="mr-2"
                  />
                  <span>Enable ChronoTrack Integration</span>
                </div>

                {/* Refresh Results */}
                <section className="mb-12">
                  <h2 className="text-3xl font-bold mb-6">Refresh Event Results</h2>
                  <div className="flex flex-col sm:flex-row gap-4 mb-4">
                    <select
                      value={selectedEventId}
                      onChange={e => setSelectedEventId(e.target.value)}
                      className="flex-1 p-4 rounded-lg border border-gray-300"
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
                </section>

                {/* Manage Events — Grouped by Year with Collapse */}
                <section className="mb-12">
                  <h2 className="text-3xl font-bold mb-8">Manage Events (by Year)</h2>
                  {years.length === 0 ? (
                    <p className="text-center text-gray-600">No events loaded.</p>
                  ) : (
                    years.map(year => {
                      const isCollapsed = collapsedYears[year] ?? true;
                      const yearEvents = eventsByYear[year]
                        .filter(event => showAssignedEvents || !assignedEventIds.has(event.id));
                      if (yearEvents.length === 0) return null;
                      return (
                        <div key={year} className="mb-12">
                          <button
                            onClick={() => toggleYearCollapse(year)}
                            className="flex items-center gap-3 text-2xl font-bold text-gemini-dark-gray mb-6 hover:text-gemini-blue transition w-full text-left"
                          >
                            <span className="text-3xl">
                              {isCollapsed ? '▶' : '▼'}
                            </span>
                            <span>{year} ({yearEvents.length} events)</span>
                          </button>
                          {!isCollapsed && (
                            <div className="space-y-6 pl-10">
                              {yearEvents.map(event => {
                                const currentMaster = Object.keys(masterGroups).find(key => masterGroups[key].includes(event.id)) || 'None';
                                const resultsCount = eventResultsCount[event.id] || 0;
                                return (
                                  <div key={event.id} className="p-6 bg-white rounded-xl shadow hover:shadow-lg transition">
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
                                    {/* Sync Results Button + Count */}
                                    <div className="mt-4 flex items-center gap-4">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleSyncResults(event.id);
                                        }}
                                        disabled={syncingEvents.includes(event.id)}
                                        className="bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg transition flex items-center gap-2"
                                      >
                                        {syncingEvents.includes(event.id) ? (
                                          <>
                                            <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-white"></div>
                                            Syncing...
                                          </>
                                        ) : (
                                          '↻ Sync Results'
                                        )}
                                      </button>
                                      <span className="text-sm text-gray-600">
                                        {resultsCount > 0 ? `${resultsCount} finishers cached` : 'No results cached'}
                                      </span>
                                    </div>
                                    <div className="mt-4">
                                      <p className="font-bold">Current Master: <span className="text-gemini-blue">{currentMaster}</span></p>
                                      <div className="flex items-center gap-2 mt-2">
                                        <input
                                          type="checkbox"
                                          checked={autoSyncOnAssign[event.id] || false}
                                          onChange={e => setAutoSyncOnAssign(prev => ({ ...prev, [event.id]: e.target.checked }))}
                                        />
                                        <span className="text-sm text-gray-700">Sync results after assigning</span>
                                      </div>
                                      <div className="flex items-center gap-2 mt-2">
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
                                      <div className="mt-6 border-t pt-6">
                                        <h4 className="text-xl font-bold mb-4">Races</h4>
                                        {raceEvents[event.id].map(race => (
                                          <div key={race.race_id} className="flex items-center mb-3 ml-4">
                                            <input
                                              type="checkbox"
                                              checked={!(hiddenRaces[event.id] || []).includes(race.race_id)}
                                              onChange={() => toggleRaceVisibility(event.id, race.race_id)}
                                              className="mr-3"
                                            />
                                            <div className="flex flex-col space-y-1 flex-1">
                                              <span className="text-sm text-gray-500">Original: {race.race_name}</span>
                                              <input
                                                type="text"
                                                value={editedEvents[event.id]?.races?.[race.race_id] || race.race_name}
                                                onChange={e => handleEditRaceName(event.id, race.race_id, e.target.value)}
                                                className="w-full p-2 border border-gray-300 rounded"
                                              />
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </section>
              </>
            )}

            {/* Website Management Tab */}
            {activeTab === 'website' && (
              <>
                <section className="mb-12">
                  <h2 className="text-3xl font-bold mb-4">API Frequency (minutes)</h2>
                  <input
                    type="number"
                    value={apiFrequency}
                    onChange={e => {
                      const value = parseInt(e.target.value, 10);
                      if (value > 0) setApiFrequency(value);
                    }}
                    className="w-full max-w-xs p-4 rounded-lg border border-gray-300"
                   c/>
                </section>
                <section className="mb-12">
                  <h2 className="text-3xl font-bold mb-4">Upload Advertisements</h2>
                  <input type="file" onChange={e => handleFileUpload(e, 'ad')} accept="image/*" multiple />
                  <div className="grid grid-cols-3 gap-4 mt-4">
                    {ads.map((ad, index) => (
                      <img key={index} src={ad} alt={`Ad ${index}`} className="w-full h-auto rounded" />
                    ))}
                  </div>
                </section>
              </>
            )}

            <div className="text-center mt-12">
              <button onClick={handleSaveChanges} className="bg-gemini-blue text-white px-10 py-5 rounded-xl hover:bg-gemini-blue/90 font-bold text-xl">
                Save All Changes
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}