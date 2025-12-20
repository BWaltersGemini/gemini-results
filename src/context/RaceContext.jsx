// src/context/RaceContext.jsx (FINAL — Background updates ONLY during actual race window using event_start_time & event_end_time)
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

  // Admin force-refresh trigger
  const [resultsVersion, setResultsVersion] = useState(0);

  // Global config
  const [masterGroups, setMasterGroups] = useState({});
  const [editedEvents, setEditedEvents] = useState({});
  const [eventLogos, setEventLogos] = useState({});
  const [hiddenMasters, setHiddenMasters] = useState([]);
  const [showAdsPerMaster, setShowAdsPerMaster] = useState({});
  const [ads, setAds] = useState([]);
  const [hiddenRaces, setHiddenRaces] = useState({});

  // Load global config on mount
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

  // LocalStorage persistence for selected event
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

  // Load all events from ChronoTrack
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

  // Robust race loading with fallback
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

  // Results loading + background updates ONLY during race window
  useEffect(() => {
    if (!selectedEvent) {
      setResults([]);
      setUniqueDivisions([]);
      setIsLiveRace(false);
      return;
    }

    let aborted = false;
    let backgroundInterval = null;

    const loadResults = async (updateUI = true) => {
      if (aborted) return;

      try {
        if (updateUI) {
          setLoadingResults(true);
          setError(null);
        }

        let allResults = [];

        // Load cached results from Supabase
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
          if (!data || data.length === 0) break;

          cachedResults = [...cachedResults, ...data];
          start += data.length;
          if (data.length < pageSize) break;
        }

        // Determine if currently within the actual race window
        const now = Math.floor(Date.now() / 1000); // Current time in Unix seconds
        const startTime = selectedEvent.start_time ? parseInt(selectedEvent.start_time, 10) : null;
        const endTime = selectedEvent.event_end_time ? parseInt(selectedEvent.event_end_time, 10) : null;

        const isActiveRaceWindow = startTime && endTime && now >= startTime && now <= endTime;

        if (!aborted) setIsLiveRace(isActiveRaceWindow);

        // Fetch fresh if: active race window, no cache, or admin forced
        const shouldFetchFresh = isActiveRaceWindow || cachedResults.length === 0 || resultsVersion > 0;

        if (shouldFetchFresh) {
          console.log('[RaceContext] Fetching fresh results from ChronoTrack (active race window)');
          const fresh = await fetchResultsForEvent(selectedEvent.id);

          if (!aborted && fresh.length > 0) {
            const seen = new Map();
            fresh.forEach(r => {
              const key = r.entry_id || `${r.bib || ''}-${r.race_id || ''}`;
              if (!seen.has(key)) seen.set(key, r);
            });
            const deduped = Array.from(seen.values());

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
              console.log('[RaceContext] Background update complete — Supabase refreshed');
              // Only update UI on initial load or admin force
              if (updateUI || resultsVersion > 0) {
                allResults = deduped;
                const divisions = [...new Set(deduped.map(r => r.age_group_name).filter(Boolean))].sort();
                if (!aborted) setUniqueDivisions(divisions);
              }
            }
          }
        } else {
          allResults = cachedResults;
          const divisions = [...new Set(cachedResults.map(r => r.age_group_name).filter(Boolean))].sort();
          if (!aborted) setUniqueDivisions(divisions);
        }

        if (updateUI && !aborted) setResults(allResults);
      } catch (err) {
        if (!aborted && updateUI) {
          console.error('[RaceContext] Results load error:', err);
          setError('Failed to load results');
        }
      } finally {
        if (updateUI && !aborted) setLoadingResults(false);
      }
    };

    // Initial load — updates UI
    loadResults(true);

    // Background updates ONLY during the actual race window (using event_start_time & event_end_time)
    const startTime = selectedEvent.start_time ? parseInt(selectedEvent.start_time, 10) : null;
    const endTime = selectedEvent.event_end_time ? parseInt(selectedEvent.event_end_time, 10) : null;

    if (startTime && endTime) {
      const now = Math.floor(Date.now() / 1000);
      if (now >= startTime && now <= endTime) {
        backgroundInterval = setInterval(() => {
          loadResults(false); // Background only — no UI update
          console.log('[RaceContext] Background refresh during race window');
        }, 30000); // Every 30 seconds while race is active

        console.log('[RaceContext] Race window active — aggressive background updates started (every 30s)');
      }
    }

    // Cleanup
    return () => {
      aborted = true;
      if (backgroundInterval) clearInterval(backgroundInterval);
      console.log('[RaceContext] Cleanup: background updates stopped');
    };
  }, [selectedEvent, resultsVersion]);

  // Admin-exposed refresh function
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