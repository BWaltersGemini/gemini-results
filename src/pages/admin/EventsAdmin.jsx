// src/pages/admin/EventsAdmin.jsx
// FINAL — Complete EventsAdmin (December 2025)
// • Fully compatible with { finishers, nonFinishers } from chronotrackapi.js
// • Publishes both finishers and DNF/DQ (with _status column)
// • Bulk and single publish working
// • Refresh events with end times
// • Master series management, race editing, live toggle, delete

import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { createAdminSupabaseClient } from '../../supabaseClient';
import { fetchEvents as fetchChronoEvents, fetchResultsForEvent } from '../../api/chronotrackapi';
import axios from 'axios';

export default function EventsAdmin({
  masterGroups,
  editedEvents,
  hiddenRaces,
  liveAutoFetchPerEvent,
  setMasterGroups,
  setEditedEvents,
  setHiddenRaces,
  setLiveAutoFetchPerEvent,
  autoSaveConfig,
}) {
  const [chronoEvents, setChronoEvents] = useState([]);
  const [participantCounts, setParticipantCounts] = useState({});
  const [expandedYears, setExpandedYears] = useState({});
  const [expandedMonths, setExpandedMonths] = useState({});
  const [expandedEvents, setExpandedEvents] = useState({});
  const [refreshingEvent, setRefreshingEvent] = useState(null);
  const [fetchingEvents, setFetchingEvents] = useState(false);
  const [publishingAll, setPublishingAll] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });
  const [newMasterKeys, setNewMasterKeys] = useState({});
  const [hideMasteredEvents, setHideMasteredEvents] = useState(true);

  const adminSupabase = createAdminSupabaseClient();

  // Load events and participant counts
  useEffect(() => {
    const loadData = async () => {
      try {
        const { data, error } = await supabase
          .from('chronotrack_events')
          .select('*')
          .order('start_time', { ascending: false });
        if (error) throw error;
        setChronoEvents(data || []);

        const counts = {};
        for (const event of data || []) {
          const { count } = await adminSupabase
            .from('chronotrack_results')
            .select('id', { count: 'exact', head: true })
            .eq('event_id', event.id);
          counts[event.id] = count || 0;
        }
        setParticipantCounts(counts);
      } catch (err) {
        console.error('Failed to load events data:', err);
      }
    };
    loadData();
  }, []);

  // Helper: Get auth header for ChronoTrack proxy calls
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

  // Refresh all events from ChronoTrack (with end times)
  const fetchLatestFromChronoTrack = async () => {
    setFetchingEvents(true);
    try {
      const freshEvents = await fetchChronoEvents();
      const sorted = freshEvents.sort((a, b) => (b.start_time || 0) - (a.start_time || 0));
      const authHeader = await getAuthHeader();
      const updatedEvents = [];
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
          }
        } catch (err) {
          console.warn(`Failed to fetch end_time for event ${event.id}`, err);
        }
        updatedEvents.push({
          id: event.id,
          name: event.name,
          start_time: event.start_time,
          event_end_time: endTime,
          races: event.races || [],
        });
      }
      const { error } = await adminSupabase.from('chronotrack_events').upsert(updatedEvents, { onConflict: 'id' });
      if (error) throw error;
      setChronoEvents(updatedEvents);
    } catch (err) {
      console.error('Refresh failed:', err);
    } finally {
      setFetchingEvents(false);
    }
  };

  // Publish all events
  const publishAllEvents = async () => {
    if (!confirm(`Publish results for ALL ${chronoEvents.length} events? This may take several minutes.`)) return;
    setPublishingAll(true);
    setBulkProgress({ current: 0, total: chronoEvents.length });
    let success = 0;
    let fail = 0;
    for (let i = 0; i < chronoEvents.length; i++) {
      try {
        await refreshAndPublishResults(chronoEvents[i].id);
        success++;
      } catch {
        fail++;
      }
      setBulkProgress({ current: i + 1, total: chronoEvents.length });
    }
    alert(`Bulk publish complete: ${success} succeeded, ${fail} failed`);
    setPublishingAll(false);
  };

  // Refresh & publish single event results — compatible with { finishers, nonFinishers }
  const refreshAndPublishResults = async (eventId) => {
    setRefreshingEvent(eventId);
    try {
      const fresh = await fetchResultsForEvent(eventId);
      const allParticipants = [...(fresh.finishers || []), ...(fresh.nonFinishers || [])];

      if (allParticipants.length === 0) {
        console.log(`[EventsAdmin] No participants for event ${eventId}`);
        setParticipantCounts(prev => ({ ...prev, [eventId]: 0 }));
        return;
      }

      // Deduplicate
      const seen = new Map();
      allParticipants.forEach(r => {
        const key = r.entry_id || `${r.bib || ''}-${r.race_id || ''}`;
        if (!seen.has(key)) seen.set(key, r);
      });
      const deduped = Array.from(seen.values());

      // Upsert all (finishers + DNFs)
      const toUpsert = deduped.map(r => ({
        event_id: String(eventId),  // ← Convert to string
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
        _status: r._status || 'FIN',
      }));

      const { error } = await adminSupabase
        .from('chronotrack_results')
        .upsert(toUpsert, { onConflict: 'event_id,entry_id' });

      if (error) throw error;

      setParticipantCounts(prev => ({ ...prev, [eventId]: deduped.length }));
      console.log(`[EventsAdmin] Published ${deduped.length} participants (incl. DNFs) for event ${eventId}`);
    } catch (err) {
      console.error('Publish failed:', err);
      throw err;
    } finally {
      setRefreshingEvent(null);
    }
  };

  // Master assignment helpers
  const getCurrentMasterForEvent = (eventId) => {
    for (const [masterKey, eventIds] of Object.entries(masterGroups)) {
      if (eventIds.includes(eventId.toString())) return masterKey;
    }
    return null;
  };

  const assignToMaster = async (eventId, masterKey) => {
    if (!masterKey) return;
    const updated = { ...masterGroups };
    Object.keys(updated).forEach((key) => {
      updated[key] = updated[key].filter((id) => id !== eventId.toString());
      if (updated[key].length === 0) delete updated[key];
    });
    if (!updated[masterKey]) updated[masterKey] = [];
    if (!updated[masterKey].includes(eventId.toString())) updated[masterKey].push(eventId.toString());
    setMasterGroups(updated);
    setNewMasterKeys((prev) => ({ ...prev, [eventId]: '' }));
    await autoSaveConfig('masterGroups', updated);
  };

  const unlinkFromMaster = async (eventId) => {
    const updated = { ...masterGroups };
    let changed = false;
    Object.keys(updated).forEach((key) => {
      const filtered = updated[key].filter((id) => id !== eventId.toString());
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

  // Edit names
  const handleEditEventName = (eventId, name) => {
    setEditedEvents((prev) => ({
      ...prev,
      [eventId]: { ...(prev[eventId] || {}), name },
    }));
  };

  const handleEditRaceName = (eventId, raceId, name) => {
    setEditedEvents((prev) => ({
      ...prev,
      [eventId]: {
        ...(prev[eventId] || {}),
        races: {
          ...(prev[eventId]?.races || {}),
          [raceId]: name,
        },
      },
    }));
  };

  const toggleRaceVisibility = (eventId, raceId) => {
    setHiddenRaces((prev) => {
      const current = prev[eventId] || [];
      if (current.includes(raceId)) {
        return { ...prev, [eventId]: current.filter((id) => id !== raceId) };
      }
      return { ...prev, [eventId]: [...current, raceId] };
    });
  };

  const toggleLiveAutoFetch = (eventId) => {
    setLiveAutoFetchPerEvent((prev) => ({
      ...prev,
      [eventId]: !prev[eventId],
    }));
  };

  const handleDeleteEvent = async (eventId, eventName) => {
    if (!confirm(`PERMANENTLY delete "${eventName}" and all its results? This cannot be undone.`)) return;
    try {
      await adminSupabase.from('chronotrack_results').delete().eq('event_id', eventId);
      await adminSupabase.from('chronotrack_events').delete().eq('id', eventId);
      setChronoEvents((prev) => prev.filter((e) => e.id !== eventId));
      setParticipantCounts((prev) => {
        const copy = { ...prev };
        delete copy[eventId];
        return copy;
      });
    } catch (err) {
      console.error('Event deletion failed:', err);
    }
  };

  // Date formatting
  const formatDate = (epoch) => {
    if (!epoch) return 'Date TBD';
    const date = new Date(epoch * 1000);
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  // Group events by year and month
  const groupEventsByYearMonth = () => {
    const groups = {};
    chronoEvents.forEach((event) => {
      if (!event.start_time) return;
      const date = new Date(event.start_time * 1000);
      const year = date.getFullYear();
      const month = date.toLocaleString('en-US', { month: 'long' });
      if (!groups[year]) groups[year] = {};
      if (!groups[year][month]) groups[year][month] = [];
      groups[year][month].push(event);
    });
    return groups;
  };

  const groupedEvents = groupEventsByYearMonth();

  const toggleYear = (year) => setExpandedYears((prev) => ({ ...prev, [year]: !prev[year] }));
  const toggleMonth = (yearMonth) => setExpandedMonths((prev) => ({ ...prev, [yearMonth]: !prev[yearMonth] }));
  const toggleEventExpansion = (eventId) => setExpandedEvents((prev) => ({ ...prev, [eventId]: !prev[eventId] }));

  const displayedCount = chronoEvents.filter((e) => !hideMasteredEvents || !getCurrentMasterForEvent(e.id)).length;

  return (
    <section className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
        <h2 className="text-4xl font-black text-brand-dark">Events ({displayedCount} shown)</h2>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={hideMasteredEvents}
              onChange={(e) => setHideMasteredEvents(e.target.checked)}
              className="h-6 w-6 text-accent rounded focus:ring-accent/30"
            />
            <span className="font-bold text-brand-dark">Hide Mastered Events</span>
          </label>
          <button
            onClick={fetchLatestFromChronoTrack}
            disabled={fetchingEvents}
            className="px-8 py-4 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 disabled:opacity-60 transition shadow-xl"
          >
            {fetchingEvents ? 'Refreshing Events...' : 'Refresh Events & End Times'}
          </button>
          <button
            onClick={publishAllEvents}
            disabled={publishingAll}
            className="px-8 py-4 bg-orange-600 text-white font-bold rounded-xl hover:bg-orange-700 disabled:opacity-60 transition shadow-xl"
          >
            {publishingAll
              ? `Publishing... (${bulkProgress.current}/${bulkProgress.total})`
              : 'Publish ALL Results'}
          </button>
        </div>
      </div>

      {/* Year → Month Accordion */}
      {Object.entries(groupedEvents)
        .sort(([a], [b]) => b - a)
        .map(([year, months]) => (
          <div key={year} className="bg-white rounded-3xl shadow-2xl overflow-hidden border border-primary/10">
            <button
              onClick={() => toggleYear(year)}
              className="w-full px-10 py-6 text-left text-3xl font-black text-brand-dark hover:bg-primary/5 transition flex justify-between items-center"
            >
              <span>{year}</span>
              <span className="text-4xl font-bold text-primary">{expandedYears[year] ? '−' : '+'}</span>
            </button>
            {expandedYears[year] && (
              <div className="border-t-4 border-primary/20">
                {Object.entries(months)
                  .sort(([a], [b]) => new Date(`1 ${b} ${year}`) - new Date(`1 ${a} ${year}`))
                  .map(([month, events]) => (
                    <div key={`${year}-${month}`}>
                      <button
                        onClick={() => toggleMonth(`${year}-${month}`)}
                        className="w-full px-14 py-5 text-left text-2xl font-bold text-brand-dark hover:bg-brand-light transition flex justify-between items-center"
                      >
                        <span>{month}</span>
                        <span className="text-3xl font-bold text-primary">{expandedMonths[`${year}-${month}`] ? '−' : '+'}</span>
                      </button>
                      {expandedMonths[`${year}-${month}`] && (
                        <div className="pb-8">
                          {events.map((event) => {
                            const currentMaster = getCurrentMasterForEvent(event.id);
                            if (hideMasteredEvents && currentMaster) return null;
                            const displayName = editedEvents[event.id]?.name || event.name;
                            const count = participantCounts[event.id] || 0;
                            const now = Math.floor(Date.now() / 1000);
                            const startTime = event.start_time ? parseInt(event.start_time, 10) : null;
                            const endTime = event.event_end_time ? parseInt(event.event_end_time, 10) : null;
                            const isRaceWindowActive = startTime && endTime && now >= startTime && now <= endTime;
                            const isRaceDayToday = !endTime && startTime
                              ? new Date(startTime * 1000).toISOString().split('T')[0] === new Date().toISOString().split('T')[0]
                              : false;
                            const isCurrentlyLive = isRaceWindowActive || isRaceDayToday;
                            const isAutoFetchEnabled = isCurrentlyLive ? liveAutoFetchPerEvent[event.id] !== false : false;

                            return (
                              <div key={event.id} className="mx-8 my-6 bg-brand-light/30 rounded-2xl overflow-hidden border border-primary/20 shadow-lg">
                                <div
                                  onClick={() => toggleEventExpansion(event.id)}
                                  className="p-6 cursor-pointer hover:bg-primary/10 transition flex justify-between items-center"
                                >
                                  <div>
                                    <h4 className="text-2xl font-black text-brand-dark">{displayName}</h4>
                                    <p className="text-lg text-gray-600 mt-1">
                                      {formatDate(event.start_time)} • <strong>{count} participants</strong>
                                      {isCurrentlyLive && <span className="ml-4 text-green-600 font-bold">● LIVE</span>}
                                    </p>
                                    {currentMaster && (
                                      <p className="text-sm font-bold text-accent mt-2">Master Series: {currentMaster}</p>
                                    )}
                                  </div>
                                  <span className="text-3xl font-bold text-primary">{expandedEvents[event.id] ? '−' : '+'}</span>
                                </div>
                                {expandedEvents[event.id] && (
                                  <div className="p-8 bg-white border-t-4 border-primary/30">
                                    {/* Master Assignment */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
                                      <div>
                                        <label className="block text-xl font-bold text-brand-dark mb-3">Master Series</label>
                                        <div className="flex gap-4">
                                          <input
                                            type="text"
                                            list="master-keys"
                                            placeholder="Type or select master"
                                            value={newMasterKeys[event.id] || ''}
                                            onChange={(e) => setNewMasterKeys((prev) => ({ ...prev, [event.id]: e.target.value }))}
                                            className="flex-1 px-6 py-4 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/20 text-lg"
                                          />
                                          <datalist id="master-keys">
                                            {Object.keys(masterGroups).map((key) => (
                                              <option key={key} value={key} />
                                            ))}
                                          </datalist>
                                          <button
                                            onClick={() => assignToMaster(event.id, newMasterKeys[event.id] || currentMaster)}
                                            className="px-8 py-4 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 transition shadow-lg"
                                          >
                                            Assign
                                          </button>
                                          {currentMaster && (
                                            <button
                                              onClick={() => unlinkFromMaster(event.id)}
                                              className="px-8 py-4 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition shadow-lg"
                                            >
                                              Unlink
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                      <div>
                                        <label className="block text-xl font-bold text-brand-dark mb-3">Event Display Name</label>
                                        <input
                                          type="text"
                                          value={displayName}
                                          onChange={(e) => handleEditEventName(event.id, e.target.value)}
                                          className="w-full px-6 py-4 text-lg border-2 border-gray-300 rounded-xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/20"
                                        />
                                      </div>
                                    </div>
                                    {/* Action Buttons */}
                                    <div className="flex flex-col sm:flex-row justify-center items-center gap-8 mb-10">
                                      <label className="flex items-center gap-6 cursor-pointer">
                                        <input
                                          type="checkbox"
                                          checked={isAutoFetchEnabled}
                                          onChange={() => toggleLiveAutoFetch(event.id)}
                                          className="h-10 w-10 text-accent rounded focus:ring-accent/30"
                                        />
                                        <span className="text-2xl font-black text-brand-dark">
                                          Live Auto-Fetch {isAutoFetchEnabled ? 'ON' : 'OFF'}
                                        </span>
                                      </label>
                                      <button
                                        onClick={() => refreshAndPublishResults(event.id)}
                                        disabled={refreshingEvent === event.id}
                                        className="px-12 py-6 bg-green-600 text-white text-2xl font-black rounded-xl hover:bg-green-700 disabled:opacity-60 transition shadow-2xl"
                                      >
                                        {refreshingEvent === event.id ? 'Publishing...' : 'Refresh & Publish Results'}
                                      </button>
                                      <button
                                        onClick={() => handleDeleteEvent(event.id, displayName)}
                                        className="px-12 py-6 bg-red-600 text-white text-2xl font-black rounded-xl hover:bg-red-700 transition shadow-2xl"
                                      >
                                        Delete Event
                                      </button>
                                    </div>
                                    {/* Races */}
                                    {event.races && event.races.length > 0 && (
                                      <div>
                                        <h4 className="text-2xl font-black text-brand-dark mb-6">Races ({event.races.length})</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                          {event.races.map((race) => (
                                            <div key={race.race_id} className="flex items-center justify-between bg-white p-5 rounded-xl border border-primary/10 shadow-md">
                                              <div className="flex items-center gap-6 flex-1">
                                                <input
                                                  type="checkbox"
                                                  checked={!(hiddenRaces[event.id] || []).includes(race.race_id)}
                                                  onChange={() => toggleRaceVisibility(event.id, race.race_id)}
                                                  className="h-6 w-6 text-accent rounded focus:ring-accent/30"
                                                />
                                                <input
                                                  type="text"
                                                  value={editedEvents[event.id]?.races?.[race.race_id] || race.race_name}
                                                  onChange={(e) => handleEditRaceName(event.id, race.race_id, e.target.value)}
                                                  className="flex-1 px-5 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/20 text-lg"
                                                />
                                              </div>
                                              {race.distance && (
                                                <span className="text-gray-600 ml-6 font-medium">
                                                  {race.distance} {race.distance_unit || 'm'}
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
                          })}
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </div>
        ))}
    </section>
  );
}