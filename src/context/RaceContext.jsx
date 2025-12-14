// src/context/RaceContext.jsx (FIXED: Proper persistence - only clear on explicit deselection)
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
  const [filterGender, setFilterGender] = useState('');
  const [filterDivision, setFilterDivision] = useState('');
  const [uniqueDivisions, setUniqueDivisions] = useState([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [eventLogos, setEventLogos] = useState(JSON.parse(localStorage.getItem('eventLogos')) || {});
  const [ads, setAds] = useState(JSON.parse(localStorage.getItem('ads')) || {});

  // Load events + restore selected event from storage
  useEffect(() => {
    const loadEvents = async () => {
      console.log('[RaceContext] Starting to fetch events...');
      try {
        setLoading(true);
        setError(null);
        const fetchedEvents = await fetchEvents();
        console.log('[RaceContext] Events fetched successfully:', fetchedEvents);
        setEvents(fetchedEvents);

        // Restore only after events are loaded
        const savedEventId = localStorage.getItem('selectedEventId');
        if (savedEventId && fetchedEvents.length > 0) {
          const restoredEvent = fetchedEvents.find(e => e.id === savedEventId);
          if (restoredEvent) {
            console.log('[RaceContext] Restoring selected event from localStorage:', restoredEvent);
            setSelectedEvent(restoredEvent);
            return; // Success – no need to clear anything
          } else {
            console.log('[RaceContext] Saved event ID not found in current events – clearing stale storage');
            localStorage.removeItem('selectedEventId');
          }
        }
      } catch (err) {
        console.error('[RaceContext] Failed to load events:', err);
        setError(err.message || 'Failed to load events.');
      } finally {
        setLoading(false);
        console.log('[RaceContext] Events loading complete. loading:', false);
      }
    };
    loadEvents();
  }, []);

  // Save to localStorage ONLY when selectedEvent changes to a valid event
  // Do NOT clear on initial null — that's normal on first load
  useEffect(() => {
    if (selectedEvent) {
      localStorage.setItem('selectedEventId', selectedEvent.id);
      console.log('[RaceContext] Saved selectedEventId to localStorage:', selectedEvent.id);
    }
    // Intentionally NO else clause to clear on null
    // We only want to clear when user explicitly goes back to the list (via setSelectedEvent(null))
  }, [selectedEvent]);

  // Optional: Add a way to explicitly clear (e.g., from ResultsPage when showing the list)
  // You can expose a reset function if needed, but for now it's fine

  // Load races when event changes
  useEffect(() => {
    if (!selectedEvent) {
      console.log('[RaceContext] No selected event - clearing races');
      setRaces([]);
      setSelectedRace(null);
      return;
    }
    console.log('[RaceContext] Selected event changed:', selectedEvent);
    const loadRaces = async () => {
      console.log(`[RaceContext] Fetching races for event ID: ${selectedEvent.id}`);
      try {
        const fetchedRaces = await fetchRacesForEvent(selectedEvent.id);
        console.log(`[RaceContext] Races fetched for event ${selectedEvent.id}:`, fetchedRaces);
        setRaces(fetchedRaces);
        if (fetchedRaces.length > 0) {
          console.log('[RaceContext] Auto-selecting first race:', fetchedRaces[0]);
          setSelectedRace(fetchedRaces[0]);
        }
      } catch (err) {
        console.error(`[RaceContext] Failed to load races for event ${selectedEvent.id}:`, err);
        setRaces([]);
      }
    };
    loadRaces();
  }, [selectedEvent]);

  // Load results when event changes (safe pagination - unchanged)
  useEffect(() => {
    if (!selectedEvent) {
      console.log('[RaceContext] No selected event - clearing results');
      setResults([]);
      return;
    }
    console.log(`[RaceContext] Starting to fetch results for event ID: ${selectedEvent.id}`);
    const loadResults = async () => {
      try {
        setLoadingResults(true);
        setError(null);
        console.log(`[RaceContext] Checking Supabase cache for event ${selectedEvent.id}`);
        let allResults = [];

        let allCachedResults = [];
        let page = 0;
        const pageSize = 1000;
        let fetched = [];

        while (true) {
          const from = page * pageSize;
          const to = from + pageSize - 1;

          const { data, error } = await supabase
            .from('chronotrack_results')
            .select('*')
            .eq('event_id', selectedEvent.id.toString())
            .order('place', { ascending: true })
            .range(from, to);

          if (error) {
            console.error('[Supabase] Pagination error on page', page, ':', error);
            allCachedResults = [];
            break;
          }

          fetched = data || [];
          allCachedResults = [...allCachedResults, ...fetched];
          console.log(`[Supabase] Fetched page ${page}: ${fetched.length} rows (total: ${allCachedResults.length})`);

          if (fetched.length < pageSize) {
            break;
          }
          page++;
        }

        if (allCachedResults.length > 0) {
          console.log(`[Supabase] Loaded ${allCachedResults.length} results from cache`);
          allResults = allCachedResults;
        } else {
          console.log('[RaceContext] No cached results – fetching from ChronoTrack API');
          allResults = await fetchResultsForEvent(selectedEvent.id);
          console.log(`[RaceContext] Fresh results fetched. Count: ${allResults.length}`);

          if (allResults.length > 0) {
            console.log('[Supabase] Caching fresh results...');
            const toInsert = allResults.map(r => ({
              event_id: selectedEvent.id.toString(),
              race_id: r.race_id || null,
              bib: r.bib || null,
              first_name: r.first_name || null,
              last_name: r.last_name || null,
              gender: r.gender || null,
              age: r.age ? parseInt(r.age, 10) : null,
              city: r.city || null,
              state: r.state || null,
              chip_time: r.chip_time || null,
              clock_time: r.clock_time || null,
              place: r.place ? parseInt(r.place, 10) : null,
              gender_place: r.gender_place ? parseInt(r.gender_place, 10) : null,
              age_group_name: r.age_group_name || null,
              age_group_place: r.age_group_place ? parseInt(r.age_group_place, 10) : null,
              pace: r.pace || null,
            }));

            const chunkSize = 500;
            for (let i = 0; i < toInsert.length; i += chunkSize) {
              const chunk = toInsert.slice(i, i + chunkSize);
              const { error } = await supabase
                .from('chronotrack_results')
                .upsert(chunk, { ignoreDuplicates: true });
              if (error) console.error('[Supabase] Upsert error:', error);
            }
            console.log(`[Supabase] Cached ${toInsert.length} results`);
          }
        }

        setResults(allResults);
        const divisions = [...new Set(allResults.map(r => r.age_group_name).filter(Boolean))].sort();
        setUniqueDivisions(divisions);
      } catch (err) {
        console.error(`[RaceContext] Failed to load results:`, err);
        setError('Failed to load results.');
        setResults([]);
      } finally {
        setLoadingResults(false);
      }
    };
    loadResults();
  }, [selectedEvent]);

  useEffect(() => {
    console.log('[RaceContext] Results state updated. Length:', results.length);
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
      filterGender,
      setFilterGender,
      filterDivision,
      setFilterDivision,
      uniqueDivisions,
      globalFilter,
      setGlobalFilter,
      eventLogos,
      ads,
    }}>
      {children}
    </RaceContext.Provider>
  );
}