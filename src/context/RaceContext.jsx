// src/context/RaceContext.jsx (FINAL — Live updates, safe cache, integer parsing, country/splits support)
import { createContext, useState, useEffect } from 'react';
import { fetchEvents, fetchRacesForEvent, fetchResultsForEvent } from '../api/chronotrackapi';
import { supabase } from '../supabaseClient';

export const RaceContext = createContext();

export function RaceProvider({ children }) {
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [races, setRaces] = useState([]);
  const [selectedRace, setSelectedRace] = useState(null);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingResults, setLoadingResults] = useState(false);
  const [error, setError] = useState(null);
  const [uniqueDivisions, setUniqueDivisions] = useState([]);
  const [eventLogos, setEventLogos] = useState(JSON.parse(localStorage.getItem('eventLogos')) || {});
  const [ads, setAds] = useState(JSON.parse(localStorage.getItem('ads')) || {});
  const [isLiveRace, setIsLiveRace] = useState(false);

  // Simple hash for detecting changes
  const hashResults = (resultsArray) => {
    const str = JSON.stringify(
      resultsArray.map(r => ({
        bib: r.bib,
        first_name: r.first_name,
        last_name: r.last_name,
        chip_time: r.chip_time,
        place: r.place,
        gender_place: r.gender_place,
        age_group_place: r.age_group_place,
      })).sort((a, b) => (a.place || Infinity) - (b.place || Infinity))
    );
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString();
  };

  // Load events on mount
  useEffect(() => {
    const loadEvents = async () => {
      console.log('[RaceContext] Starting to fetch events...');
      try {
        setLoading(true);
        setError(null);
        const fetchedEvents = await fetchEvents();
        console.log('[RaceContext] Events fetched successfully:', fetchedEvents);
        setEvents(fetchedEvents);

        // Restore last selected event
        const savedEventId = localStorage.getItem('selectedEventId');
        if (savedEventId) {
          const restored = fetchedEvents.find(e => e.id === savedEventId);
          if (restored) {
            console.log('[RaceContext] Restoring selected event:', restored);
            setSelectedEvent(restored);
          } else {
            localStorage.removeItem('selectedEventId');
          }
        }
      } catch (err) {
        console.error('[RaceContext] Failed to load events:', err);
        setError(err.message || 'Failed to load events.');
      } finally {
        setLoading(false);
      }
    };
    loadEvents();
  }, []);

  // Persist selectedEvent
  useEffect(() => {
    if (selectedEvent) {
      localStorage.setItem('selectedEventId', selectedEvent.id);
    } else {
      localStorage.removeItem('selectedEventId');
    }
  }, [selectedEvent]);

  // Load races when event changes
  useEffect(() => {
    if (!selectedEvent) {
      setRaces([]);
      setSelectedRace(null);
      return;
    }

    const loadRaces = async () => {
      try {
        const fetchedRaces = await fetchRacesForEvent(selectedEvent.id);
        setRaces(fetchedRaces);
        if (fetchedRaces.length > 0) {
          setSelectedRace(fetchedRaces[0]);
        }
      } catch (err) {
        console.error('Failed to load races:', err);
        setRaces([]);
      }
    };
    loadRaces();
  }, [selectedEvent]);

  // Load results + live polling on race day
  useEffect(() => {
    if (!selectedEvent) {
      setResults([]);
      setIsLiveRace(false);
      return;
    }

    let currentHash = '';
    let interval;

    const loadResults = async (forceFresh = false) => {
      try {
        setLoadingResults(true);
        setError(null);

        let allResults = [];

        // 1. Try Supabase cache
        let allCached = [];
        let page = 0;
        const pageSize = 1000;
        while (true) {
          const { data, error } = await supabase
            .from('chronotrack_results')
            .select('*')
            .eq('event_id', selectedEvent.id.toString())
            .order('place', { ascending: true })
            .range(page * pageSize, (page + 1) * pageSize - 1);

          if (error) {
            console.error('[Supabase] Cache read error:', error);
            break;
          }
          if (!data || data.length === 0) break;
          allCached = [...allCached, ...data];
          if (data.length < pageSize) break;
          page++;
        }

        if (allCached.length > 0) {
          allResults = allCached;
          console.log(`[Supabase] Loaded ${allCached.length} results from cache`);
        }

        // Is today race day?
        const todayStr = new Date().toISOString().split('T')[0];
        const isRaceDay = selectedEvent.date === todayStr;
        setIsLiveRace(isRaceDay);

        // Fetch fresh if cache empty OR race day OR forced
        if (allCached.length === 0 || isRaceDay || forceFresh) {
          console.log('[RaceContext] Fetching fresh results from ChronoTrack');
          const fresh = await fetchResultsForEvent(selectedEvent.id);
          console.log(`[ChronoTrack] Fresh results: ${fresh.length}`);

          const freshHash = hashResults(fresh);
          if (freshHash !== currentHash && fresh.length > 0) {
            console.log('[RaceContext] Results changed — updating cache and state');
            currentHash = freshHash;

            // Upsert fresh data
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
              gender_place: r.gender_place ? parseInt(r.gender_place, 10) : null,
              age_group_name: r.age_group_name || null,
              age_group_place: r.age_group_place ? parseInt(r.age_group_place, 10) : null,
              pace: r.pace || null,
              splits: r.splits || [],
            }));

            const chunkSize = 500;
            for (let i = 0; i < toUpsert.length; i += chunkSize) {
              const chunk = toUpsert.slice(i, i + chunkSize);
              const { error } = await supabase
                .from('chronotrack_results')
                .upsert(chunk, { ignoreDuplicates: true });
              if (error) console.error('[Supabase] Upsert error:', error);
            }

            allResults = fresh;
          }
        }

        setResults(allResults);
        const divisions = [...new Set(allResults.map(r => r.age_group_name).filter(Boolean))].sort();
        setUniqueDivisions(divisions);
      } catch (err) {
        console.error('[RaceContext] Results load error:', err);
        setError('Failed to load results.');
      } finally {
        setLoadingResults(false);
      }
    };

    loadResults();

    // Poll every 2 minutes on race day
    const todayStr = new Date().toISOString().split('T')[0];
    if (selectedEvent.date === todayStr) {
      interval = setInterval(() => loadResults(true), 120000);
      console.log('[RaceContext] Live polling started (every 2 min)');
    }

    return () => clearInterval(interval);
  }, [selectedEvent]);

  useEffect(() => {
    console.log('[RaceContext] Results updated. Count:', results.length);
  }, [results]);

  return (
    <RaceContext.Provider value={{
      events,
      selectedEvent,
      setSelectedEvent,
      races,
      selectedRace,
      results,
      loading,
      loadingResults,
      error,
      uniqueDivisions,
      eventLogos,
      ads,
      isLiveRace,
    }}>
      {children}
    </RaceContext.Provider>
  );
}