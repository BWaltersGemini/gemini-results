// src/pages/AdminPage.jsx (FINAL COMPLETE — Auto-save on Publish & Master Changes + Supabase-first Load)
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchEvents as fetchChronoEvents, fetchResultsForEvent } from '../api/chronotrackapi';
import { supabase } from '../supabaseClient';
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
  const [activeTab, setActiveTab] = useState('events');
  const [newMasterKeys, setNewMasterKeys] = useState({});
  const [saveStatus, setSaveStatus] = useState(''); // Feedback toast

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
  };

  const autoSaveConfig = async (key, value) => {
    try {
      const { error } = await adminSupabase
        .from('app_config')
        .upsert({ key, value }, { onConflict: 'key' });
      if (error) throw error;
      setSaveStatus(`${key === 'masterGroups' ? 'Master links' : 'Results'} saved automatically`);
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

  // Load cached events + participant counts from Supabase (fast)
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
          const { count } = await supabase
            .from('chronotrack_results')
            .select('id', { count: 'exact', head: true })
            .eq('event_id', event.id);
          counts[event.id] = count || 0;
        }
        setParticipantCounts(counts);
      } catch (err) {
        console.error('[Admin] Failed to load cached data:', err);
        setChronoEvents([]);
      }
    };

    loadCachedData();
  }, [isLoggedIn]);

  // Manual fetch latest events from ChronoTrack
  const fetchLatestFromChronoTrack = async () => {
    setFetchingEvents(true);
    try {
      const freshEvents = await fetchChronoEvents();
      const sorted = freshEvents.sort((a, b) => (b.start_time || 0) - (a.start_time || 0));

      const toUpsert = sorted.map(event => ({
        id: event.id,
        name: event.name,
        start_time: event.start_time,
        races: event.races || [],
      }));

      const { error } = await adminSupabase
        .from('chronotrack_events')
        .upsert(toUpsert, { onConflict: 'id' });

      if (error) throw error;

      setChronoEvents(sorted);
      setSaveStatus('Events refreshed and cached!');
      setTimeout(() => setSaveStatus(''), 4000);
    } catch (err) {
      console.error('[Admin] ChronoTrack fetch failed:', err);
      setSaveStatus('Fetch failed');
    } finally {
      setFetchingEvents(false);
    }
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
    // Remove from old masters
    Object.keys(updated).forEach(key => {
      updated[key] = updated[key].filter(id => id !== eventId.toString());
      if (updated[key].length === 0) delete updated[key];
    });
    // Add to new
    if (!updated[masterKey]) updated[masterKey] = [];
    if (!updated[masterKey].includes(eventId.toString())) {
      updated[masterKey].push(eventId.toString());
    }
    setMasterGroups(updated);
    setNewMasterKeys(prev => ({ ...prev, [eventId]: '' }));
    await autoSaveConfig('masterGroups', updated); // AUTO-SAVE
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
      await autoSaveConfig('masterGroups', updated); // AUTO-SAVE
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

  const refreshAndPublishResults = async (eventId) => {
    setRefreshingEvent(eventId);
    try {
      const fresh = await fetchResultsForEvent(eventId);
      if (fresh.length === 0) {
        alert('No results returned from ChronoTrack.');
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
      await autoSaveConfig('masterGroups', masterGroups); // Ensure config is current
      setSaveStatus(`Published ${deduped.length} results — saved automatically!`);
      setTimeout(() => setSaveStatus(''), 5000);
    } catch (err) {
      console.error('[Admin] Publish failed:', err);
      setSaveStatus('Publish failed');
    } finally {
      setRefreshingEvent(null);
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

        {/* Save Status Toast */}
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
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-3xl font-bold text-gemini-dark-gray">
                ChronoTrack Events ({chronoEvents.length})
              </h2>
              <button
                onClick={fetchLatestFromChronoTrack}
                disabled={fetchingEvents}
                className="px-8 py-4 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 disabled:opacity-50 transition"
              >
                {fetchingEvents ? 'Fetching...' : 'Fetch Latest Events from ChronoTrack'}
              </button>
            </div>

            {chronoEvents.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-2xl shadow">
                <p className="text-xl text-gray-600">No events cached yet.</p>
                <p className="text-gray-500 mt-2">Click the button above to load events from ChronoTrack.</p>
              </div>
            ) : (
              chronoEvents.map((event) => {
                const currentMaster = getCurrentMasterForEvent(event.id);
                const displayName = editedEvents[event.id]?.name || event.name;
                const count = participantCounts[event.id] || 0;

                return (
                  <div key={event.id} className="bg-white rounded-2xl shadow-lg overflow-hidden">
                    <div
                      className="p-6 cursor-pointer hover:bg-gemini-blue/5 transition flex justify-between items-center"
                      onClick={() => toggleEventExpansion(event.id)}
                    >
                      <div>
                        <h3 className="text-2xl font-bold text-gemini-dark-gray">
                          {displayName} <span className="text-lg font-normal text-gray-500">({formatDate(event.start_time)})</span>
                        </h3>
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

                        <div className="mt-8 flex justify-center">
                          <button
                            onClick={() => refreshAndPublishResults(event.id)}
                            disabled={refreshingEvent === event.id}
                            className="px-10 py-4 bg-green-600 text-white text-xl font-bold rounded-xl hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition shadow-lg"
                          >
                            {refreshingEvent === event.id ? 'Publishing...' : 'Refresh & Publish Results'}
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