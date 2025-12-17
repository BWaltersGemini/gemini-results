// src/context/RaceContext.jsx (FINAL — Fixed results loading + better logging + debug helper)
import { createContext, useState, useEffect } from 'react';
import { fetchEvents, fetchRacesForEvent, fetchResultsForEvent } from '../api/chronotrackapi.cjs';
import { supabase } from '../supabaseClient.js';

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

  // Global stats — updated reliably
  const [totalAthletesTimed, setTotalAthletesTimed] = useState(0);
  const [totalRacesTimed, setTotalRacesTimed] = useState(0);

  // Helper: Update total athletes count from Supabase
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

  // Debug helper — easy console search
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

  // Load events
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

        // Update races timed (completed events)
        const completedEvents = fetchedEvents.filter(e => new Date(e.date) <= new Date());
        setTotalRacesTimed(completedEvents.length);

        // Update athletes timed
        await updateAthleteCount();

        const savedEventId = localStorage.getItem('selectedEventId');
        if (savedEventId) {
          const restored = fetchedEvents.find(e => e.id === savedEventId);
          if (restored) {
            console.log('[RaceContext] Restoring selected event:', restored.name, restored.date);
            setSelectedEvent(restored);
          } else {
            console.warn('[RaceContext] Saved event ID not found in fetched events');
            localStorage.removeItem('selectedEventId');
          }
        }
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

  // Load results — fixed + improved logging
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

        // Load from Supabase cache
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
            const freshWithGenderPlace = fresh.map(r => {
              const sameGender = fresh.filter(other => other.gender === r.gender);
              const fasterSameGender = sameGender.filter(other =>
                other.chip_time < r.chip_time ||
                (other.chip_time === r.chip_time && (other.place || Infinity) < (r.place || Infinity))
              ).length;
              return {
                ...r,
                gender_place: fasterSameGender + 1,
              };
            });

            const toUpsert = freshWithGenderPlace.map(r => ({
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

            allResults = freshWithGenderPlace;
            await updateAthleteCount();
            console.log('[Results] Fresh results saved to Supabase and athlete count updated');
          } else {
            console.log('[Results] ChronoTrack returned no results');
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

    loadResults(); // Always run on mount/change

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
      isLiveRace,
      totalAthletesTimed,
      totalRacesTimed,
      debug: { findEvents },
    }}>
      {children}
    </RaceContext.Provider>
  );
}