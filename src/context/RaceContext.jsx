// src/context/RaceContext.jsx (FINAL — Fresh Supabase Config Load + No localStorage Cache for Global Config)
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

  // Global config — loaded fresh from Supabase
  const [masterGroups, setMasterGroups] = useState({});
  const [editedEvents, setEditedEvents] = useState({});
  const [eventLogos, setEventLogos] = useState({});
  const [hiddenMasters, setHiddenMasters] = useState([]);
  const [showAdsPerMaster, setShowAdsPerMaster] = useState({});
  const [ads, setAds] = useState([]);
  const [hiddenRaces, setHiddenRaces] = useState({});

  // Load global config fresh from Supabase on mount
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

  // Persist only selectedEventId in localStorage (user preference)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const savedEventId = localStorage.getItem('selectedEventId');
    if (savedEventId && events.length > 0) {
      const restored = events.find(e => e.id === savedEventId);
      if (restored) {
        setSelectedEvent(restored);
      } else {
        localStorage.removeItem('selectedEventId');
      }
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

  // Load ALL events from ChronoTrack
  useEffect(() => {
    const loadEvents = async () => {
      try {
        setLoading(true);
        setError(null);
        const allEvents = await fetchEvents();
        setEvents(allEvents);
        console.log('[RaceContext] All events loaded:', allEvents.length);
      } catch (err) {
        console.error('[RaceContext] Failed to load events:', err);
        setError('Failed to load events');
      } finally {
        setLoading(false);
      }
    };
    loadEvents();
  }, []);

  // === ROBUST RACE LOADING WITH FALLBACK ===
  useEffect(() => {
    if (!selectedEvent) {
      setRaces([]);
      return;
    }

    const loadRaces = async () => {
      let embeddedRaces = selectedEvent.races || [];

      if (embeddedRaces.length > 0) {
        const formatted = embeddedRaces.map(race => ({
          race_id: race.race_id || race.id,
          race_name: race.race_name || 'Unknown Race',
        }));
        setRaces(formatted);
        console.log('[RaceContext] Loaded embedded races:', formatted.length);
        return;
      }

      console.log('[RaceContext] No embedded races — fetching fresh from ChronoTrack...');
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

        const formatted = fullRaces.map(race => ({
          race_id: race.race_id,
          race_name: race.race_name,
        }));

        setRaces(formatted);
        setSelectedEvent(prev => ({
          ...prev,
          races: fullRaces,
        }));

        // Sync to Supabase for future loads
        try {
          await supabase
            .from('chronotrack_events')
            .update({ races: fullRaces })
            .eq('id', selectedEvent.id);
          console.log('[RaceContext] Embedded races synced to Supabase');
        } catch (syncErr) {
          console.warn('[RaceContext] Failed to sync races to Supabase:', syncErr);
        }

        console.log('[RaceContext] Fallback success: Loaded', formatted.length, 'races');
      } catch (err) {
        console.warn('[RaceContext] Race fetch fallback failed:', err);
        const fallbackRace = [{
          race_id: selectedEvent.id,
          race_name: selectedEvent.name || 'Overall Results',
        }];
        setRaces(fallbackRace);
        console.log('[RaceContext] Ultimate fallback: Single overall race');
      }
    };

    loadRaces();
  }, [selectedEvent]);

  // Load results — FULL PAGINATION FROM CACHE + fresh sync on race day
  useEffect(() => {
    if (!selectedEvent) {
      setResults([]);
      setUniqueDivisions([]);
      setIsLiveRace(false);
      return;
    }

    let aborted = false;
    let pollInterval = null;

    const loadResults = async (forceFresh = false) => {
      if (aborted) return;

      try {
        setLoadingResults(true);
        setError(null);
        let allResults = [];

        // === 1. LOAD ALL CACHED RESULTS WITH PAGINATION ===
        let cachedResults = [];
        let start = 0;
        const pageSize = 1000;

        while (!aborted) {
          const { data, error } = await supabase
            .from('chronotrack_results')
            .select('*')
            .eq('event_id', selectedEvent.id)
            .order('place', { ascending: true })
            .range(start, start + pageSize - 1);

          if (error) {
            console.error('[RaceContext] Cache pagination error:', error);
            break;
          }

          if (!data || data.length === 0) {
            break;
          }

          cachedResults = [...cachedResults, ...data];
          start += data.length;

          if (data.length < pageSize) break;
        }

        if (cachedResults.length > 0) {
          allResults = cachedResults;
          const divisions = [...new Set(cachedResults.map(r => r.age_group_name).filter(Boolean))].sort();
          setUniqueDivisions(divisions);
          console.log(`[RaceContext] Loaded ${cachedResults.length} results from cache (paginated)`);
        }

        // === 2. Determine if race day ===
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        const eventDateStr = selectedEvent.start_time
          ? new Date(selectedEvent.start_time * 1000).toISOString().split('T')[0]
          : null;
        const isRaceDay = eventDateStr === todayStr;
        if (!aborted) setIsLiveRace(isRaceDay);

        // === 3. Fetch fresh if needed ===
        const shouldFetchFresh = forceFresh || isRaceDay || cachedResults.length === 0;
        if (shouldFetchFresh) {
          console.log('[RaceContext] Fetching fresh results from ChronoTrack...');
          const fresh = await fetchResultsForEvent(selectedEvent.id);

          if (!aborted && fresh.length > 0) {
            const seen = new Map();
            fresh.forEach(r => {
              const key = r.entry_id || `${r.bib || ''}-${r.race_id || ''}`;
              if (!seen.has(key)) seen.set(key, r);
            });
            const deduped = Array.from(seen.values());
            console.log(`[RaceContext] Deduplicated: ${fresh.length} → ${deduped.length}`);

            const toUpsert = deduped.map(r => ({
              event_id: selectedEvent.id,
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

            const { error: upsertError } = await supabase
              .from('chronotrack_results')
              .upsert(toUpsert, { onConflict: 'event_id,entry_id' });

            if (upsertError) {
              console.error('[RaceContext] Upsert error:', upsertError);
            } else {
              console.log('[RaceContext] Fresh results upserted');
              if (!aborted) {
                allResults = deduped;
                const divisions = [...new Set(deduped.map(r => r.age_group_name).filter(Boolean))].sort();
                setUniqueDivisions(divisions);
              }
            }
          }
        }

        if (!aborted) setResults(allResults);
      } catch (err) {
        if (!aborted) {
          console.error('[RaceContext] Results load error:', err);
          setError('Failed to load results');
        }
      } finally {
        if (!aborted) setLoadingResults(false);
      }
    };

    loadResults();

    // Live polling on race day
    if (selectedEvent.start_time) {
      const eventDateStr = new Date(selectedEvent.start_time * 1000).toISOString().split('T')[0];
      const todayStr = new Date().toISOString().split('T')[0];
      if (eventDateStr === todayStr) {
        pollInterval = setInterval(() => loadResults(true), 120000);
        console.log('[RaceContext] Live polling started (every 2 minutes)');
      }
    }

    return () => {
      aborted = true;
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [selectedEvent]);

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
      }}
    >
      {children}
    </RaceContext.Provider>
  );
}