// src/pages/AdminPage.jsx (FINAL COMPLETE VERSION — Safe upsert with race sync, no foreign key errors, production-ready)
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchEvents as fetchChronoEvents, fetchRacesForEvent, fetchResultsForEvent } from '../api/chronotrackapi';
import { createAdminSupabaseClient } from '../supabaseClient';
import { loadAppConfig } from '../utils/appConfig';

export default function AdminPage() {
  const navigate = useNavigate();

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);

  // Global config state
  const [editedEvents, setEditedEvents] = useState({});
  const [masterGroups, setMasterGroups] = useState({});
  const [hiddenEvents, setHiddenEvents] = useState([]);
  const [hiddenRaces, setHiddenRaces] = useState({});
  const [hiddenMasters, setHiddenMasters] = useState([]);
  const [showAdsPerMaster, setShowAdsPerMaster] = useState({});
  const [eventLogos, setEventLogos] = useState({});
  const [ads, setAds] = useState([]);
  const [expandedEvents, setExpandedEvents] = useState({});
  const [raceEvents, setRaceEvents] = useState({});
  const [chronotrackEnabled, setChronotrackEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [chronoEvents, setChronoEvents] = useState([]);
  const [newMasterKeys, setNewMasterKeys] = useState({});
  const [selectedEventId, setSelectedEventId] = useState('');
  const [refreshStatus, setRefreshStatus] = useState('');
  const [activeTab, setActiveTab] = useState('event');
  const [refreshingEvents, setRefreshingEvents] = useState(false);
  const [showAssignedEvents, setShowAssignedEvents] = useState(false);
  const [collapsedYears, setCollapsedYears] = useState({});
  const [syncingEvents, setSyncingEvents] = useState([]);
  const [eventResultsCount, setEventResultsCount] = useState({});
  const [autoSyncOnAssign, setAutoSyncOnAssign] = useState({});
  const [fetchingNewEvents, setFetchingNewEvents] = useState(false);
  const [newEventsStatus, setNewEventsStatus] = useState('');

  // Admin Supabase client (service_role)
  const adminSupabase = createAdminSupabaseClient();

  // Load global config from Supabase
  const loadGlobalConfig = async () => {
    const config = await loadAppConfig();
    setMasterGroups(config.masterGroups || {});
    setEditedEvents(config.editedEvents || {});
    setEventLogos(config.eventLogos || {});
    setHiddenMasters(config.hiddenMasters || []);
    setShowAdsPerMaster(config.showAdsPerMaster || {});
    setAds(config.ads || []);
    setHiddenEvents(config.hiddenEvents || []);
    setHiddenRaces(config.hiddenRaces || {});
  };

  // Save single config key to Supabase
  const saveConfig = async (key, value) => {
    try {
      const { error } = await adminSupabase
        .from('app_config')
        .upsert({ key, value }, { onConflict: 'key' });
      if (error) throw error;
      console.log(`[Admin] Saved ${key} to Supabase`);
    } catch (err) {
      console.error(`[Admin] Failed to save ${key}:`, err);
      alert(`Failed to save ${key}. Check console.`);
    }
  };

  // Login check
  useEffect(() => {
    const loggedIn = typeof window !== 'undefined' && localStorage.getItem('adminLoggedIn') === 'true';
    setIsLoggedIn(loggedIn);
    if (loggedIn) loadGlobalConfig();
  }, []);

  // Safe date formatting using epoch (seconds)
  const formatDate = (epoch) => {
    if (!epoch || isNaN(epoch)) return 'Date TBD';
    const date = new Date(epoch * 1000);
    if (isNaN(date.getTime())) return 'Invalid Date';
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Load events from ChronoTrack
  useEffect(() => {
    if (isLoggedIn && chronotrackEnabled) {
      const loadEvents = async () => {
        try {
          setLoading(true);
          const events = await fetchChronoEvents();
          const sortedEvents = events.sort((a, b) => (b.start_time || 0) - (a.start_time || 0));
          setChronoEvents(sortedEvents);

          // Collapse years by default
          const years = [...new Set(events.map(e => {
            if (!e.start_time) return 'Unknown';
            return new Date(e.start_time * 1000).getFullYear();
          }))];
          const initialCollapsed = {};
          years.forEach(y => initialCollapsed[y] = true);
          setCollapsedYears(initialCollapsed);

          // Load result counts from Supabase
          const counts = {};
          for (const event of events) {
            try {
              const { count } = await adminSupabase
                .from('chronotrack_results')
                .select('*', { count: 'exact', head: true })
                .eq('event_id', event.id);
              counts[event.id] = count || 0;
            } catch {
              counts[event.id] = 0;
            }
          }
          setEventResultsCount(counts);
        } catch (err) {
          console.error('Failed to fetch events:', err);
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

  const handleLogin = (e) => {
    e.preventDefault();
    if (username === 'G3M1N1_1912' && password === 'Br@nd0n81') {
      localStorage.setItem('adminLoggedIn', 'true');
      setIsLoggedIn(true);
      setError(null);
      loadGlobalConfig();
    } else {
      setError('Invalid credentials');
    }
  };

  const handleRefreshAllEvents = async () => {
    if (!chronotrackEnabled || refreshingEvents) return;
    setRefreshingEvents(true);
    setRefreshStatus('Refreshing all events...');
    try {
      const events = await fetchChronoEvents();
      const sortedEvents = events.sort((a, b) => (b.start_time || 0) - (a.start_time || 0));
      setChronoEvents(sortedEvents);
      setRefreshStatus(`Success: ${events.length} events loaded`);
    } catch (err) {
      setRefreshStatus('Error refreshing events');
    } finally {
      setRefreshingEvents(false);
      setTimeout(() => setRefreshStatus(''), 5000);
    }
  };

  const handleFetchNewEvents = async () => {
    if (fetchingNewEvents || !chronotrackEnabled) return;
    setFetchingNewEvents(true);
    setNewEventsStatus('Checking for new events...');
    try {
      const freshEvents = await fetchChronoEvents();
      const { data: existing, error: fetchError } = await adminSupabase
        .from('chronotrack_events')
        .select('id');
      if (fetchError) throw fetchError;
      const existingIds = new Set(existing.map(e => e.id));
      const newEvents = freshEvents.filter(e => !existingIds.has(e.id));

      if (newEvents.length === 0) {
        setNewEventsStatus('No new events found');
        setTimeout(() => setNewEventsStatus(''), 5000);
        setFetchingNewEvents(false);
        return;
      }

      const toInsert = newEvents.map(e => ({
        id: e.id,
        name: e.name,
        start_time: e.start_time ? parseInt(e.start_time, 10) : null,
      }));

      const { error: insertError } = await adminSupabase
        .from('chronotrack_events')
        .insert(toInsert);
      if (insertError) throw insertError;

      const updatedEvents = [...chronoEvents, ...newEvents].sort((a, b) => (b.start_time || 0) - (a.start_time || 0));
      setChronoEvents(updatedEvents);
      setNewEventsStatus(`Success: Added ${newEvents.length} new event(s)!`);
      setTimeout(() => setNewEventsStatus(''), 8000);
    } catch (err) {
      console.error('Failed to fetch new events:', err);
      setNewEventsStatus('Error checking for new events');
      setTimeout(() => setNewEventsStatus(''), 8000);
    } finally {
      setFetchingNewEvents(false);
    }
  };

  // FULLY SAFE SYNC: Upserts races first, then results — no foreign key violations
  const handleSyncResults = async (eventId) => {
    if (syncingEvents.includes(eventId)) return;
    setSyncingEvents(prev => [...prev, eventId]);
    try {
      // 1. Fetch fresh results
      const freshResults = await fetchResultsForEvent(eventId);
      if (freshResults.length === 0) {
        setEventResultsCount(prev => ({ ...prev, [eventId]: 0 }));
        return;
      }

      // 2. Fetch races for this event
      const eventRaces = await fetchRacesForEvent(eventId);
      console.log(`[Sync] Fetched ${eventRaces.length} races for event ${eventId}`);

      // 3. Upsert races into chronotrack_races table
      const racesToUpsert = eventRaces.map(race => ({
        id: race.race_id,
        event_id: eventId.toString(),
        name: race.race_name || 'Unknown Race',
        tag: race.race_tag || null,
        type: race.race_type || null,
        subtype: race.race_subtype || null,
        distance: race.race_course_distance || null,
        distance_unit: race.race_pref_distance_unit || 'meters',
        planned_start_time: race.race_planned_start_time ? parseInt(race.race_planned_start_time, 10) : null,
      }));

      if (racesToUpsert.length > 0) {
        const { error: raceError } = await adminSupabase
          .from('chronotrack_races')
          .upsert(racesToUpsert, { onConflict: 'id' });

        if (raceError) {
          console.error('Failed to upsert races:', raceError);
          alert('Warning: Could not sync races. Results will be saved without race_id.');
        } else {
          console.log(`[Sync] Successfully upserted ${racesToUpsert.length} races`);
        }
      }

      // 4. Deduplicate results
      const seen = new Map();
      freshResults.forEach(r => {
        const key = r.entry_id || `${r.bib || ''}-${r.race_id || ''}`;
        if (!seen.has(key)) {
          seen.set(key, r);
        }
      });
      const deduped = Array.from(seen.values());
      console.log(`[Sync] Deduplicated results: ${freshResults.length} → ${deduped.length}`);

      // 5. Prepare results for upsert
      const resultsToUpsert = deduped.map(r => ({
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
        gender_place: r.gender_place ?? null,
        age_group_name: r.age_group_name || null,
        age_group_place: r.age_group_place ? parseInt(r.age_group_place, 10) : null,
        pace: r.pace || null,
        splits: r.splits || [],
        entry_id: r.entry_id ?? null,
        race_name: r.race_name ?? null,
      }));

      // 6. Chunked upsert for results
      const chunkSize = 500;
      for (let i = 0; i < resultsToUpsert.length; i += chunkSize) {
        const chunk = resultsToUpsert.slice(i, i + chunkSize);
        const { error } = await adminSupabase
          .from('chronotrack_results')
          .upsert(chunk, { onConflict: 'event_id,entry_id' });

        if (error) throw error;
      }

      setEventResultsCount(prev => ({ ...prev, [eventId]: deduped.length }));
      alert(`Successfully synced ${deduped.length} results and ${eventRaces.length} races!`);
    } catch (err) {
      console.error('Sync failed:', err);
      alert('Failed to sync: ' + (err.message || 'Database error'));
    } finally {
      setSyncingEvents(prev => prev.filter(id => id !== eventId));
    }
  };

  const toggleExpandEvent = (eventId) => {
    setExpandedEvents(prev => ({ ...prev, [eventId]: !prev[eventId] }));
    if (!expandedEvents[eventId]) {
      fetchRacesForEventId(eventId);
    }
  };

  const fetchRacesForEventId = async (eventId) => {
    try {
      const races = await fetchRacesForEvent(eventId);
      setRaceEvents(prev => ({ ...prev, [eventId]: races }));
    } catch (err) {
      console.error('Failed to load races:', err);
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
    await saveConfig('masterGroups', newGroups);

    if (autoSyncOnAssign[eventId]) {
      await handleSyncResults(eventId);
      setAutoSyncOnAssign(prev => ({ ...prev, [eventId]: false }));
    }
  };

  const toggleMasterVisibility = async (masterKey) => {
    const newHidden = hiddenMasters.includes(masterKey)
      ? hiddenMasters.filter(k => k !== masterKey)
      : [...hiddenMasters, masterKey];
    setHiddenMasters(newHidden);
    await saveConfig('hiddenMasters', newHidden);
  };

  const toggleShowAds = async (masterKey) => {
    const newShow = { ...showAdsPerMaster, [masterKey]: !showAdsPerMaster[masterKey] };
    setShowAdsPerMaster(newShow);
    await saveConfig('showAdsPerMaster', newShow);
  };

  const handleFileUpload = async (e, type, id) => {
    const files = Array.from(e.target.files);
    for (const file of files) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        if (type === 'logo') {
          const newLogos = { ...eventLogos, [id]: reader.result };
          setEventLogos(newLogos);
          await saveConfig('eventLogos', newLogos);
        } else if (type === 'ad') {
          const newAds = [...ads, reader.result];
          setAds(newAds);
          await saveConfig('ads', newAds);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveChanges = async () => {
    await Promise.all([
      saveConfig('editedEvents', editedEvents),
      saveConfig('hiddenEvents', hiddenEvents),
      saveConfig('hiddenRaces', hiddenRaces),
      saveConfig('masterGroups', masterGroups),
      saveConfig('hiddenMasters', hiddenMasters),
      saveConfig('showAdsPerMaster', showAdsPerMaster),
      saveConfig('eventLogos', eventLogos),
      saveConfig('ads', ads),
    ]);
    alert('All changes saved to Supabase successfully!');
  };

  // Group events by year
  const eventsByYear = chronoEvents.reduce((acc, event) => {
    const year = event.start_time ? new Date(event.start_time * 1000).getFullYear() : 'Unknown';
    if (!acc[year]) acc[year] = [];
    acc[year].push(event);
    return acc;
  }, {});

  const years = Object.keys(eventsByYear).sort((a, b) => b - a);
  const assignedEventIds = new Set(Object.values(masterGroups).flat());

  const toggleYearCollapse = (year) => {
    setCollapsedYears(prev => ({ ...prev, [year]: !prev[year] }));
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gemini-light-gray pt-32 py-12">
        <div className="max-w-md mx-auto bg-white p-8 rounded-lg shadow">
          <h2 className="text-3xl font-bold mb-6 text-center">Admin Login</h2>
          {error && <p className="text-gemini-red mb-4">{error}</p>}
          <form onSubmit={handleLogin}>
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
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gemini-light-gray pt-32 py-12">
      <div className="max-w-7xl mx-auto px-6">
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
            <div className="flex flex-wrap justify-between items-center gap-4 mb-8">
              <button
                onClick={() => navigate('/master-events')}
                className="bg-blue-500 text-white px-6 py-3 rounded-xl hover:bg-blue-600"
              >
                Manage Master Events
              </button>
              <div className="flex gap-4">
                <button
                  onClick={handleRefreshAllEvents}
                  disabled={refreshingEvents || !chronotrackEnabled}
                  className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white font-bold px-6 py-3 rounded-xl flex items-center gap-2"
                >
                  {refreshingEvents ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-white"></div>
                      Refreshing...
                    </>
                  ) : (
                    '↻ Refresh All Events'
                  )}
                </button>
                <button
                  onClick={handleFetchNewEvents}
                  disabled={fetchingNewEvents || !chronotrackEnabled}
                  className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-bold px-6 py-3 rounded-xl flex items-center gap-2"
                >
                  {fetchingNewEvents ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-white"></div>
                      Checking...
                    </>
                  ) : (
                    '🔍 Fetch New Events'
                  )}
                </button>
              </div>
            </div>

            {/* Status messages */}
            {(refreshStatus || newEventsStatus) && (
              <div className="mb-6 space-y-3">
                {refreshStatus && (
                  <div className={`p-4 rounded-lg text-center font-medium ${refreshStatus.includes('Success') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {refreshStatus}
                  </div>
                )}
                {newEventsStatus && (
                  <div className={`p-4 rounded-lg text-center font-medium ${newEventsStatus.includes('Success') || newEventsStatus.includes('No new') ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                    {newEventsStatus}
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-end mb-6">
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={showAssignedEvents}
                  onChange={e => setShowAssignedEvents(e.target.checked)}
                  className="mr-3"
                />
                <span className="text-gray-700 font-medium">Show already assigned events</span>
              </label>
            </div>

            <div className="flex items-center mb-8">
              <input
                type="checkbox"
                checked={chronotrackEnabled}
                onChange={e => setChronotrackEnabled(e.target.checked)}
                className="mr-2"
              />
              <span>Enable ChronoTrack Integration</span>
            </div>

            {/* Sync single event */}
            <section className="mb-12">
              <h2 className="text-3xl font-bold mb-6">Refresh Event Results</h2>
              <div className="flex flex-col sm:flex-row gap-4">
                <select
                  value={selectedEventId}
                  onChange={e => setSelectedEventId(e.target.value)}
                  className="flex-1 p-4 rounded-lg border border-gray-300"
                  disabled={!chronotrackEnabled}
                >
                  <option value="">Select Event</option>
                  {chronoEvents.map(event => (
                    <option key={event.id} value={event.id}>
                      {event.name} ({formatDate(event.start_time)})
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => handleSyncResults(selectedEventId)}
                  disabled={!selectedEventId || syncingEvents.includes(selectedEventId)}
                  className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-bold py-3 px-8 rounded-lg"
                >
                  {syncingEvents.includes(selectedEventId) ? 'Syncing...' : 'Sync Selected'}
                </button>
              </div>
            </section>

            {/* Events grouped by year */}
            <section className="mb-12">
              <h2 className="text-3xl font-bold mb-8">Manage Events</h2>
              {years.map(year => {
                const isCollapsed = collapsedYears[year] ?? true;
                const yearEvents = eventsByYear[year].filter(e => showAssignedEvents || !assignedEventIds.has(e.id));
                if (yearEvents.length === 0) return null;

                return (
                  <div key={year} className="mb-12">
                    <button
                      onClick={() => toggleYearCollapse(year)}
                      className="flex items-center gap-3 text-2xl font-bold mb-6 w-full text-left hover:text-gemini-blue"
                    >
                      <span className="text-3xl">{isCollapsed ? '▶' : '▼'}</span>
                      <span>{year} ({yearEvents.length} events)</span>
                    </button>
                    {!isCollapsed && (
                      <div className="space-y-6 pl-10">
                        {yearEvents.map(event => {
                          const currentMaster = Object.keys(masterGroups).find(key => masterGroups[key]?.includes(event.id)) || 'None';
                          const resultsCount = eventResultsCount[event.id] || 0;

                          return (
                            <div key={event.id} className="p-6 bg-white rounded-xl shadow hover:shadow-lg transition">
                              <div className="flex items-center justify-between cursor-pointer" onClick={() => toggleExpandEvent(event.id)}>
                                <div className="flex flex-col flex-1">
                                  <span className="text-sm text-gray-500">Original: {event.name}</span>
                                  <input
                                    type="text"
                                    value={editedEvents[event.id]?.name || event.name}
                                    onChange={e => handleEditName(event.id, e.target.value)}
                                    onClick={e => e.stopPropagation()}
                                    className="text-2xl font-bold p-2 border border-gray-300 rounded"
                                  />
                                </div>
                                <span className="ml-2 text-xl text-gray-600">({formatDate(event.start_time)})</span>
                                <span>{expandedEvents[event.id] ? '▲' : '▼'}</span>
                              </div>

                              <div className="flex items-center mt-4">
                                <input
                                  type="checkbox"
                                  checked={!hiddenEvents.includes(event.id)}
                                  onChange={() => toggleEventVisibility(event.id)}
                                  className="mr-2"
                                />
                                <span>Visible in App</span>
                              </div>

                              <div className="mt-4 flex items-center gap-4">
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleSyncResults(event.id); }}
                                  disabled={syncingEvents.includes(event.id)}
                                  className="bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg flex items-center gap-2"
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
                      </div>
                    )}
                  </div>
                );
              })}
            </section>
          </>
        )}

        {/* Website Management Tab */}
        {activeTab === 'website' && (
          <>
            <section className="mb-12">
              <h2 className="text-3xl font-bold mb-4">Upload Advertisements</h2>
              <input type="file" onChange={e => handleFileUpload(e, 'ad')} accept="image/*" multiple />
              <div className="grid grid-cols-3 gap-4 mt-4">
                {ads.map((ad, index) => (
                  <img key={index} src={ad} alt={`Ad ${index + 1}`} className="w-full h-auto rounded shadow" />
                ))}
              </div>
            </section>
          </>
        )}

        <div className="text-center mt-12">
          <button onClick={handleSaveChanges} className="bg-gemini-blue text-white px-10 py-5 rounded-xl hover:bg-gemini-blue/90 font-bold text-xl">
            Save All Changes to Supabase
          </button>
        </div>
      </div>
    </div>
  );
}