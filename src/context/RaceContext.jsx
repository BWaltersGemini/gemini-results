// src/context/RaceContext.jsx (FINAL — Fully fixed: uses start_time, no more .date crashes, optimized caching + live polling)
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

  // Persist selected event in localStorage
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

  // Load events from ChronoTrack (once on mount)
  useEffect(() => {
    const loadEvents = async () => {
      try {
        setLoading(true);
        setError(null);
        const fetched = await fetchEvents();
        setEvents(fetched);
        console.log('[RaceContext] Events loaded:', fetched.length);
      } catch (err) {
        console.error('[RaceContext] Failed to load events:', err);
        setError('Failed to load events');
      } finally {
        setLoading(false);
      }
    };
    loadEvents();
  }, []);

  // Load races when an event is selected
  useEffect(() => {
    if (!selectedEvent) {
      setRaces([]);
      return;
    }

    const loadRaces = async () => {
      try {
        const fetched = await fetchRacesForEvent(selectedEvent.id);
        setRaces(fetched);
        console.log('[RaceContext] Races loaded for event', selectedEvent.id, ':', fetched.length);
      } catch (err) {
        console.error('[RaceContext] Failed to load races:', err);
        setRaces([]);
      }
    };

    loadRaces();
  }, [selectedEvent]);

  // Load results — cache first, fresh on race day or force
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

        // 1. Load from Supabase cache (fast)
        const { data: cached, error: cacheError } = await supabase
          .from('chronotrack_results')
          .select('*')
          .eq('event_id', selectedEvent.id)
          .order('place', { ascending: true });

        if (cacheError) {
          console.error('[RaceContext] Cache load error:', cacheError);
        } else if (cached && cached.length > 0) {
          allResults = cached;
          const divisions = [...new Set(cached.map(r => r.age_group_name).filter(Boolean))].sort();
          setUniqueDivisions(divisions);
          console.log(`[RaceContext] Loaded ${cached.length} results from cache`);
        }

        // 2. Determine if this is race day using start_time
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];

        const eventDateStr = selectedEvent.start_time
          ? new Date(selectedEvent.start_time * 1000).toISOString().split('T')[0]
          : null;

        const isRaceDay = eventDateStr === todayStr;

        if (!aborted) setIsLiveRace(isRaceDay);

        // 3. Fetch fresh if race day, forced, or no cache
        const shouldFetchFresh = forceFresh || isRaceDay || !cached || cached.length === 0;

        if (shouldFetchFresh) {
          console.log('[RaceContext] Fetching fresh results from ChronoTrack...');
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
            console.log(`[RaceContext] Deduplicated: ${fresh.length} → ${deduped.length}`);

            // Prepare upsert data
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

            // Upsert to Supabase (conflict on event_id + entry_id)
            const { error: upsertError } = await supabase
              .from('chronotrack_results')
              .upsert(toUpsert, { onConflict: 'event_id,entry_id' });

            if (upsertError) {
              console.error('[RaceContext] Upsert error:', upsertError);
            } else {
              console.log('[RaceContext] Fresh results upserted to Supabase');
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
          console.error('[RaceContext] Results load error:', err);
          setError('Failed to load results');
        }
      } finally {
        if (!aborted) setLoadingResults(false);
      }
    };

    loadResults(); // Initial load

    // Live polling only on race day
    if (selectedEvent.start_time) {
      const eventDateStr = new Date(selectedEvent.start_time * 1000).toISOString().split('T')[0];
      const todayStr = new Date().toISOString().split('T')[0];

      if (eventDateStr === todayStr) {
        pollInterval = setInterval(() => loadResults(true), 120000); // Every 2 minutes
        console.log('[RaceContext] Live polling started (every 2 minutes)');
      }
    }

    return () => {
      aborted = true;
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [selectedEvent]);

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
      }}
    >
      {children}
    </RaceContext.Provider>
  );
}