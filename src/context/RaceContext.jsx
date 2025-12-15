// src/context/RaceContext.jsx (FINAL — Calculates gender_place client-side)
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

        const savedEventId = localStorage.getItem('selectedEventId');
        if (savedEventId) {
          const restored = fetchedEvents.find(e => e.id === savedEventId);
          if (restored) {
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

  useEffect(() => {
    if (selectedEvent) {
      localStorage.setItem('selectedEventId', selectedEvent.id);
    } else {
      localStorage.removeItem('selectedEventId');
    }
  }, [selectedEvent]);

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

  // Load results + calculate gender_place
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

        // Cache first
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

          if (error) break;
          if (!data || data.length === 0) break;
          allCached = [...allCached, ...data];
          if (data.length < pageSize) break;
          page++;
        }

        if (allCached.length > 0) {
          allResults = allCached;
          console.log(`[Supabase] Loaded ${allCached.length} results from cache`);
        }

        const todayStr = new Date().toISOString().split('T')[0];
        const isRaceDay = selectedEvent.date === todayStr;
        setIsLiveRace(isRaceDay);

        if (allCached.length === 0 || isRaceDay || forceFresh) {
          console.log('[RaceContext] Fetching fresh from ChronoTrack');
          const fresh = await fetchResultsForEvent(selectedEvent.id);
          console.log(`[ChronoTrack] Fresh results: ${fresh.length}`);

          if (fresh.length > 0) {
            // Upsert fresh
            const toUpsert = fresh.map(r => ({
              event_id: selectedEvent.id.toString(),
              // ... all fields ...
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

        // Calculate gender_place client-side
        const resultsWithGenderPlace = allResults.map(r => {
          const sameGender = allResults.filter(other => other.gender === r.gender);
          const fasterSameGender = sameGender.filter(other => 
            other.chip_time < r.chip_time || 
            (other.chip_time === r.chip_time && (other.place || Infinity) < (r.place || Infinity))
          ).length;

          return {
            ...r,
            gender_place: fasterSameGender + 1,
          };
        });

        setResults(resultsWithGenderPlace);

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

    if (selectedEvent.date === new Date().toISOString().split('T')[0]) {
      interval = setInterval(() => loadResults(true), 120000);
    }

    return () => clearInterval(interval);
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
      isLiveRace,
    }}>
      {children}
    </RaceContext.Provider>
  );
}