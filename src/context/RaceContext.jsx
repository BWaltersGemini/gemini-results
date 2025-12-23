// src/context/RaceContext.jsx
// FINAL — December 2025 Production Version
// • Continuous auto-looping live polling (with per-event toggle)
// • Supports finishers + nonFinishers (DNF/DQ) object from chronotrackapi
// • Fresh global config from Supabase (no localStorage cache)
// • Correct event_id string conversion for Supabase upserts
// • Admin-triggered forced refresh support
import { createContext, useState, useEffect } from 'react';
import { fetchEvents, fetchRacesForEvent, fetchResultsForEvent } from '../api/chronotrackapi';
import { supabase } from '../supabaseClient';
import { loadAppConfig } from '../utils/appConfig';

export const RaceContext = createContext();

export function RaceProvider({ children }) {
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [races, setRaces] = useState([]);
  const [results, setResults] = useState({ finishers: [], nonFinishers: [] });
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

  // Per-event live auto-fetch toggle (default ON during live window)
  const [liveAutoFetchPerEvent, setLiveAutoFetchPerEvent] = useState({});

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
      // Load per-event live auto-fetch settings — defaults to true when needed
      setLiveAutoFetchPerEvent(config.liveAutoFetchPerEvent || {});
      console.log('[RaceContext] Fresh global config loaded from Supabase');
    };
    loadConfig();
  }, []);

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

  // Results loading + continuous auto-looping live polling
  useEffect(() => {
    if (!selectedEvent) {
      setResults({ finishers: [], nonFinishers: [] });
      setUniqueDivisions([]);
      setIsLiveRace(false);
      return;
    }
    let aborted = false;
    const now = Math.floor(Date.now() / 1000);
    const startTime = selectedEvent.start_time ? parseInt(selectedEvent.start_time, 10) : null;
    const endTime = selectedEvent.event_end_time ? parseInt(selectedEvent.event_end_time, 10) : null;
    const isActiveWindow = startTime && endTime && now >= startTime && now <= endTime;
    const todayStr = new Date().toISOString().split('T')[0];
    const startDateStr = startTime ? new Date(startTime * 1000).toISOString().split('T')[0] : null;
    const isRaceDayFallback = !endTime && startDateStr === todayStr;
    const isLive = isActiveWindow || isRaceDayFallback;
    const isAutoFetchEnabled = liveAutoFetchPerEvent[selectedEvent.id] !== false;

    console.log(`[RaceContext] Live detection for event ${selectedEvent.id} (${selectedEvent.name || 'Unknown'}):`,
      `\n Active window: ${isActiveWindow}`,
      `\n Race day fallback: ${isRaceDayFallback}`,
      `\n → isLive: ${isLive}`,
      `\n Auto-fetch enabled: ${isAutoFetchEnabled}`
    );

    if (!aborted) setIsLiveRace(isLive);

    const loadResults = async (forceFresh = false) => {
      if (aborted) return;
      try {
        // Load cache first for instant UI
        let cachedFinishers = [];
        let start = 0;
        const pageSize = 1000;
        while (!aborted) {
          const { data, error } = await supabase
            .from('chronotrack_results')
            .select('*')
            .eq('event_id', String(selectedEvent.id))
            .range(start, start + pageSize - 1);
          if (error || !data || data.length === 0) break;
          cachedFinishers.push(...data);
          start += data.length;
          if (data.length < pageSize) break;
        }
        if (!aborted) {
          setResults({ finishers: cachedFinishers, nonFinishers: [] });
          console.log(`[RaceContext] Displaying cached finishers (${cachedFinishers.length} rows)`);
        }

        if (forceFresh) {
          console.log('[RaceContext] Starting background live fetch from ChronoTrack...');
          const fresh = await fetchResultsForEvent(selectedEvent.id);
          if (fresh.finishers.length > 0 || fresh.nonFinishers.length > 0) {
            // Prepare upsert payload with correct string event_id
            const toUpsert = [
              ...fresh.finishers.map(r => ({
                event_id: String(selectedEvent.id),
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
                _status: 'FIN',
              })),
              ...fresh.nonFinishers.map(r => ({
                event_id: String(selectedEvent.id),
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
                place: null,
                gender_place: null,
                age_group_name: r.age_group_name || null,
                age_group_place: null,
                pace: r.pace || null,
                splits: r.splits || [],
                race_name: r.race_name ?? null,
                _status: 'DNF',
              })),
            ];

            if (toUpsert.length > 0) {
              const uniqueMap = new Map();
              toUpsert.forEach(record => {
                const key = record.entry_id || `${record.event_id}-${record.bib}`;
                uniqueMap.set(key, record);
              });
              const finalToUpsert = Array.from(uniqueMap.values());

              const { error: upsertError } = await supabase
                .from('chronotrack_results')
                .upsert(finalToUpsert, { onConflict: 'event_id,entry_id' });

              if (upsertError) {
                console.error('[RaceContext] Upsert failed:', upsertError);
              } else {
                console.log('[RaceContext] Upsert successful');
              }
            }

            if (!aborted) {
              setResults(fresh);
              console.log('[RaceContext] Live update complete');
            }
          } else {
            console.warn('[RaceContext] Fresh fetch returned no results');
          }
        }

        const divisions = [...new Set(cachedFinishers.map(r => r.age_group_name).filter(Boolean))].sort();
        if (!aborted) setUniqueDivisions(divisions);
      } catch (err) {
        if (!aborted) {
          console.error('[RaceContext] Background fetch error:', err);
        }
      } finally {
        if (!forceFresh && !aborted) setLoadingResults(false);
      }
    };

    // Initial load
    loadResults(resultsVersion > 0);

    // Continuous auto-looping live polling
    const continuousLiveFetch = async () => {
      if (!isLive || !isAutoFetchEnabled || aborted) return;
      try {
        console.log('[RaceContext] Starting next live fetch cycle...');
        await loadResults(true);
      } catch (err) {
        console.error('[RaceContext] Live fetch cycle error:', err);
      }
      setTimeout(continuousLiveFetch, 5000); // 5-second interval (tested safe)
    };

    if (isLive && isAutoFetchEnabled) {
      continuousLiveFetch();
      console.log('[RaceContext] Continuous live polling started (5s interval)');
    } else {
      console.log(`[RaceContext] Live polling disabled (isLive: ${isLive}, auto-fetch: ${isAutoFetchEnabled})`);
    }

    return () => {
      aborted = true;
    };
  }, [selectedEvent, resultsVersion, liveAutoFetchPerEvent]);

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