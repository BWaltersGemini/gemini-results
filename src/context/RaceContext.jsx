// src/context/RaceContext.jsx (FINAL — Live updates, cache-first, integer parsing)
import { createContext, useState, useEffect } from 'react';
import { fetchEvents, fetchRacesForEvent, fetchResultsForEvent } from '../api/chronotrackapi';
import { supabase } from '../supabaseClient';

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

  // Load events
  useEffect(() => {
    const loadEvents = async () => {
      console.log('[RaceContext] Starting to fetch events...');
      try {
        setLoading(true);
        setError(null);
        const fetchedEvents = await fetchEvents();
        console.log('[RaceContext] Events fetched successfully:', fetchedEvents);
        setEvents(fetchedEvents);

        // Restore selected event
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

  // Load races
  useEffect(() => {
    if (!selectedEvent) {
      setRaces([]);
      return;
    }

    const loadRaces = async () => {
      try {
        const fetchedRaces = await fetchRacesForEvent(selectedEvent.id);
        setRaces(fetchedRaces);
      } catch (err) {
        console.error('Failed to load races:', err);
        setRaces([]);
      }
    };
    loadRaces();
  }, [selectedEvent]);

  // Load results + live polling
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

        // Race day detection
        const todayStr = new Date().toISOString().split('T')[0];
        const isRaceDay = selectedEvent.date === todayStr;
        setIsLiveRace(isRaceDay);

        // Fetch fresh if cache empty OR race day OR forced
        if (allCached.length === 0 || isRaceDay || forceFresh) {
          console.log('[RaceContext] Fetching fresh from ChronoTrack');
          const fresh = await fetchResultsForEvent(selectedEvent.id);
          console.log(`[ChronoTrack] Fresh results: ${fresh.length}`);

          const freshHash = hashResults(fresh);
          if (freshHash !== currentHash && fresh.length > 0) {
            console.log('[RaceContext] Results changed — updating');
            currentHash = freshHash;

            // Upsert fresh
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

    // Poll on race day
    const todayStr = new Date().toISOString().split('T')[0];
    if (selectedEvent.date === todayStr) {
      interval = setInterval(() => loadResults(true), 120000);
      console.log('[RaceContext] Live polling started');
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