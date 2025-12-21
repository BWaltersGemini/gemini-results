// src/pages/AdminPage.jsx (FULL & COMPLETE — With Per-Event Live Auto-Fetch Toggle)
import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchEvents as fetchChronoEvents, fetchResultsForEvent } from '../api/chronotrackapi';
import { supabase } from '../supabaseClient';
import { createAdminSupabaseClient } from '../supabaseClient';
import { loadAppConfig } from '../utils/appConfig';
import { RaceContext } from '../context/RaceContext';
import axios from 'axios';

export default function AdminPage() {
  const navigate = useNavigate();
  const { refreshResults } = useContext(RaceContext);

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);

  const [editedEvents, setEditedEvents] = useState({});
  const [masterGroups, setMasterGroups] = useState({});
  const [hiddenRaces, setHiddenRaces] = useState({});
  const [hiddenMasters, setHiddenMasters] = useState([]);
  const [showAdsPerMaster, setShowAdsPerMaster] = useState({});
  const [eventLogos, setEventLogos] = useState({});
  const [ads, setAds] = useState([]);

  const [expandedEvents, setExpandedEvents] = useState({});
  const [chronoEvents, setChronoEvents] = useState([]);
  const [participantCounts, setParticipantCounts] = useState({});
  const [refreshingEvent, setRefreshingEvent] = useState(null);
  const [fetchingEvents, setFetchingEvents] = useState(false);
  const [updatingEndTime, setUpdatingEndTime] = useState(null);
  const [publishingAll, setPublishingAll] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });
  const [activeTab, setActiveTab] = useState('events');
  const [newMasterKeys, setNewMasterKeys] = useState({});
  const [saveStatus, setSaveStatus] = useState('');
  const [hideMasteredEvents, setHideMasteredEvents] = useState(true);

  // NEW: Per-event live auto-fetch toggle (default ON)
  const [liveAutoFetchPerEvent, setLiveAutoFetchPerEvent] = useState({});

  const adminSupabase = createAdminSupabaseClient();

  const loadGlobalConfig = async () => {
    const config = await loadAppConfig();
    setMasterGroups(config.masterGroups || {});
    setEditedEvents(config.editedEvents || {});
    setEventLogos(config.eventLogos || {});
    setHiddenMasters(config.hiddenMasters || []);
    setShowAdsPerMaster(config.showAdsPerMaster || {});
    setAds(config.ads || []);
    setHiddenRaces(config.hiddenRaces || {});

    // Load per-event live auto-fetch settings — defaults to true if not set
    setLiveAutoFetchPerEvent(config.liveAutoFetchPerEvent || {});
  };

  const autoSaveConfig = async (key, value) => {
    try {
      const { error } = await adminSupabase
        .from('app_config')
        .upsert({ key, value }, { onConflict: 'key' });
      if (error) throw error;
      setSaveStatus(`${key === 'masterGroups' ? 'Master links' : key === 'eventLogos' ? 'Logo' : 'Config'} saved`);
      setTimeout(() => setSaveStatus(''), 4000);
    } catch (err) {
      console.error(`Auto-save failed for ${key}:`, err);
      setSaveStatus('Auto-save failed');
      setTimeout(() => setSaveStatus(''), 6000);
    }
  };

  const saveAllChanges = async () => {
    try {
      await Promise.all([
        autoSaveConfig('masterGroups', masterGroups),
        autoSaveConfig('editedEvents', editedEvents),
        autoSaveConfig('eventLogos', eventLogos),
        autoSaveConfig('hiddenMasters', hiddenMasters),
        autoSaveConfig('showAdsPerMaster', showAdsPerMaster),
        autoSaveConfig('ads', ads),
        autoSaveConfig('hiddenRaces', hiddenRaces),
        autoSaveConfig('liveAutoFetchPerEvent', liveAutoFetchPerEvent),
      ]);
      setSaveStatus('All changes saved!');
      setTimeout(() => setSaveStatus(''), 4000);
    } catch {
      setSaveStatus('Bulk save failed');
    }
  };

  useEffect(() => {
    const loggedIn = localStorage.getItem('adminLoggedIn') === 'true';
    setIsLoggedIn(loggedIn);
    if (loggedIn) loadGlobalConfig();
  }, []);

  useEffect(() => {
    if (!isLoggedIn) return;
    const loadCachedData = async () => {
      try {
        const { data: cachedEvents, error: eventsError } = await supabase
          .from('chronotrack_events')
          .select('*')
          .order('start_time', { ascending: false });
        if (eventsError) throw eventsError;
        setChronoEvents(cachedEvents || []);
        const counts = {};
        for (const event of cachedEvents || []) {
          const { count: adminCount, error: countError } = await adminSupabase
            .from('chronotrack_results')
            .select('id', { count: 'exact', head: true })
            .eq('event_id', event.id);
          counts[event.id] = countError ? 0 : (adminCount || 0);
        }
        setParticipantCounts(counts);
      } catch (err) {
        console.error('[Admin] Failed to load cached data:', err);
        setChronoEvents([]);
      }
    };
    loadCachedData();
  }, [isLoggedIn]);

  const getAuthHeader = async () => {
    const clientId = import.meta.env.VITE_CHRONOTRACK_CLIENT_ID;
    const clientSecret = import.meta.env.VITE_CHRONOTRACK_SECRET;
    const username = import.meta.env.VITE_CHRONOTRACK_USER;
    const password = import.meta.env.VITE_CHRONOTRACK_PASS;
    const basicAuth = btoa(`${clientId}:${clientSecret}`);
    const tokenRes = await axios.get('/chrono-api/oauth2/token', {
      headers: { Authorization: `Basic ${basicAuth}` },
      params: { grant_type: 'password', username, password },
    });
    return `Bearer ${tokenRes.data.access_token}`;
  };

  const fetchLatestFromChronoTrack = async () => {
    setFetchingEvents(true);
    try {
      const freshEvents = await fetchChronoEvents();
      const sorted = freshEvents.sort((a, b) => (b.start_time || 0) - (a.start_time || 0));
      const authHeader = await getAuthHeader();
      const updatedEvents = [];
      let endTimeSuccess = 0;
      let endTimeFail = 0;
      for (const event of sorted) {
        let endTime = null;
        try {
          const response = await axios.get(`/chrono-api/api/event/${event.id}`, {
            headers: { Authorization: authHeader },
            params: { client_id: import.meta.env.VITE_CHRONOTRACK_CLIENT_ID },
          });
          const eventData = response.data.event;
          if (eventData?.event_end_time) {
            endTime = parseInt(eventData.event_end_time, 10);
            endTimeSuccess++;
          } else {
            endTimeFail++;
          }
        } catch (err) {
          console.warn(`Failed to fetch end_time for event ${event.id}`, err);
          endTimeFail++;
        }
        updatedEvents.push({
          id: event.id,
          name: event.name,
          start_time: event.start_time,
          event_end_time: endTime,
          races: event.races || [],
        });
      }
      const { error } = await adminSupabase
        .from('chronotrack_events')
        .upsert(updatedEvents, { onConflict: 'id' });
      if (error) throw error;
      setChronoEvents(updatedEvents);
      setSaveStatus(`Events refreshed! End times: ${endTimeSuccess} fetched, ${endTimeFail} missing`);
      setTimeout(() => setSaveStatus(''), 6000);
    } catch (err) {
      console.error('[Admin] Refresh failed:', err);
      setSaveStatus('Refresh failed');
      setTimeout(() => setSaveStatus(''), 6000);
    } finally {
      setFetchingEvents(false);
    }
  };

  const updateEndTimeForEvent = async (eventId) => {
    setUpdatingEndTime(eventId);
    try {
      const authHeader = await getAuthHeader();
      const response = await axios.get(`/chrono-api/api/event/${eventId}`, {
        headers: { Authorization: authHeader },
        params: { client_id: import.meta.env.VITE_CHRONOTRACK_CLIENT_ID },
      });
      const eventData = response.data.event;
      if (eventData?.event_end_time) {
        const endTime = parseInt(eventData.event_end_time, 10);
        const { error } = await adminSupabase
          .from('chronotrack_events')
          .update({ event_end_time: endTime })
          .eq('id', eventId);
        if (error) throw error;
        setChronoEvents(prev => prev.map(e => e.id === eventId ? { ...e, event_end_time: endTime } : e));
        setSaveStatus(`End time updated for event ${eventId}`);
        setTimeout(() => setSaveStatus(''), 4000);
      } else {
        setSaveStatus(`No end time available for event ${eventId}`);
        setTimeout(() => setSaveStatus(''), 4000);
      }
    } catch (err) {
      console.error(`[Admin] Failed to update end_time for event ${eventId}`, err);
      setSaveStatus('Update failed');
      setTimeout(() => setSaveStatus(''), 6000);
    } finally {
      setUpdatingEndTime(null);
    }
  };

  const publishAllEvents = async () => {
    if (!confirm(`Publish results for ALL ${chronoEvents.length} events? This may take several minutes.`)) return;
    setPublishingAll(true);
    setBulkProgress({ current: 0, total: chronoEvents.length });
    let successCount = 0;
    let failCount = 0;
    for (let i = 0; i < chronoEvents.length; i++) {
      const event = chronoEvents[i];
      try {
        await refreshAndPublishResults(event.id);
        successCount++;
      } catch (err) {
        console.error(`Failed to publish event ${event.id} (${event.name}):`, err);
        failCount++;
      }
      setBulkProgress({ current: i + 1, total: chronoEvents.length });
    }
    setPublishingAll(false);
    setSaveStatus(`Bulk publish complete: ${successCount} succeeded, ${failCount} failed`);
    setTimeout(() => setSaveStatus(''), 8000);
    if (refreshResults) refreshResults();
  };

  const formatDateTime = (epoch) => {
    if (!epoch || isNaN(epoch)) return 'Not set';
    const date = new Date(epoch * 1000);
    return date.toLocaleString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatDate = (epoch) => {
    if (!epoch) return 'Date TBD';
    const date = new Date(epoch * 1000);
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  const getCurrentMasterForEvent = (eventId) => {
    for (const [masterKey, eventIds] of Object.entries(masterGroups)) {
      if (eventIds.includes(eventId.toString())) return masterKey;
    }
    return null;
  };

  const assignToMaster = async (eventId, masterKey) => {
    if (!masterKey) return;
    const updated = { ...masterGroups };
    Object.keys(updated).forEach(key => {
      updated[key] = updated[key].filter(id => id !== eventId.toString());
      if (updated[key].length === 0) delete updated[key];
    });
    if (!updated[masterKey]) updated[masterKey] = [];
    if (!updated[masterKey].includes(eventId.toString())) {
      updated[masterKey].push(eventId.toString());
    }
    setMasterGroups(updated);
    setNewMasterKeys(prev => ({ ...prev, [eventId]: '' }));
    await autoSaveConfig('masterGroups', updated);
  };

  const unlinkFromMaster = async (eventId) => {
    const updated = { ...masterGroups };
    let changed = false;
    Object.keys(updated).forEach(key => {
      const filtered = updated[key].filter(id => id !== eventId.toString());
      if (filtered.length !== updated[key].length) {
        changed = true;
        updated[key] = filtered;
        if (updated[key].length === 0) delete updated[key];
      }
    });
    if (changed) {
      setMasterGroups(updated);
      await autoSaveConfig('masterGroups', updated);
    }
  };

  const toggleEventExpansion = (eventId) => {
    setExpandedEvents(prev => ({ ...prev, [eventId]: !prev[eventId] }));
  };

  const handleEditEventName = (eventId, name) => {
    setEditedEvents(prev => ({
      ...prev,
      [eventId]: { ...(prev[eventId] || {}), name }
    }));
  };

  const handleEditRaceName = (eventId, raceId, name) => {
    setEditedEvents(prev => ({
      ...prev,
      [eventId]: {
        ...(prev[eventId] || {}),
        races: {
          ...(prev[eventId]?.races || {}),
          [raceId]: name
        }
      }
    }));
  };

  const toggleRaceVisibility = (eventId, raceId) => {
    setHiddenRaces(prev => {
      const current = prev[eventId] || [];
      if (current.includes(raceId)) {
        return { ...prev, [eventId]: current.filter(id => id !== raceId) };
      } else {
        return { ...prev, [eventId]: [...current, raceId] };
      }
    });
  };

  const handleLogoUpload = async (e, masterKey) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const { data, error: uploadError } = await adminSupabase.storage
        .from('logos')
        .upload(`public/${masterKey}`, file, {
          upsert: true,
          contentType: file.type,
        });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = adminSupabase.storage
        .from('logos')
        .getPublicUrl(`public/${masterKey}`);
      const updatedLogos = { ...eventLogos, [masterKey]: publicUrl };
      setEventLogos(updatedLogos);
      await autoSaveConfig('eventLogos', updatedLogos);
      setSaveStatus('Master logo uploaded!');
      setTimeout(() => setSaveStatus(''), 4000);
    } catch (err) {
      console.error('Logo upload failed:', err);
      setSaveStatus('Logo upload failed');
      setTimeout(() => setSaveStatus(''), 6000);
    }
  };

  const handleRemoveLogo = async (masterKey) => {
    try {
      const { error } = await adminSupabase.storage
        .from('logos')
        .remove([`public/${masterKey}`]);
      if (error && error.message !== 'Object not found') throw error;
      const updatedLogos = { ...eventLogos };
      delete updatedLogos[masterKey];
      setEventLogos(updatedLogos);
      await autoSaveConfig('eventLogos', updatedLogos);
      setSaveStatus('Master logo removed');
      setTimeout(() => setSaveStatus(''), 4000);
    } catch (err) {
      console.error('Logo removal failed:', err);
      setSaveStatus('Logo removal failed');
      setTimeout(() => setSaveStatus(''), 6000);
    }
  };

  const handleDeleteMaster = async (masterKey) => {
    if (!confirm(`Delete master event "${masterKey}"? This will unlink all events and remove its logo.`)) return;
    try {
      const updatedGroups = { ...masterGroups };
      delete updatedGroups[masterKey];
      setMasterGroups(updatedGroups);
      await autoSaveConfig('masterGroups', updatedGroups);
      await handleRemoveLogo(masterKey);
      setSaveStatus(`Master "${masterKey}" deleted`);
      setTimeout(() => setSaveStatus(''), 5000);
    } catch (err) {
      console.error('Delete master failed:', err);
      setSaveStatus('Delete failed');
      setTimeout(() => setSaveStatus(''), 6000);
    }
  };

  const refreshAndPublishResults = async (eventId) => {
    setRefreshingEvent(eventId);
    try {
      const fresh = await fetchResultsForEvent(eventId);
      if (fresh.length === 0) {
        console.log(`No results for event ${eventId}`);
        return;
      }
      const seen = new Map();
      fresh.forEach(r => {
        const key = r.entry_id || `${r.bib || ''}-${r.race_id || ''}`;
        if (!seen.has(key)) seen.set(key, r);
      });
      const deduped = Array.from(seen.values());
      const toUpsert = deduped.map(r => ({
        event_id: eventId,
        race_id: r.race_id || null,
        bib: r.bib || null,
        first_name: r.first_name || null,
        last_name: r.last_name || null,
        gender: r.gender || null,
        age: r.age ?? null,
        city: r.city || null,
        state: r.state || null,
        country: r.country || null,
        chip_time: r.chip_time || null,
        clock_time: r.clock_time || null,
        place: r.place ?? null,
        gender_place: r.gender_place ?? null,
        age_group_name: r.age_group_name || null,
        age_group_place: r.age_group_place ?? null,
        pace: r.pace || null,
        splits: r.splits || [],
        entry_id: r.entry_id ?? null,
        race_name: r.race_name ?? null,
      }));
      const { error } = await adminSupabase
        .from('chronotrack_results')
        .upsert(toUpsert, { onConflict: 'event_id,entry_id' });
      if (error) throw error;
      setParticipantCounts(prev => ({ ...prev, [eventId]: deduped.length }));
    } catch (err) {
      console.error('[Admin] Publish failed:', err);
      throw err;
    } finally {
      setRefreshingEvent(null);
    }
  };

  const handleDeleteEvent = async (eventId, eventName) => {
    if (!confirm(`PERMANENTLY delete event "${eventName}" (ID: ${eventId}) and ALL its results? This cannot be undone.`)) {
      return;
    }
    try {
      const { error: resultsError } = await adminSupabase
        .from('chronotrack_results')
        .delete()
        .eq('event_id', eventId);
      if (resultsError) throw resultsError;
      const { error: eventError } = await adminSupabase
        .from('chronotrack_events')
        .delete()
        .eq('id', eventId);
      if (eventError) throw eventError;
      setChronoEvents(prev => prev.filter(e => e.id !== eventId));
      setParticipantCounts(prev => {
        const copy = { ...prev };
        delete copy[eventId];
        return copy;
      });
      setSaveStatus(`Event "${eventName}" and its results permanently deleted`);
      setTimeout(() => setSaveStatus(''), 6000);
    } catch (err) {
      console.error('[Admin] Event deletion failed:', err);
      setSaveStatus('Deletion failed — see console');
      setTimeout(() => setSaveStatus(''), 8000);
    }
  };

  const handleFileUpload = async (e, type) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    const urls = [];
    for (const file of files) {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', type);
      try {
        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData
        });
        const data = await res.json();
        if (data.url) urls.push(data.url);
      } catch (err) {
        console.error('Upload failed:', err);
      }
    }
    if (type === 'ad') {
      setAds(prev => [...prev, ...urls]);
    }
  };

  // Toggle per-event live auto-fetch
  const toggleLiveAutoFetch = (eventId) => {
    setLiveAutoFetchPerEvent(prev => ({
      ...prev,
      [eventId]: !prev[eventId],
    }));
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
          <h1 className="text-3xl font-bold text-center text-gemini-dark-gray mb-8">Admin Login</h1>
          {error && <p className="text-red-600 text-center mb-4">{error}</p>}
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full p-4 border border-gray-300 rounded-xl mb-4"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-4 border border-gray-300 rounded-xl mb-6"
          />
          <button
            onClick={() => {
              if (username === 'admin' && password === 'gemini2025') {
                localStorage.setItem('adminLoggedIn', 'true');
                setIsLoggedIn(true);
              } else {
                setError('Invalid credentials');
              }
            }}
            className="w-full bg-gemini-blue text-white py-4 rounded-xl font-bold hover:bg-gemini-blue/90 transition"
          >
            Login
          </button>
        </div>
      </div>
    );
  }

  const displayedEvents = hideMasteredEvents
    ? chronoEvents.filter(event => !getCurrentMasterForEvent(event.id))
    : chronoEvents;

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-12">
          <h1 className="text-4xl font-bold text-gemini-dark-gray">Admin Dashboard</h1>
          <button
            onClick={() => {
              localStorage.removeItem('adminLoggedIn');
              setIsLoggedIn(false);
            }}
            className="px-6 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition"
          >
            Logout
          </button>
        </div>

        {saveStatus && (
          <div className="fixed top-24 right-8 z-50 bg-gemini-blue text-white px-8 py-4 rounded-2xl shadow-2xl animate-pulse text-lg font-semibold">
            {saveStatus}
          </div>
        )}

        <div className="flex space-x-1 mb-8 bg-gray-100 p-1 rounded-xl w-fit">
          <button
            onClick={() => setActiveTab('events')}
            className={`px-8 py-3 rounded-lg font-semibold transition ${activeTab === 'events' ? 'bg-gemini-blue text-white' : 'text-gray-600 hover:bg-gray-200'}`}
          >
            Events & Masters
          </button>
          <button
            onClick={() => setActiveTab('website')}
            className={`px-8 py-3 rounded-lg font-semibold transition ${activeTab === 'website' ? 'bg-gemini-blue text-white' : 'text-gray-600 hover:bg-gray-200'}`}
          >
            Website
          </button>
        </div>

        {activeTab === 'events' && (
          <section className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <h2 className="text-3xl font-bold text-gemini-dark-gray">
                ChronoTrack Events ({displayedEvents.length} shown of {chronoEvents.length})
              </h2>
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hideMasteredEvents}
                    onChange={(e) => setHideMasteredEvents(e.target.checked)}
                    className="h-5 w-5 text-gemini-blue rounded"
                  />
                  <span className="text-gray-700 font-medium">Hide Events with Masters</span>
                </label>

                <button
                  onClick={fetchLatestFromChronoTrack}
                  disabled={fetchingEvents}
                  className="px-6 py-3 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 disabled:opacity-50 transition"
                >
                  {fetchingEvents ? 'Refreshing...' : 'Refresh Events & End Times'}
                </button>

                <button
                  onClick={publishAllEvents}
                  disabled={publishingAll}
                  className="px-6 py-3 bg-orange-600 text-white font-bold rounded-xl hover:bg-orange-700 disabled:opacity-50 transition"
                >
                  {publishingAll
                    ? `Publishing... (${bulkProgress.current}/${bulkProgress.total})`
                    : 'Publish ALL Results'}
                </button>
              </div>
            </div>

            {displayedEvents.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-2xl shadow">
                <p className="text-xl text-gray-600">
                  {hideMasteredEvents
                    ? 'All events assigned to masters or no events available.'
                    : 'No events cached yet.'}
                </p>
                <p className="text-gray-500 mt-2">Click "Refresh Events & End Times" to load from ChronoTrack.</p>
              </div>
            ) : (
              displayedEvents.map((event) => {
                const currentMaster = getCurrentMasterForEvent(event.id);
                const displayName = editedEvents[event.id]?.name || event.name;
                const count = participantCounts[event.id] || 0;

                // Per-event live auto-fetch status — default ON
                const now = Math.floor(Date.now() / 1000);
                const startTime = event.start_time ? parseInt(event.start_time, 10) : null;
		const endTime = event.event_end_time ? parseInt(event.event_end_time, 10) : null;

		const isRaceWindowActive = startTime && endTime && now >= startTime && now <= endTime;
		const isRaceDayToday = !endTime && startTime
  		  ? new Date(startTime * 1000).toISOString().split('T')[0] === new Date().toISOString().split('T')[0]
  		  : false;

		const isCurrentlyLive = isRaceWindowActive || isRaceDayToday;

		// Auto-disable if race is over AND admin hasn't manually overridden
		const isAutoFetchEnabled = isCurrentlyLive 
  		  ? (liveAutoFetchPerEvent[event.id] !== false) // default ON during race
  		  : false; // force OFF after race ends

                return (
                  <div key={event.id} className="bg-white rounded-2xl shadow-lg overflow-hidden">
                    <div
                      className="p-6 cursor-pointer hover:bg-gemini-blue/5 transition flex justify-between items-center"
                      onClick={() => toggleEventExpansion(event.id)}
                    >
                      <div>
                        <h3 className="text-2xl font-bold text-gemini-dark-gray">
                          {displayName}
                        </h3>
                        <p className="text-gray-600 mt-2 flex flex-wrap items-center gap-4">
                          <span>
                            <strong>Start:</strong> {formatDateTime(event.start_time)}
                          </span>
                          <span className="flex items-center gap-2">
                            <strong>End:</strong> {formatDateTime(event.event_end_time)}
                            {!event.event_end_time && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateEndTimeForEvent(event.id);
                                }}
                                disabled={updatingEndTime === event.id}
                                className="px-4 py-1 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 disabled:opacity-50 transition"
                              >
                                {updatingEndTime === event.id ? 'Updating...' : 'Update End Time'}
                              </button>
                            )}
                          </span>
                        </p>
                        <p className="text-gray-600 mt-1">
                          ID: {event.id} • <strong>{count} participants published</strong>
                        </p>
                        {currentMaster && (
                          <p className="text-sm text-gemini-blue font-medium mt-2">
                            Master: {currentMaster}
                          </p>
                        )}
                      </div>
                      <span className="text-2xl text-gray-400">{expandedEvents[event.id] ? '−' : '+'}</span>
                    </div>

                    {expandedEvents[event.id] && (
                      <div className="px-6 pb-6 border-t border-gray-200">
                        {currentMaster && (
                          <div className="mb-8 p-6 bg-gradient-to-r from-gemini-blue/10 to-gemini-blue/5 rounded-xl border border-gemini-blue/30">
                            <div className="flex justify-between items-center mb-6">
                              <h4 className="text-xl font-bold text-gemini-dark-gray">
                                Master Event: <span className="text-gemini-blue">{currentMaster}</span>
                              </h4>
                              <button
                                onClick={() => handleDeleteMaster(currentMaster)}
                                className="px-6 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 font-medium transition"
                              >
                                Delete Master
                              </button>
                            </div>
                            <div className="mb-6">
                              <h5 className="text-lg font-semibold text-gray-700 mb-3">Master Logo</h5>
                              {eventLogos[currentMaster] ? (
                                <div className="flex items-center gap-6">
                                  <img
                                    src={eventLogos[currentMaster]}
                                    alt="Master Logo"
                                    className="h-32 rounded-lg shadow-md"
                                  />
                                  <button
                                    onClick={() => handleRemoveLogo(currentMaster)}
                                    className="px-6 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 font-medium transition"
                                  >
                                    Remove Logo
                                  </button>
                                </div>
                              ) : (
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => handleLogoUpload(e, currentMaster)}
                                  className="block w-full text-sm text-gray-700 file:mr-4 file:py-3 file:px-6 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-gemini-blue file:text-white hover:file:bg-gemini-blue/90 cursor-pointer"
                                />
                              )}
                            </div>
                            <div>
                              <h5 className="text-lg font-semibold text-gray-700 mb-3">Ads Visibility</h5>
                              <label className="flex items-center gap-4 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={!!showAdsPerMaster[currentMaster]}
                                  onChange={() => {
                                    const updated = { ...showAdsPerMaster, [currentMaster]: !showAdsPerMaster[currentMaster] };
                                    setShowAdsPerMaster(updated);
                                    autoSaveConfig('showAdsPerMaster', updated);
                                  }}
                                  className="h-6 w-6 text-gemini-blue rounded focus:ring-gemini-blue"
                                />
                                <span className="text-lg font-medium text-gray-800">
                                  {showAdsPerMaster[currentMaster] ? 'Show ads' : 'Hide ads'} on this master event
                                </span>
                              </label>
                            </div>
                          </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                          <div>
                            <label className="block text-lg font-semibold text-gray-700 mb-2">Master Event</label>
                            <div className="flex gap-3">
                              <input
                                type="text"
                                list="master-keys"
                                placeholder="Type or select master"
                                value={newMasterKeys[event.id] || ''}
                                onChange={(e) => setNewMasterKeys(prev => ({ ...prev, [event.id]: e.target.value }))}
                                className="flex-1 px-4 py-3 border border-gray-300 rounded-xl"
                              />
                              <datalist id="master-keys">
                                {Object.keys(masterGroups).map(key => (
                                  <option key={key} value={key} />
                                ))}
                              </datalist>
                              <button
                                onClick={() => assignToMaster(event.id, newMasterKeys[event.id] || currentMaster)}
                                className="px-6 py-3 bg-gemini-blue text-white rounded-xl hover:bg-gemini-blue/90 font-medium transition"
                              >
                                Assign
                              </button>
                              {currentMaster && (
                                <button
                                  onClick={() => unlinkFromMaster(event.id)}
                                  className="px-6 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 font-medium transition"
                                >
                                  Unlink
                                </button>
                              )}
                            </div>
                          </div>
                          <div>
                            <label className="block text-lg font-semibold text-gray-700 mb-2">Display Name</label>
                            <input
                              type="text"
                              value={displayName}
                              onChange={(e) => handleEditEventName(event.id, e.target.value)}
                              className="w-full px-4 py-3 border border-gray-300 rounded-xl"
                            />
                          </div>
                        </div>

                        <div className="mt-8 flex flex-col sm:flex-row justify-center items-center gap-6">
                          {/* Per-event Live Auto-Fetch Toggle */}
                          <label className="flex items-center gap-4 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isAutoFetchEnabled}
                              onChange={() => toggleLiveAutoFetch(event.id)}
                              className="h-7 w-7 text-green-600 rounded focus:ring-green-500"
                            />
                            <span className="text-xl font-bold text-gray-800">
                              Live Auto-Fetch {isAutoFetchEnabled ? 'ON' : 'OFF'}
                            </span>
                          </label>

                          <button
                            onClick={() => refreshAndPublishResults(event.id)}
                            disabled={refreshingEvent === event.id}
                            className="px-10 py-4 bg-green-600 text-white text-xl font-bold rounded-xl hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition shadow-lg"
                          >
                            {refreshingEvent === event.id ? 'Publishing...' : 'Refresh & Publish Results'}
                          </button>

                          <button
                            onClick={() => handleDeleteEvent(event.id, displayName)}
                            className="px-10 py-4 bg-red-600 text-white text-xl font-bold rounded-xl hover:bg-red-700 transition shadow-lg"
                          >
                            Delete Event
                          </button>
                        </div>

                        {event.races && event.races.length > 0 && (
                          <div className="mt-8">
                            <h4 className="text-xl font-bold text-gemini-dark-gray mb-4">Races ({event.races.length})</h4>
                            <div className="space-y-3">
                              {event.races.map((race) => (
                                <div key={race.race_id} className="flex items-center justify-between bg-gray-50 p-4 rounded-xl">
                                  <div className="flex items-center gap-4 flex-1">
                                    <input
                                      type="checkbox"
                                      checked={!(hiddenRaces[event.id] || []).includes(race.race_id)}
                                      onChange={() => toggleRaceVisibility(event.id, race.race_id)}
                                      className="h-5 w-5 text-gemini-blue rounded"
                                    />
                                    <input
                                      type="text"
                                      value={editedEvents[event.id]?.races?.[race.race_id] || race.race_name}
                                      onChange={(e) => handleEditRaceName(event.id, race.race_id, e.target.value)}
                                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
                                    />
                                  </div>
                                  {race.distance && (
                                    <span className="text-gray-600 ml-4">
                                      {race.distance} {race.distance_unit || 'm'}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {(!event.races || event.races.length === 0) && (
                          <div className="mt-8 text-center text-gray-500 italic">
                            No races embedded for this event.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </section>
        )}

        {activeTab === 'website' && (
          <section className="space-y-12">
            <h2 className="text-3xl font-bold text-gemini-dark-gray mb-8">Website Management</h2>
            <div className="bg-white rounded-2xl shadow-lg p-8">
              <h3 className="text-2xl font-bold mb-6">Advertisements</h3>
              <input type="file" onChange={(e) => handleFileUpload(e, 'ad')} accept="image/*" multiple className="mb-6" />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {ads.map((ad, i) => (
                  <div key={i} className="rounded-xl overflow-hidden shadow-md hover:shadow-xl transition">
                    <img src={ad} alt={`Ad ${i + 1}`} className="w-full h-48 object-cover" />
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        <div className="text-center mt-16">
          <button
            onClick={saveAllChanges}
            className="px-16 py-6 bg-gemini-blue text-white text-2xl font-bold rounded-full hover:bg-gemini-blue/90 shadow-2xl transition transform hover:scale-105"
          >
            Save All Other Changes to Supabase
          </button>
        </div>
      </div>
    </div>
  );
}