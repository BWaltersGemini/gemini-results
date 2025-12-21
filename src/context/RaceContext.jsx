// src/context/RaceContext.jsx (FULLY UPDATED — Optimized + Robust Live Polling + Enhanced Logging)
import { createContext, useState, useEffect } from 'react';
import { fetchEvents, fetchRacesForEvent, fetchResultsForEvent } from '../api/chronotrackapi';
import { supabase } from '../supabaseClient';
import { loadAppConfig } from '../utils/appConfig';

export const RaceContext = createContext();

export function RaceProvider({ children }) {
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [races, setRaces] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingResults, setLoadingResults] = useState(false);
  const [error, setError] = useState(null);
  const [uniqueDivisions, setUniqueDivisions] = useState([]);
  const [isLiveRace, setIsLiveRace] = useState(false);

  // Admin-triggered forced refresh
  const [resultsVersion, setResultsVersion] = useState(0);

  // Global config — loaded fresh from Supabase
  const [masterGroups, setMasterGroups] = useState({});
  const [editedEvents, setEditedEvents] = useState({});
  const [eventLogos, setEventLogos] = useState({});
  const [hiddenMasters, setHiddenMasters] = useState([]);
  const [showAdsPerMaster, setShowAdsPerMaster] = useState({});
  const [ads, setAds] = useState([]);
  const [hiddenRaces, setHiddenRaces] = useState({});

  // Load global config fresh on mount
  useEffect(() => {
    const loadConfig = async () => {
      const config = await loadAppConfig();
      setMasterGroups(config.masterGroups || {});
      setEditedEvents(config.editedEvents || {});
      setEventLogos(config.eventLogos || {});
      setHiddenMasters(config.hiddenMasters || []);
      setShowAdsPerMaster(config.showAdsPerMaster || {});
      setAds(config.ads || []);
      setHiddenRaces(config.hiddenRaces || {});
      console.log('[RaceContext] Fresh global config loaded from Supabase');
    };
    loadConfig();
  }, []);

  // Persist selectedEventId in localStorage (user preference)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const savedEventId = localStorage.getItem('selectedEventId');
    if (savedEventId && events.length > 0) {
      const restored = events.find(e => e.id === savedEventId);
      if (restored) setSelectedEvent(restored);
      else localStorage.removeItem('selectedEventId');
    }
  }, [events]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (selectedEvent) {
      localStorage.setItem('selectedEventId', selectedEvent.id);
    } else {
      localStorage.removeItem('selectedEventId');
    }
  }, [selectedEvent]);

  // Load all events from ChronoTrack
  useEffect(() => {
    let aborted = false;

    const loadEvents = async () => {
      try {
        setLoading(true);
        setError(null);
        const allEvents = await fetchEvents();
        if (!aborted) {
          setEvents(allEvents);
          console.log(`[RaceContext] Loaded ${allEvents.length} events from ChronoTrack`);
        }
      } catch (err) {
        if (!aborted) {
          console.error('[RaceContext] Failed to load events:', err);
          setError('Failed to load events');
        }
      } finally {
        if (!aborted) setLoading(false);
      }
    };

    loadEvents();

    return () => { aborted = true; };
  }, []);

  // Load races for selected event
  useEffect(() => {
    if (!selectedEvent) {
      setRaces([]);
      return;
    }

    let aborted = false;

    const loadRaces = async () => {
      // Prefer embedded races if available
      let embeddedRaces = selectedEvent.races || [];
      if (embeddedRaces.length > 0) {
        const formatted = embeddedRaces.map(race => ({
          race_id: race.race_id || race.id,
          race_name: race.race_name || 'Unknown Race',
        }));
        if (!aborted) {
          setRaces(formatted);
          console.log('[RaceContext] Using embedded races:', formatted.length);
        }
        return;
      }

      console.log('[RaceContext] No embedded races — fetching from ChronoTrack...');
      try {
        const freshRaces = await fetchRacesForEvent(selectedEvent.id);
        const fullRaces = freshRaces.map(race => ({
          race_id: race.race_id,
          race_name: race.race_name || 'Unknown Race',
          race_tag: race.race_tag || null,
          race_type: race.race_type || null,
          race_subtype: race.race_subtype || null,
          distance: race.race_course_distance || null,
          distance_unit: race.race_pref_distance_unit || 'meters',
          planned_start_time: race.race_planned_start_time ? parseInt(race.race_planned_start_time, 10) : null,
          actual_start_time: race.race_actual_start_time ? parseFloat(race.race_actual_start_time) : null,
        }));

        const formatted = fullRaces.map(r => ({ race_id: r.race_id, race_name: r.race_name }));
        if (!aborted) {
          setRaces(formatted);
          setSelectedEvent(prev => ({ ...prev, races: fullRaces }));
        }

        // Sync to Supabase for future cache
        await supabase
          .from('chronotrack_events')
          .update({ races: fullRaces })
          .eq('id', selectedEvent.id);

        console.log('[RaceContext] Races fetched and synced to Supabase');
      } catch (err) {
        if (!aborted) {
          console.warn('[RaceContext] Race fetch failed — using fallback:', err);
          const fallback = [{
            race_id: selectedEvent.id,
            race_name: selectedEvent.name || 'Overall Results',
          }];
          setRaces(fallback);
        }
      }
    };

    loadRaces();

    return () => { aborted = true; };
  }, [selectedEvent]);

  // Results loading + smart background live polling
  useEffect(() => {
    if (!selectedEvent) {
      setResults([]);
      setUniqueDivisions([]);
      setIsLiveRace(false);
      return;
    }

    let aborted = false;
    let pollInterval = null;

    const now = Math.floor(Date.now() / 1000);
    const startTime = selectedEvent.start_time ? parseInt(selectedEvent.start_time, 10) : null;
    const endTime = selectedEvent.event_end_time ? parseInt(selectedEvent.event_end_time, 10) : null;

    const isActiveWindow = startTime && endTime && now >= startTime && now <= endTime;
    const isRaceDayFallback = !endTime && startTime
      ? new Date(startTime * 1000).toISOString().split('T')[0] === new Date().toISOString().split('T')[0]
      : false;

    const isLive = isActiveWindow || isRaceDayFallback;
    if (!aborted) setIsLiveRace(isLive);

    const loadResults = async (forceFresh = false) => {
      if (aborted) return;

      try {
        setLoadingResults(true);
        setError(null);

        // Load cached results from Supabase (paginated for safety)
        let cachedResults = [];
        let start = 0;
        const pageSize = 1000;

        while (!aborted) {
          const { data, error } = await supabase
            .from('chronotrack_results')
            .select('*')
            .eq('event_id', selectedEvent.id)
            .range(start, start + pageSize - 1);

          if (error || !data || data.length === 0) break;
          cachedResults.push(...data);
          start += data.length;
          if (data.length < pageSize) break;
        }

        let allResults = cachedResults;

        // Only fetch fresh if forced (poll/admin) OR no cache exists
        const shouldFetchFresh = forceFresh || cachedResults.length === 0 || resultsVersion > 0;

        if (shouldFetchFresh) {
          console.log('[RaceContext] Fetching fresh results from ChronoTrack...');
          const fresh = await fetchResultsForEvent(selectedEvent.id);

          if (fresh.length > 0) {
            console.log(`[RaceContext] Fresh results received: ${fresh.length} entries`);

            // Deduplicate by entry_id (fallback to bib + race_id)
            const seen = new Map();
            fresh.forEach(r => {
              const key = r.entry_id || `${r.bib || ''}-${r.race_id || ''}`;
              if (!seen.has(key)) seen.set(key, r);
            });
            const deduped = Array.from(seen.values());

            // Prepare for upsert
            const toUpsert = deduped.map(r => ({
              event_id: selectedEvent.id,
              entry_id: r.entry_id ?? null,
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
              race_name: r.race_name ?? null,
            }));

            const { error: upsertError } = await supabase
              .from('chronotrack_results')
              .upsert(toUpsert, { onConflict: 'event_id,entry_id' });

            if (upsertError) {
              console.error('[RaceContext] Upsert failed:', upsertError);
            } else {
              console.log('[RaceContext] Fresh results upserted successfully');
              allResults = deduped;

              // Update event last_updated timestamp
              await supabase
                .from('chronotrack_events')
                .update({ last_updated: new Date().toISOString() })
                .eq('id', selectedEvent.id);
            }
          } else {
            console.warn('[RaceContext] Fresh fetch returned 0 results');
          }
        } else {
          console.log(`[RaceContext] Using cached results (${cachedResults.length} rows)`);
        }

        // Extract unique divisions
        const divisions = [...new Set(allResults.map(r => r.age_group_name).filter(Boolean))].sort();
        if (!aborted) {
          setUniqueDivisions(divisions);
          setResults(allResults);
        }
      } catch (err) {
        if (!aborted) {
          console.error('[RaceContext] Results load error:', err);
          setError('Failed to load results');
        }
      } finally {
        if (!aborted) setLoadingResults(false);
      }
    };

    // Initial load — prefer cache
    loadResults(resultsVersion > 0);

    // Background live polling
    if (isActiveWindow) {
      pollInterval = setInterval(() => loadResults(true), 30000);
      console.log('[RaceContext] Live polling started — 30s interval (active race window)');
    } else if (isRaceDayFallback) {
      pollInterval = setInterval(() => loadResults(true), 60000);
      console.log('[RaceContext] Race day polling started — 60s interval');
    }

    return () => {
      aborted = true;
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [selectedEvent, resultsVersion]);

  // Admin manual refresh trigger
  const refreshResults = () => {
    console.log('[RaceContext] Admin triggered forced refresh');
    setResultsVersion(prev => prev + 1);
  };

  return (
    <RaceContext.Provider
      value={{
        events,
        selectedEvent,
        setSelectedEvent,
        races,
        results,
        loading,
        loadingResults,
        error,
        uniqueDivisions,
        isLiveRace,
        masterGroups,
        editedEvents,
        eventLogos,
        hiddenMasters,
        showAdsPerMaster,
        ads,
        hiddenRaces,
        refreshResults,
      }}
    >
      {children}
    </RaceContext.Provider>
  );
}