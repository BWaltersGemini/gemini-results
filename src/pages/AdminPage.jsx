// src/pages/AdminPage.jsx (CLEANED UP + UNLINK FROM MASTER + MODERN UI)
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
  const [chronotrackEnabled, setChronotrackEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [chronoEvents, setChronoEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [refreshStatus, setRefreshStatus] = useState('');
  const [activeTab, setActiveTab] = useState('events');
  const [refreshingEvents, setRefreshingEvents] = useState(false);
  const [showAssignedEvents, setShowAssignedEvents] = useState(false);
  const [collapsedYears, setCollapsedYears] = useState({});
  const [syncingEvents, setSyncingEvents] = useState([]);
  const [eventResultsCount, setEventResultsCount] = useState({});
  const [autoSyncOnAssign, setAutoSyncOnAssign] = useState({});
  const [fetchingNewEvents, setFetchingNewEvents] = useState(false);
  const [newEventsStatus, setNewEventsStatus] = useState('');
  const [newMasterKeys, setNewMasterKeys] = useState({});

  const adminSupabase = createAdminSupabaseClient();

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

  const saveConfig = async (key, value) => {
    try {
      const { error } = await adminSupabase
        .from('app_config')
        .upsert({ key, value }, { onConflict: 'key' });
      if (error) throw error;
      console.log(`[Admin] Saved ${key}`);
    } catch (err) {
      console.error(`[Admin] Save failed ${key}:`, err);
      alert('Save failed. Check console.');
    }
  };

  useEffect(() => {
    const loggedIn = localStorage.getItem('adminLoggedIn') === 'true';
    setIsLoggedIn(loggedIn);
    if (loggedIn) loadGlobalConfig();
  }, []);

  useEffect(() => {
    if (isLoggedIn) {
      const fetchData = async () => {
        try {
          setLoading(true);
          const events = await fetchChronoEvents();
          const sorted = events.sort((a, b) => (b.start_time || 0) - (a.start_time || 0));
          setChronoEvents(sorted);

          // Count results per event (optional preview)
          const counts = {};
          for (const event of sorted.slice(0, 50)) { // Limit to avoid slowdown
            try {
              const fresh = await fetchResultsForEvent(event.id);
              counts[event.id] = fresh.length;
            } catch {}
          }
          setEventResultsCount(counts);
        } catch (err) {
          console.error('Fetch failed:', err);
        } finally {
          setLoading(false);
        }
      };
      fetchData();
    }
  }, [isLoggedIn]);

  const formatDate = (epoch) => {
    if (!epoch) return 'Date TBD';
    const date = new Date(epoch * 1000);
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  const getCurrentMasterForEvent = (eventId) => {
    for (const [masterKey, eventIds] of Object.entries(masterGroups)) {
      if (eventIds.includes(eventId.toString())) {
        return masterKey;
      }
    }
    return null;
  };

  const assignToMaster = async (eventId, masterKey) => {
    if (!masterKey) return;
    const updated = { ...masterGroups };
    // Remove from old master
    Object.keys(updated).forEach(key => {
      updated[key] = updated[key].filter(id => id !== eventId.toString());
      if (updated[key].length === 0) delete updated[key];
    });
    // Add to new
    if (!updated[masterKey]) updated[masterKey] = [];
    updated[masterKey].push(eventId.toString());
    setMasterGroups(updated);
    setNewMasterKeys(prev => ({ ...prev, [eventId]: '' }));
  };

  const unlinkFromMaster = (eventId) => {
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
      console.log(`[Admin] Unlinked event ${eventId} from master`);
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

  const handleSaveChanges = async () => {
    await Promise.all([
      saveConfig('masterGroups', masterGroups),
      saveConfig('editedEvents', editedEvents),
      saveConfig('eventLogos', eventLogos),
      saveConfig('hiddenMasters', hiddenMasters),
      saveConfig('showAdsPerMaster', showAdsPerMaster),
      saveConfig('ads', ads),
      saveConfig('hiddenEvents', hiddenEvents),
      saveConfig('hiddenRaces', hiddenRaces),
    ]);
    alert('All changes saved to Supabase!');
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
            onKeyPress={(e) => e.key === 'Enter' && setIsLoggedIn(username === 'admin' && password === 'gemini2025')}
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

        {/* Tabs */}
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

        {/* Events & Masters Tab */}
        {activeTab === 'events' && (
          <section className="space-y-6">
            <h2 className="text-3xl font-bold text-gemini-dark-gray mb-6">ChronoTrack Events</h2>

            {loading ? (
              <p className="text-center text-gray-600 py-12">Loading events...</p>
            ) : (
              chronoEvents.map((event) => {
                const currentMaster = getCurrentMasterForEvent(event.id);
                const displayName = editedEvents[event.id]?.name || event.name;

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
                          ID: {event.id} • {eventResultsCount[event.id] !== undefined ? `${eventResultsCount[event.id]} results` : 'Results not counted'}
                        </p>
                        {currentMaster && (
                          <p className="text-sm text-gemini-blue font-medium mt-2">
                            Master: {currentMaster} {editedEvents[currentMaster]?.name && `(${editedEvents[currentMaster].name})`}
                          </p>
                        )}
                      </div>
                      <span className="text-2xl text-gray-400">{expandedEvents[event.id] ? '−' : '+'}</span>
                    </div>

                    {expandedEvents[event.id] && (
                      <div className="px-6 pb-6 border-t border-gray-200">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                          {/* Master Assignment */}
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
                                className="px-6 py-3 bg-gemini-blue text-white rounded-xl hover:bg-gemini-blue/90 transition font-medium"
                              >
                                Assign
                              </button>
                              {currentMaster && (
                                <button
                                  onClick={() => unlinkFromMaster(event.id)}
                                  className="px-6 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition font-medium"
                                >
                                  Unlink
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Event Name Edit */}
                          <div>
                            <label className="block text-lg font-semibold text-gray-700 mb-2">Event Display Name</label>
                            <input
                              type="text"
                              value={displayName}
                              onChange={(e) => handleEditEventName(event.id, e.target.value)}
                              className="w-full px-4 py-3 border border-gray-300 rounded-xl"
                            />
                          </div>
                        </div>

                        {/* Embedded Races */}
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
                                      {race.distance} {race.distance_unit}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
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

        {/* Website Management Tab */}
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
            onClick={handleSaveChanges}
            className="px-16 py-6 bg-gemini-blue text-white text-2xl font-bold rounded-full hover:bg-gemini-blue/90 shadow-2xl transition transform hover:scale-105"
          >
            Save All Changes to Supabase
          </button>
        </div>
      </div>
    </div>
  );
}