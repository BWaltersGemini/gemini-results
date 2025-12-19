// src/pages/AdminPage.jsx (FINAL — Bulk Publish with Progress + Hide Mastered Events)
import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchEvents as fetchChronoEvents, fetchResultsForEvent } from '../api/chronotrackapi';
import { supabase } from '../supabaseClient';
import { createAdminSupabaseClient } from '../supabaseClient';
import { loadAppConfig } from '../utils/appConfig';
import { RaceContext } from '../context/RaceContext';

export default function AdminPage() {
  const navigate = useNavigate();
  const { refreshResults } = useContext(RaceContext);

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
  const [publishingAll, setPublishingAll] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 }); // NEW: progress
  const [activeTab, setActiveTab] = useState('events');
  const [newMasterKeys, setNewMasterKeys] = useState({});
  const [saveStatus, setSaveStatus] = useState('');
  const [hideMasteredEvents, setHideMasteredEvents] = useState(true); // NEW: checkbox

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
      setSaveStatus(`${key === 'masterGroups' ? 'Master links' : 'Config'} saved automatically`);
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
          if (countError) {
            console.error('[Admin] Count error for event', event.id, countError);
            counts[event.id] = 0;
          } else {
            counts[event.id] = adminCount || 0;
          }
        }
        setParticipantCounts(counts);
      } catch (err) {
        console.error('[Admin] Failed to load cached data:', err);
        setChronoEvents([]);
      }
    };
    loadCachedData();
  }, [isLoggedIn]);

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

  // NEW: Bulk publish with progress
  const publishAllEvents = async () => {
    if (!confirm(`Publish results for ALL ${chronoEvents.length} events?\nThis may take several minutes.`)) {
      return;
    }

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

    if (refreshResults) {
      refreshResults();
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
      throw err; // re-throw for bulk handler
    } finally {
      setRefreshingEvent(null);
    }
  };

  const handleFileUpload = async (e, type) => {
    // unchanged
  };

  if (!isLoggedIn) {
    // unchanged login screen
  }

  // Filter events for "Hide Events with Masters"
  const displayedEvents = hideMasteredEvents
    ? chronoEvents.filter(event => !getCurrentMasterForEvent(event.id))
    : chronoEvents;

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header & Logout */}
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

        {/* Tabs */}
        <div className="flex space-x-1 mb-8 bg-gray-100 p-1 rounded-xl w-fit">
          {/* unchanged */}
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
                  {fetchingEvents ? 'Fetching...' : 'Fetch Latest Events'}
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
                    ? 'All events are assigned to masters or no events available.' 
                    : 'No events cached yet.'}
                </p>
                <p className="text-gray-500 mt-2">Click "Fetch Latest Events" to load from ChronoTrack.</p>
              </div>
            ) : (
              displayedEvents.map((event) => {
                // unchanged event cards
              })
            )}
          </section>
        )}

        {/* Website tab unchanged */}
        {activeTab === 'website' && (
          // unchanged
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