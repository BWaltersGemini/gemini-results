// src/context/RaceContext.jsx (FINAL — Race day optimized: Supabase first, background ChronoTrack sync)
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
  const [isLiveRace, setIsLiveRace] = useState(false);

  // Load events (from ChronoTrack once, then cache in memory)
  useEffect(() => {
    const loadEvents = async () => {
      try {
        setLoading(true);
        const fetched = await fetchEvents();
        setEvents(fetched);
      } catch (err) {
        setError('Failed to load events');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadEvents();
  }, []);

  // Load races when event selected
  useEffect(() => {
    if (!selectedEvent) {
      setRaces([]);
      return;
    }
    const loadRaces = async () => {
      try {
        const fetched = await fetchRacesForEvent(selectedEvent.id);
        setRaces(fetched);
      } catch (err) {
        console.error('Failed to load races', err);
        setRaces([]);
      }
    };
    loadRaces();
  }, [selectedEvent]);

  // Main results loader — Supabase first, background ChronoTrack sync
  useEffect(() => {
    if (!selectedEvent) {
      setResults([]);
      setUniqueDivisions([]);
      setIsLiveRace(false);
      return;
    }

    let pollInterval = null;
    let aborted = false;

    const loadResults = async (forceChrono = false) => {
      if (aborted) return;

      try {
        setLoadingResults(true);

        // 1. Always try Supabase cache first (instant)
        const { data: cached, error: cacheError } = await supabase
          .from('chronotrack_results')
          .select('*')
          .eq('event_id', selectedEvent.id)
          .order('place', { ascending: true });

        if (!aborted && cached && cached.length > 0) {
          setResults(cached);
          const divisions = [...new Set(cached.map(r => r.age_group_name).filter(Boolean))].sort();
          setUniqueDivisions(divisions);
          console.log(`[Results] Loaded ${cached.length} from Supabase cache`);
        }

        // 2. Determine if we should fetch fresh from ChronoTrack
        const todayStr = new Date().toISOString().split('T')[0];
        const isRaceDay = selectedEvent.date === todayStr;
        setIsLiveRace(isRaceDay);

        const shouldFetchFresh = forceChrono || isRaceDay || !cached || cached.length === 0;

        if (shouldFetchFresh) {
          console.log('[Results] Fetching fresh from ChronoTrack...');
          const fresh = await fetchResultsForEvent(selectedEvent.id);

          if (!aborted && fresh.length > 0) {
            // Deduplicate by bib + race_id
            const seen = new Map();
            fresh.forEach(r => {
              const key = `${r.bib || ''}-${r.race_id || ''}`;
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

            // Replace all for this event
            await supabase
              .from('chronotrack_results')
              .delete()
              .eq('event_id', selectedEvent.id);

            const chunkSize = 500;
            for (let i = 0; i < toUpsert.length; i += chunkSize) {
              const chunk = toUpsert.slice(i, i + chunkSize);
              const { error } = await supabase.from('chronotrack_results').insert(chunk);
              if (error) console.error('[Supabase] Insert error:', error);
            }

            if (!aborted) {
              setResults(deduped);
              const divisions = [...new Set(deduped.map(r => r.age_group_name).filter(Boolean))].sort();
              setUniqueDivisions(divisions);
              console.log('[Results] Updated from ChronoTrack and saved to Supabase');
            }
          }
        }
      } catch (err) {
        if (!aborted) {
          console.error('[Results] Error:', err);
          setError('Failed to load results');
        }
      } finally {
        if (!aborted) setLoadingResults(false);
      }
    };

    loadResults(); // Initial load

    // Background polling on race day
    if (selectedEvent.date === new Date().toISOString().split('T')[0]) {
      pollInterval = setInterval(() => loadResults(true), 120000); // Every 2 minutes
      console.log('[Results] Live race day polling started');
    }

    return () => {
      aborted = true;
      if (pollInterval) clearInterval(pollInterval);
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
      isLiveRace,
    }}>
      {children}
    </RaceContext.Provider>
  );
}