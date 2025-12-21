// src/context/RaceContext.jsx (FINAL — Complete, No Truncations, Optimized Live Polling with Deletion Support)
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

  // Per-event live auto-fetch toggle (default ON)
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

      // Load per-event live auto-fetch settings — defaults to true
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

  // Results loading + optimized background live polling (with deletion of removed participants)
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
    const todayStr = new Date().toISOString().split('T')[0];
    const startDateStr = startTime ? new Date(startTime * 1000).toISOString().split('T')[0] : null;
    const isRaceDayFallback = !endTime && startDateStr === todayStr;

    const isLive = isActiveWindow || isRaceDayFallback;

    const isAutoFetchEnabled = liveAutoFetchPerEvent[selectedEvent.id] !== false;

    console.log(`[RaceContext] Live detection for event ${selectedEvent.id} (${selectedEvent.name || 'Unknown'}):`,
      `\n  Current time: ${new Date(now * 1000).toLocaleString()}`,
      `\n  Start time: ${startTime ? new Date(startTime * 1000).toLocaleString() : 'null'}`,
      `\n  End time: ${endTime ? new Date(endTime * 1000).toLocaleString() : 'null'}`,
      `\n  Active window: ${isActiveWindow}`,
      `\n  Race day fallback: ${isRaceDayFallback}`,
      `\n  → isLive: ${isLive}`,
      `\n  Auto-fetch enabled: ${isAutoFetchEnabled}`
    );

    if (!aborted) setIsLiveRace(isLive);

    const loadResults = async (forceFresh = false) => {
      if (aborted) return;

      try {
        // Load cache first for instant UI
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

        if (!aborted) {
          setResults(cachedResults);
          console.log(`[RaceContext] Displaying cached results (${cachedResults.length} rows)`);
        }

        if (forceFresh) {
          console.log('[RaceContext] Starting background live fetch from ChronoTrack...');
          const fresh = await fetchResultsForEvent(selectedEvent.id);

          if (fresh.length > 0) {
            // Build set of fresh entry_ids
            const freshEntryIds = new Set(fresh.map(r => r.entry_id).filter(Boolean));

            // Find removed participants (DNS/DNF/DQ)
            const toDelete = cachedResults
              .filter(r => r.entry_id && !freshEntryIds.has(r.entry_id))
              .map(r => r.entry_id);

            if (toDelete.length > 0) {
              console.log(`[RaceContext] Removing ${toDelete.length} participants no longer in ChronoTrack results (DNS/DNF/DQ)`);

              const { error: deleteError } = await supabase
                .from('chronotrack_results')
                .delete()
                .in('entry_id', toDelete)
                .eq('event_id', selectedEvent.id);

              if (deleteError) {
                console.error('[RaceContext] Failed to delete removed participants:', deleteError);
              }
            }

            // Find new/changed records
            const toUpsert = [];
            fresh.forEach(r => {
              const existing = cachedResults.find(c => c.entry_id === r.entry_id);
              if (!existing || JSON.stringify(existing) !== JSON.stringify(r)) {
                toUpsert.push({
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
                });
              }
            });

            if (toUpsert.length > 0) {
              console.log(`[RaceContext] ${toUpsert.length} new/changed results → preparing upsert`);

              // Final dedup
              const uniqueMap = new Map();
              toUpsert.forEach(record => {
                const key = record.entry_id || `${record.event_id}-${record.bib}`;
                uniqueMap.set(key, record);
              });
              const finalToUpsert = Array.from(uniqueMap.values());

              console.log(`[RaceContext] Final upsert batch: ${finalToUpsert.length} unique records`);

              const { error: upsertError } = await supabase
                .from('chronotrack_results')
                .upsert(finalToUpsert, { onConflict: 'event_id,entry_id' });

              if (upsertError) {
                console.error('[RaceContext] Background upsert failed:', upsertError);
              } else {
                // Merge fresh + deletions into current results
                let updatedResults = cachedResults.filter(r => !toDelete.includes(r.entry_id));
                finalToUpsert.forEach(newRec => {
                  const index = updatedResults.findIndex(r => r.entry_id === newRec.entry_id);
                  if (index !== -1) {
                    updatedResults[index] = { ...updatedResults[index], ...newRec };
                  } else {
                    updatedResults.push(newRec);
                  }
                });

                if (!aborted) {
                  setResults(updatedResults);
                  console.log('[RaceContext] Live update complete — UI refreshed seamlessly');
                }
              }
            } else if (toDelete.length > 0) {
              // Only deletions happened
              const updatedResults = cachedResults.filter(r => !toDelete.includes(r.entry_id));
              if (!aborted) {
                setResults(updatedResults);
                console.log('[RaceContext] Live update complete — removed participants');
              }
            } else {
              console.log('[RaceContext] No changes detected');
            }
          } else {
            console.warn('[RaceContext] Fresh fetch returned 0 results');
          }
        }

        const divisions = [...new Set(cachedResults.map(r => r.age_group_name).filter(Boolean))].sort();
        if (!aborted) setUniqueDivisions(divisions);

      } catch (err) {
        if (!aborted) {
          console.error('[RaceContext] Background fetch error:', err);
        }
      } finally {
        if (!forceFresh && !aborted) setLoadingResults(false);
      }
    };

    loadResults(resultsVersion > 0);

    if (isLive && isAutoFetchEnabled) {
      if (isActiveWindow) {
        pollInterval = setInterval(() => loadResults(true), 30000);
        console.log('[RaceContext] Live polling started — 30s interval (active race window)');
      } else if (isRaceDayFallback) {
        pollInterval = setInterval(() => loadResults(true), 60000);
        console.log('[RaceContext] Race day polling started — 60s interval');
      }
    } else {
      console.log(`[RaceContext] Live polling disabled for event ${selectedEvent.id} (isLive: ${isLive}, auto-fetch: ${isAutoFetchEnabled})`);
    }

    return () => {
      aborted = true;
      if (pollInterval) clearInterval(pollInterval);
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