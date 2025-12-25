// src/context/DirectorContext.jsx
import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import { useRace } from './RaceContext'; // ← Get masterGroups
import { fetchEvents } from '../api/chronotrackapi'; // ← Import to fetch all events for SuperAdmin

const DirectorContext = createContext();

export function DirectorProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(undefined); // undefined = loading, null = logged out, object = logged in
  const [assignedEvents, setAssignedEvents] = useState([]); // Directly assigned event IDs
  const [expandedAssignedEvents, setExpandedAssignedEvents] = useState([]); // All accessible (via master groups or superadmin)
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [selectedEventName, setSelectedEventName] = useState('No Event Selected');

  const { masterGroups = {} } = useRace(); // Get masterGroups from global RaceContext
  const navigate = useNavigate();

  // === SUPERADMIN CONFIGURATION ===
  // Replace with your actual email (or add your UUID for extra safety)
  const SUPERADMIN_EMAIL = 'brandon1@geminitiming.com'; // ← Change if different
  // Optional: const SUPERADMIN_UUID = 'a047c35a-355b-4971-8695-7303c7f3cf1c';

  const isSuperAdmin = currentUser?.email === SUPERADMIN_EMAIL;
  // || currentUser?.id === SUPERADMIN_UUID;

  // Auth setup
  useEffect(() => {
    console.log('[DirectorContext] Setting up auth system');

    const restoreSession = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error) console.error('[DirectorContext] getSession error:', error);

      const user = data.session?.user ?? null;
      setCurrentUser(user);

      if (user) {
        loadEventsForUser(user);
      }
    };

    restoreSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const user = session?.user ?? null;
      setCurrentUser(user);

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (user) loadEventsForUser(user);
      }

      if (event === 'SIGNED_OUT') {
        setAssignedEvents([]);
        setExpandedAssignedEvents([]);
        setSelectedEventId(null);
        setSelectedEventName('No Event Selected');
        navigate('/director-login', { replace: true });
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  // Unified event loading: SuperAdmin vs Regular Director
  const loadEventsForUser = async (user) => {
    if (isSuperAdmin) {
      console.log('[DirectorContext] SUPERADMIN MODE ACTIVATED — Loading ALL events');
      try {
        const allEvents = await fetchEvents(); // Direct from ChronoTrack
        const allEventIds = allEvents.map(e => e.id.toString());
        setAssignedEvents(allEventIds); // Treat as "assigned"
        setExpandedAssignedEvents(allEventIds);
      } catch (err) {
        console.error('[DirectorContext] SuperAdmin failed to load all events:', err);
        setAssignedEvents([]);
        setExpandedAssignedEvents([]);
      }
    } else {
      // Regular director logic
      try {
        const { data, error } = await supabase
          .from('director_event_assignments')
          .select('event_id')
          .eq('user_id', user.id);

        if (error) throw error;

        const directIds = data?.map(row => row.event_id.toString()) || [];
        setAssignedEvents(directIds);

        // Expand via masterGroups
        const expanded = new Set(directIds);
        Object.values(masterGroups).forEach((eventIdList) => {
          const stringList = eventIdList.map(String);
          const hasAccessToOne = directIds.some(id => stringList.includes(id));
          if (hasAccessToOne) {
            stringList.forEach(id => expanded.add(id));
          }
        });

        setExpandedAssignedEvents(Array.from(expanded));
      } catch (err) {
        console.error('[DirectorContext] Failed to load assigned events:', err);
        setAssignedEvents([]);
        setExpandedAssignedEvents([]);
      }
    }
  };

  // Fetch selected event name from chronotrack_events
  useEffect(() => {
    if (!selectedEventId) {
      setSelectedEventName('No Event Selected');
      return;
    }

    const fetchName = async () => {
      try {
        const { data, error } = await supabase
          .from('chronotrack_events')
          .select('name')
          .eq('id', selectedEventId)
          .single();

        if (error || !data) {
          setSelectedEventName(`Event ${selectedEventId}`);
        } else {
          setSelectedEventName(data.name.trim() || `Event ${selectedEventId}`);
        }
      } catch (err) {
        console.error('[DirectorContext] Failed to fetch event name:', err);
        setSelectedEventName(`Event ${selectedEventId}`);
      }
    };

    fetchName();
  }, [selectedEventId]);

  // Helper: Select event by ID
  const setSelectedEvent = (eventId) => {
    setSelectedEventId(eventId);
  };

  // Logging
  console.log('[DirectorContext] State:', {
    mode: isSuperAdmin ? 'SUPERADMIN' : 'DIRECTOR',
    user: currentUser ? 'LOGGED IN' : currentUser === null ? 'LOGGED OUT' : 'LOADING',
    assignedCount: assignedEvents.length,
    expandedCount: expandedAssignedEvents.length,
    selectedEventId,
    selectedEventName,
  });

  return (
    <DirectorContext.Provider
      value={{
        currentUser,
        setCurrentUser,
        assignedEvents,
        expandedAssignedEvents,
        selectedEventId,
        setSelectedEventId,
        selectedEventName,
        setSelectedEvent,
        isSuperAdmin, // ← Optional: expose if you want UI indicators
      }}
    >
      {children}
    </DirectorContext.Provider>
  );
}

export const useDirector = () => {
  const context = useContext(DirectorContext);
  if (!context) {
    throw new Error('useDirector must be used within a DirectorProvider');
  }
  return context;
};