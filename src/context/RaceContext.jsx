// src/context/RaceContext.jsx (FINAL WORKING VERSION: Upsert + full pagination)

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

  // Load all events on mount
  useEffect(() => {
    const loadEvents = async () => {
      console.log('[RaceContext] Starting to fetch events...');
      try {
        setLoading(true);
        setError(null);
        const fetchedEvents = await fetchEvents();
        console.log('[RaceContext] Events fetched successfully:', fetchedEvents);
        setEvents(fetchedEvents);
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
        } else {
          console.warn(`[RaceContext] No races found for event ${selectedEvent.id}`);
        }
      } catch (err) {
        console.error(`[RaceContext] Failed to load races for event ${selectedEvent.id}:`, err);
        setRaces([]);
      }
    };
    loadRaces();
  }, [selectedEvent]);

  // Load results when event changes + STORE IN SUPABASE USING UPSERT
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
        console.log(`[RaceContext] Calling fetchResultsForEvent(${selectedEvent.id})`);

        const allResults = await fetchResultsForEvent(selectedEvent.id);
        console.log(`[RaceContext] Results fetched successfully for event ${selectedEvent.id}. Count: ${allResults.length}`);
        console.log('[RaceContext] Sample result:', allResults[0] || 'No results');

        // ──────────────────────── SUPABASE STORAGE (UPSERT) ────────────────────────
        if (allResults.length > 0) {
          const { data: existing, error: checkError } = await supabase
            .from('chronotrack_results')
            .select('id')
            .eq('event_id', selectedEvent.id.toString())
            .limit(1);

          if (checkError) {
            console.error('[Supabase] Check error:', checkError);
          } else if (existing.length === 0) {
            console.log('[Supabase] No existing data – upserting all results');

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

              if (error) {
                console.error('[Supabase] Upsert chunk error:', error);
              } else {
                console.log(`[Supabase] Upserted chunk ${Math.floor(i / chunkSize) + 1} (${chunk.length} rows)`);
              }
            }
            console.log(`[Supabase] Finished upserting ${toInsert.length} results`);
          } else {
            console.log('[Supabase] Results already exist – skipping insert');
          }
        }
        // ───────────────────────────────────────────────────────────────────────────

        setResults(allResults);
        const divisions = [...new Set(allResults.map(r => r.age_group_name).filter(Boolean))].sort();
        console.log('[RaceContext] Unique divisions:', divisions);
        setUniqueDivisions(divisions);
      } catch (err) {
        console.error(`[RaceContext] Failed to load results for event ${selectedEvent.id}:`, err);
        setError(err.message || 'Failed to load results.');
        setResults([]);
      } finally {
        setLoadingResults(false);
        console.log('[RaceContext] Results loading complete. loadingResults:', false);
      }
    };

    loadResults();
  }, [selectedEvent]);

  // Debug: Log when results change
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