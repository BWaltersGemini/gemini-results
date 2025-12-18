// src/context/RaceContext.jsx (FINAL — Fully updated for latest chronotrackapi)
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
  const [totalAthletesTimed, setTotalAthletesTimed] = useState(0);
  const [totalRacesTimed, setTotalRacesTimed] = useState(0);

  // Global config from Supabase
  const [masterGroups, setMasterGroups] = useState({});
  const [editedEvents, setEditedEvents] = useState({});
  const [eventLogos, setEventLogos] = useState({});
  const [hiddenMasters, setHiddenMasters] = useState([]);
  const [showAdsPerMaster, setShowAdsPerMaster] = useState({});
  const [ads, setAds] = useState([]);

  // Persist selected event
  useEffect(() => {
    const savedEventId = typeof window !== 'undefined' ? localStorage.getItem('selectedEventId') : null;
    if (savedEventId && events.length > 0) {
      const restored = events.find(e => e.id === savedEventId);
      if (restored) setSelectedEvent(restored);
      else localStorage.removeItem('selectedEventId');
    }
  }, [events]);

  useEffect(() => {
    if (selectedEvent && typeof window !== 'undefined') {
      localStorage.setItem('selectedEventId', selectedEvent.id);
    } else if (typeof window !== 'undefined') {
      localStorage.removeItem('selectedEventId');
    }
  }, [selectedEvent]);

  // Load global config
  useEffect(() => {
    const loadGlobalConfig = async () => {
      const config = await loadAppConfig();
      setMasterGroups(config.masterGroups || {});
      setEditedEvents(config.editedEvents || {});
      setEventLogos(config.eventLogos || {});
      setHiddenMasters(config.hiddenMasters || []);
      setShowAdsPerMaster(config.showAdsPerMaster || {});
      setAds(config.ads || []);
      console.log('[RaceContext] Global config loaded from Supabase');
    };
    loadGlobalConfig();
  }, []);

  const updateAthleteCount = async () => {
    try {
      const { count } = await supabase
        .from('chronotrack_results')
        .select('*', { count: 'exact', head: true });
      setTotalAthletesTimed(count || 0);
    } catch (err) {
      console.warn('[RaceContext] Could not update athlete count:', err);
    }
  };

  // Fetch events
  useEffect(() => {
    const loadEvents = async () => {
      try {
        setLoading(true);
        setError(null);
        const fetchedEvents = await fetchEvents();
        console.log('[RaceContext] Events fetched:', fetchedEvents.length);
        setEvents(fetchedEvents);

        const completed = fetchedEvents.filter(e => new Date(e.date) <= new Date());
        setTotalRacesTimed(completed.length);
        await updateAthleteCount();
      } catch (err) {
        console.error('[RaceContext] Failed to load events:', err);
        setError(err.message || 'Failed to load events');
      } finally {
        setLoading(false);
      }
    };
    loadEvents();
  }, []);

  // Load races
  useEffect(() => {
    if (!selectedEvent) {
      setRaces([]);
      return;
    }
    let aborted = false;
    const loadRaces = async () => {
      if (aborted) return;
      try {
        const fetched = await fetchRacesForEvent(selectedEvent.id);
        if (!aborted) setRaces(fetched);
      } catch (err) {
        if (!aborted) {
          console.error('[RaceContext] Failed to load races:', err);
          setRaces([]);
        }
      }
    };
    loadRaces();
    return () => { aborted = true; };
  }, [selectedEvent]);

  // Load results + live polling
  useEffect(() => {
    if (!selectedEvent) {
      setResults([]);
      setUniqueDivisions([]);
      setIsLiveRace(false);
      return;
    }

    let aborted = false;
    let interval = null;

    const loadResults = async (forceFresh = false) => {
      if (aborted || !selectedEvent) return;

      try {
        setLoadingResults(true);
        setError(null);
        let allResults = [];

        // Try cache first
        let cached = [];
        let page = 0;
        const pageSize = 1000;
        while (true) {
          const { data, error } = await supabase
            .from('chronotrack_results')
            .select('*')
            .eq('event_id', selectedEvent.id.toString())
            .order('place', { ascending: true })
            .range(page * pageSize, (page + 1) * pageSize - 1);

          if (error || !data || data.length === 0) break;
          cached = [...cached, ...data];
          if (data.length < pageSize) break;
          page++;
        }

        if (cached.length > 0) {
          allResults = cached;
          console.log(`[Results] Loaded ${cached.length} from cache`);
        }

        const todayStr = new Date().toISOString().split('T')[0];
        const isRaceDay = selectedEvent.date === todayStr;
        if (!aborted) setIsLiveRace(isRaceDay);

        if (forceFresh || isRaceDay || cached.length === 0) {
          console.log('[Results] Fetching fresh from ChronoTrack...');
          const fresh = await fetchResultsForEvent(selectedEvent.id);
          console.log(`[Results] Got ${fresh.length} fresh results`);

          if (fresh.length > 0) {
            // Deduplicate by bib + race_id (handles rare duplicates)
            const seen = new Map();
            fresh.forEach(r => {
              const key = `${r.bib || ''}-${r.race_id || ''}`;
              if (!seen.has(key) || (r.entry_id && !seen.get(key).entry_id)) {
                seen.set(key, r);
              }
            });
            const deduped = Array.from(seen.values());
            console.log(`[Results] Deduplicated: ${fresh.length} → ${deduped.length}`);

            const toUpsert = deduped.map(r => ({
              event_id: selectedEvent.id.toString(),
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

            // Clear old data
            await supabase
              .from('chronotrack_results')
              .delete()
              .eq('event_id', selectedEvent.id.toString());

            // Insert in chunks
            const chunkSize = 500;
            for (let i = 0; i < toUpsert.length; i += chunkSize) {
              const chunk = toUpsert.slice(i, i + chunkSize);
              const { error } = await supabase.from('chronotrack_results').insert(chunk);
              if (error) console.error('[Supabase] Insert error:', error);
            }

            allResults = deduped;
            await updateAthleteCount();
            console.log('[Results] Fresh results saved to Supabase');
          }
        }

        if (!aborted) {
          setResults(allResults);
          const divisions = [...new Set(allResults.map(r => r.age_group_name).filter(Boolean))].sort();
          setUniqueDivisions(divisions);
        }
      } catch (err) {
        if (!aborted) {
          console.error('[Results] Load error:', err);
          setError('Failed to load results');
        }
      } finally {
        if (!aborted) setLoadingResults(false);
      }
    };

    loadResults();

    // Live polling on race day
    const todayStr = new Date().toISOString().split('T')[0];
    if (selectedEvent.date === todayStr) {
      interval = setInterval(() => loadResults(true), 120000);
      console.log('[Results] Live polling started');
    }

    return () => {
      aborted = true;
      if (interval) clearInterval(interval);
    };
  }, [selectedEvent]);

  return (
    <RaceContext.Provider value={{
      events,
      selectedEvent,
      setSelectedEvent,
      races,
      results,
      loading,
      loadingResults,
      error,
      uniqueDivisions,
      eventLogos,
      ads,
      masterGroups,
      editedEvents,
      hiddenMasters,
      showAdsPerMaster,
      isLiveRace,
      totalAthletesTimed,
      totalRacesTimed,
    }}>
      {children}
    </RaceContext.Provider>
  );
}