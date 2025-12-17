// src/context/RaceContext.jsx (FINAL — Division place saved to Supabase, gender place calculated in frontend)
import { createContext, useState, useEffect } from 'react';
import { fetchEvents, fetchRacesForEvent, fetchResultsForEvent } from '../api/chronotrackapi.cjs';
import { supabase } from '../supabaseClient.js';
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

  // Shared global config loaded from Supabase
  const [masterGroups, setMasterGroups] = useState({});
  const [editedEvents, setEditedEvents] = useState({});
  const [eventLogos, setEventLogos] = useState({});
  const [hiddenMasters, setHiddenMasters] = useState([]);
  const [showAdsPerMaster, setShowAdsPerMaster] = useState({});
  const [ads, setAds] = useState([]);

  // Persist last viewed event in localStorage (user preference)
  useEffect(() => {
    const savedEventId = typeof window !== 'undefined' ? localStorage.getItem('selectedEventId') : null;
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
    if (selectedEvent) {
      if (typeof window !== 'undefined') {
        localStorage.setItem('selectedEventId', selectedEvent.id);
      }
    } else {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('selectedEventId');
      }
    }
  }, [selectedEvent]);

  // Load global app config from Supabase once on mount
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
      const { count, error } = await supabase
        .from('chronotrack_results')
        .select('*', { count: 'exact', head: true });
      if (error) throw error;
      setTotalAthletesTimed(count || 0);
    } catch (err) {
      console.warn('[RaceContext] Could not update athlete count:', err);
    }
  };

  const findEvents = (searchTerm) => {
    if (!searchTerm) return events;
    const lower = searchTerm.toLowerCase();
    return events.filter(e =>
      e.name?.toLowerCase().includes(lower) ||
      e.id?.toString().includes(searchTerm)
    ).map(e => ({
      id: e.id,
      name: e.name,
      date: e.date,
    }));
  };

  // Fetch events from ChronoTrack
  useEffect(() => {
    console.log('[RaceContext] Provider mounted — fetching events');
    const loadEvents = async () => {
      console.log('[RaceContext] Starting to fetch events...');
      try {
        setLoading(true);
        setError(null);
        const fetchedEvents = await fetchEvents();
        console.log('[RaceContext] Events fetched successfully:', fetchedEvents.length, 'total events');
        setEvents(fetchedEvents);

        const completedEvents = fetchedEvents.filter(e => new Date(e.date) <= new Date());
        setTotalRacesTimed(completedEvents.length);
        await updateAthleteCount();
      } catch (err) {
        console.error('[RaceContext] Failed to load events:', err);
        setError(err.message || 'Failed to load events.');
        setTotalAthletesTimed(0);
        setTotalRacesTimed(0);
      } finally {
        setLoading(false);
      }
    };
    loadEvents();
    return () => console.log('[RaceContext] Provider cleanup');
  }, []);

  // Load races for selected event
  useEffect(() => {
    if (!selectedEvent) {
      setRaces([]);
      return;
    }
    const loadRaces = async () => {
      try {
        console.log(`[Races] Loading races for event ${selectedEvent.id}`);
        const fetchedRaces = await fetchRacesForEvent(selectedEvent.id);
        setRaces(fetchedRaces);
        console.log(`[Races] Loaded ${fetchedRaces.length} races`);
      } catch (err) {
        console.error('[Races] Failed to load races:', err);
        setRaces([]);
      }
    };
    loadRaces();
  }, [selectedEvent]);

  // Load results + live polling — Save age_group_place from ChronoTrack, gender_place null
  useEffect(() => {
    if (!selectedEvent) {
      console.log('[Results] No selected event — clearing results');
      setResults([]);
      setUniqueDivisions([]);
      setIsLiveRace(false);
      return;
    }

    console.log(`[Results] Loading results for event ${selectedEvent.id} — "${selectedEvent.name}" (${selectedEvent.date})`);
    let interval;

    const loadResults = async (forceFresh = false) => {
      try {
        setLoadingResults(true);
        setError(null);
        let allResults = [];
        let allCached = [];
        let page = 0;
        const pageSize = 1000;

        console.log('[Results] Checking Supabase cache...');
        while (true) {
          const { data, error } = await supabase
            .from('chronotrack_results')
            .select('*')
            .eq('event_id', selectedEvent.id.toString())
            .order('place', { ascending: true })
            .range(page * pageSize, (page + 1) * pageSize - 1);

          if (error) {
            console.error('[Supabase] Cache error:', error);
            break;
          }
          if (!data || data.length === 0) break;
          allCached = [...allCached, ...data];
          if (data.length < pageSize) break;
          page++;
        }

        if (allCached.length > 0) {
          allResults = allCached;
          console.log(`[Results] Loaded ${allCached.length} results from Supabase cache`);
        } else {
          console.log('[Results] No cached results — forcing fresh fetch from ChronoTrack');
          forceFresh = true;
        }

        const todayStr = new Date().toISOString().split('T')[0];
        const isRaceDay = selectedEvent.date === todayStr;
        setIsLiveRace(isRaceDay);

        if (forceFresh || isRaceDay) {
          console.log('[Results] Fetching fresh results from ChronoTrack...');
          const fresh = await fetchResultsForEvent(selectedEvent.id);
          console.log(`[Results] Received ${fresh.length} fresh results from ChronoTrack`);

          if (fresh.length > 0) {
            const toUpsert = fresh.map(r => ({
              event_id: selectedEvent.id.toString(),
              race_id: r.race_id || null,
              bib: r.bib || null,
              first_name: r.first_name || null,
              last_name: r.last_name || null,
              gender: r.gender || null,
              age: r.age ? parseInt(r.age, 10) : null,
              city: r.city || null,
              state: r.state || null,
              country: r.country || null,
              chip_time: r.chip_time || null,
              clock_time: r.clock_time || null,
              place: r.place ? parseInt(r.place, 10) : null,
              gender_place: null, // Calculated per-race in ResultsPage
              age_group_name: r.age_group_name || null,
              age_group_place: r.age_group_place ? parseInt(r.age_group_place, 10) : null, // Saved from ChronoTrack bracket
              pace: r.pace || null,
              splits: r.splits || [],
              entry_id: r.entry_id || null,
            }));

            // Clear old and insert fresh
            await supabase.from('chronotrack_results').delete().eq('event_id', selectedEvent.id.toString());

            const chunkSize = 500;
            for (let i = 0; i < toUpsert.length; i += chunkSize) {
              const chunk = toUpsert.slice(i, i + chunkSize);
              const { error } = await supabase.from('chronotrack_results').insert(chunk);
              if (error) console.error('[Supabase] Insert error:', error);
            }

            allResults = fresh;
            await updateAthleteCount();
            console.log('[Results] Fresh results saved to Supabase and athlete count updated');
          }
        }

        setResults(allResults);
        const divisions = [...new Set(allResults.map(r => r.age_group_name).filter(Boolean))].sort();
        setUniqueDivisions(divisions);
        console.log(`[Results] Final: ${allResults.length} results loaded`);
      } catch (err) {
        console.error('[Results] Load error:', err);
        setError('Failed to load results.');
      } finally {
        setLoadingResults(false);
      }
    };

    loadResults();

    const todayStr = new Date().toISOString().split('T')[0];
    if (selectedEvent.date === todayStr) {
      interval = setInterval(() => loadResults(true), 120000);
      console.log('[Results] Live polling started (every 2 minutes)');
    }

    return () => {
      if (interval) {
        clearInterval(interval);
        console.log('[Results] Live polling stopped');
      }
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
      debug: { findEvents },
    }}>
      {children}
    </RaceContext.Provider>
  );
}