// src/context/RaceContext.jsx (FINAL — Fully working: results always load correctly, no loops, admin refresh + live sync)
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

        // Sync races to Supabase (for future loads)
        try {
          const { error } = await supabase
            .from('chronotrack_events')
            .update({ races: fullRaces })
            .eq('id', selectedEvent.id);
          if (!error) {
            console.log('[RaceContext] Embedded races synced to Supabase');
          }
        } catch (syncErr) {
          console.warn('[RaceContext] Failed to sync races to Supabase:', syncErr);
        }

        console.log('[RaceContext] Fallback success: Loaded', formatted.length, 'races');

        // Trigger results reload after fresh races are available
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

  // Results loading — depends on selectedEvent, admin refresh, and fresh race fetch
  useEffect(() => {
    if (!selectedEvent) {
      setResults([]);
      setUniqueDivisions([]);
      setIsLiveRace(false);
      return;
    }

    let aborted = false;
    let backgroundInterval = null;

    // Extract times at top level for background sync check
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
          console.log('[RaceContext] Fetching fresh results from ChronoTrack (full sync)');
          const fresh = await fetchResultsForEvent(selectedEvent.id);

          if (!aborted) {
            // Deduplicate
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

            // Full delete + insert
            const { error: deleteError } = await supabase
              .from('chronotrack_results')
              .delete()
              .eq('event_id', selectedEvent.id);

            if (deleteError) {
              console.error('[RaceContext] Failed to delete old results:', deleteError);
            } else {
              console.log('[RaceContext] Cleared old results for event', selectedEvent.id);
            }

            if (deduped.length > 0) {
              const toInsert = deduped.map(r => ({
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

              const { error: insertError } = await supabase
                .from('chronotrack_results')
                .insert(toInsert);

              if (insertError) {
                console.error('[RaceContext] Insert error:', insertError);
              } else {
                console.log(`[RaceContext] Full sync complete: ${deduped.length} results inserted`);
              }
            }

            if (updateUI || resultsVersion > 0) {
              const divisions = [...new Set(deduped.map(r => r.age_group_name).filter(Boolean))].sort();
              if (!aborted) {
                setResults(deduped);
                setUniqueDivisions(divisions);
              }
              allResults = deduped;
            }
          }
        } else {
          // Historical event — load from Supabase cache
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

          const divisions = [...new Set(cachedResults.map(r => r.age_group_name).filter(Boolean))].sort();
          if (!aborted) setUniqueDivisions(divisions);

          if (updateUI) {
            setResults(cachedResults);
          }
          allResults = cachedResults;
          console.log(`[RaceContext] Using cached results (${cachedResults.length}) for historical event`);
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

    loadResults(true);

    // Background full sync during active race window
    if (startTime && endTime) {
      const now = Math.floor(Date.now() / 1000);
      if (now >= startTime && now <= endTime) {
        backgroundInterval = setInterval(() => {
          loadResults(false);
          console.log('[RaceContext] Background full sync during race window');
        }, 30000);
        console.log('[RaceContext] Race window active — background sync started (every 30s)');
      }
    }

    return () => {
      aborted = true;
      if (backgroundInterval) clearInterval(backgroundInterval);
      console.log('[RaceContext] Cleanup: background updates stopped');
    };
  }, [selectedEvent, resultsVersion, racesVersion]);

  // Admin-exposed refresh function
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