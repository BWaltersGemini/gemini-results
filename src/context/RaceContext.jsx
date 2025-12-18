// src/context/RaceContext.jsx (FINAL — Race day optimized + upsert on entry_id + deduplication)
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

  // Load events from ChronoTrack (once)
  useEffect(() => {
    const loadEvents = async () => {
      try {
        setLoading(true);
        setError(null);
        const fetched = await fetchEvents();
        setEvents(fetched);
      } catch (err) {
        console.error('[RaceContext] Failed to load events:', err);
        setError('Failed to load events');
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
        console.error('[RaceContext] Failed to load races:', err);
        setRaces([]);
      }
    };
    loadRaces();
  }, [selectedEvent]);

  // Results loader — Supabase cache first, background ChronoTrack sync
  useEffect(() => {
    if (!selectedEvent) {
      setResults([]);
      setUniqueDivisions([]);
      setIsLiveRace(false);
      return;
    }

    let aborted = false;
    let pollInterval = null;

    const loadResults = async (forceFresh = false) => {
      if (aborted) return;

      try {
        setLoadingResults(true);
        setError(null);
        let allResults = [];

        // 1. Load from Supabase cache first (instant)
        const { data: cached, error: cacheError } = await supabase
          .from('chronotrack_results')
          .select('*')
          .eq('event_id', selectedEvent.id)
          .order('place', { ascending: true });

        if (!aborted && cached && cached.length > 0) {
          allResults = cached;
          const divisions = [...new Set(cached.map(r => r.age_group_name).filter(Boolean))].sort();
          setUniqueDivisions(divisions);
          console.log(`[Results] Loaded ${cached.length} results from Supabase cache`);
        }

        // 2. Check if we need fresh data
        const todayStr = new Date().toISOString().split('T')[0];
        const isRaceDay = selectedEvent.date === todayStr;
        if (!aborted) setIsLiveRace(isRaceDay);

        const shouldFetchFresh = forceFresh || isRaceDay || cached?.length === 0;

        if (shouldFetchFresh) {
          console.log('[Results] Fetching fresh results from ChronoTrack...');
          const fresh = await fetchResultsForEvent(selectedEvent.id);

          if (!aborted && fresh.length > 0) {
            // Deduplicate by entry_id (preferred) or bib + race_id
            const seen = new Map();
            fresh.forEach(r => {
              const key = r.entry_id || `${r.bib || ''}-${r.race_id || ''}`;
              if (!seen.has(key)) {
                seen.set(key, r);
              }
            });
            const deduped = Array.from(seen.values());
            console.log(`[Results] Deduplicated: ${fresh.length} → ${deduped.length}`);

            // Prepare for upsert
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

            // UPSERT — updates existing rows (by entry_id or bib+race_id), inserts new
            const { error } = await supabase
              .from('chronotrack_results')
              .upsert(toUpsert, { onConflict: 'event_id,entry_id' });

            if (error) {
              console.error('[Supabase] Upsert error:', error);
            } else {
              console.log('[Results] Successfully upserted fresh results to Supabase');
              if (!aborted) {
                allResults = deduped;
                const divisions = [...new Set(deduped.map(r => r.age_group_name).filter(Boolean))].sort();
                setUniqueDivisions(divisions);
              }
            }
          }
        }

        if (!aborted) {
          setResults(allResults);
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

    loadResults(); // Initial load

    // Live polling on race day
    if (selectedEvent.date === new Date().toISOString().split('T')[0]) {
      pollInterval = setInterval(() => loadResults(true), 120000); // Every 2 minutes
      console.log('[Results] Live polling started (every 2 minutes)');
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