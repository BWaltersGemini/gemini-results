// src/context/RaceContext.jsx (FINAL — Smart UPSERT sync + last_updated timestamp + smooth live updates)
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

  // Triggers
  const [resultsVersion, setResultsVersion] = useState(0); // Admin forced refresh
  const [racesVersion, setRacesVersion] = useState(0);     // Fresh race fetch → force results reload

  // Global config
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

  // Persist selectedEventId in localStorage
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

  // Race loading — optimized, no loops
  useEffect(() => {
    if (!selectedEvent) {
      setRaces([]);
      return;
    }

    const loadRaces = async () => {
      const embeddedRaces = selectedEvent.races || [];
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

        // Sync to Supabase
        try {
          const { error } = await supabase
            .from('chronotrack_events')
            .update({ races: fullRaces })
            .eq('id', selectedEvent.id);
          if (!error) console.log('[RaceContext] Embedded races synced to Supabase');
        } catch (syncErr) {
          console.warn('[RaceContext] Failed to sync races to Supabase:', syncErr);
        }

        console.log('[RaceContext] Fallback success: Loaded', formatted.length, 'races');

        // Trigger results reload after fresh races
        setRacesVersion(prev => prev + 1);
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
  }, [selectedEvent?.id]);

  // Results loading — smart UPSERT sync
  useEffect(() => {
    if (!selectedEvent) {
      setResults([]);
      setUniqueDivisions([]);
      setIsLiveRace(false);
      return;
    }

    let aborted = false;
    let backgroundInterval = null;

    const startTime = selectedEvent.start_time ? parseInt(selectedEvent.start_time, 10) : null;
    const endTime = selectedEvent.event_end_time ? parseInt(selectedEvent.event_end_time, 10) : null;

    const loadResults = async (updateUI = true) => {
      if (aborted) return;

      try {
        if (updateUI) {
          setLoadingResults(true);
          setError(null);
        }

        const now = Math.floor(Date.now() / 1000);
        const isActiveRaceWindow = startTime && endTime && now >= startTime && now <= endTime;
        if (!aborted) setIsLiveRace(isActiveRaceWindow);

        const shouldFetchFresh = isActiveRaceWindow || resultsVersion > 0;

        let allResults = [];

        if (shouldFetchFresh) {
          console.log('[RaceContext] Fetching fresh results from ChronoTrack (smart sync)');
          const fresh = await fetchResultsForEvent(selectedEvent.id);

          if (!aborted) {
            // Deduplicate fresh results
            let deduped = [];
            if (fresh.length > 0) {
              const seen = new Map();
              fresh.forEach(r => {
                const key = r.entry_id || `${r.bib || ''}-${r.race_id || ''}`;
                if (!seen.has(key)) {
                  seen.set(key, r);
                  deduped.push(r);
                }
              });
            }

            let changesMade = false;

            if (deduped.length > 0) {
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

              const { error, count } = await supabase
                .from('chronotrack_results')
                .upsert(toUpsert, { onConflict: 'event_id,entry_id', count: 'exact' });

              if (error) {
                console.error('[RaceContext] Upsert error:', error);
              } else {
                console.log(`[RaceContext] Upsert complete: ${count} rows affected`);
                if (count > 0) changesMade = true;
              }
            }

            // Only bump last_updated if real changes occurred
            if (changesMade) {
              const { error: tsError } = await supabase
                .from('chronotrack_events')
                .update({ last_updated: new Date().toISOString() })
                .eq('id', selectedEvent.id);

              if (tsError) {
                console.error('[RaceContext] Failed to update last_updated:', tsError);
              } else {
                console.log('[RaceContext] last_updated timestamp bumped due to changes');
              }
            }
            allResults = deduped;
          }
        } else {
          // Historical — load from Supabase cache
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

            if (error || !data || data.length === 0) break;
            cachedResults = [...cachedResults, ...data];
            start += data.length;
            if (data.length < pageSize) break;
          }

          allResults = cachedResults;
          console.log(`[RaceContext] Using cached results (${cachedResults.length}) for historical event`);
        }

        // Update UI on initial load, admin refresh, or fresh race fetch
        if (updateUI || resultsVersion > 0 || racesVersion > 0) {
          const divisions = [...new Set(allResults.map(r => r.age_group_name).filter(Boolean))].sort();
          if (!aborted) {
            setResults(allResults);
            setUniqueDivisions(divisions);
          }
        }
      } catch (err) {
        if (!aborted && updateUI) {
          console.error('[RaceContext] Results load error:', err);
          setError('Failed to load results');
        }
      } finally {
        if (updateUI && !aborted) setLoadingResults(false);
      }
    };

    loadResults(true);

    // Background sync during live race window
    if (startTime && endTime) {
      const now = Math.floor(Date.now() / 1000);
      if (now >= startTime && now <= endTime) {
        backgroundInterval = setInterval(() => {
          loadResults(false);
          console.log('[RaceContext] Background smart sync running');
        }, 30000);
        console.log('[RaceContext] Race window active — background smart sync started (every 30s)');
      }
    }

    return () => {
      aborted = true;
      if (backgroundInterval) clearInterval(backgroundInterval);
      console.log('[RaceContext] Cleanup: background sync stopped');
    };
  }, [selectedEvent, resultsVersion, racesVersion]);

  // Admin refresh
  const refreshResults = () => {
    console.log('[RaceContext] Admin triggered forced full refresh');
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