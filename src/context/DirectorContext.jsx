// src/context/DirectorContext.jsx
import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import { useRace } from './RaceContext';
import { fetchEvents } from '../api/chronotrackapi'; // ← Make sure this is imported

const DirectorContext = createContext();

export function DirectorProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(undefined);
  const [assignedEvents, setAssignedEvents] = useState([]); // Array of event ID strings
  const [expandedAssignedEvents, setExpandedAssignedEvents] = useState([]); // Array of event ID strings
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [selectedEventName, setSelectedEventName] = useState('No Event Selected');

  const { masterGroups = {} } = useRace();
  const navigate = useNavigate();

  // === SUPERADMIN CONFIG ===
  const SUPERADMIN_EMAIL = 'brandon1@geminitiming.com'; // ← Your email
  const isSuperAdmin = currentUser?.email === SUPERADMIN_EMAIL;

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

  // Unified event loading
  const loadEventsForUser = async (user) => {
    if (isSuperAdmin) {
      console.log('[DirectorContext] SUPERADMIN MODE — Loading ALL events');
      try {
        const allEvents = await fetchEvents();
        const allEventIds = allEvents.map(e => e.id.toString());
        setAssignedEvents(allEventIds);
        setExpandedAssignedEvents(allEventIds);
      } catch (err) {
        console.error('[DirectorContext] SuperAdmin failed to load events:', err);
        setAssignedEvents([]);
        setExpandedAssignedEvents([]);
      }
    } else {
      // Regular director
      try {
        const { data, error } = await supabase
          .from('director_event_assignments')
          .select('event_id')
          .eq('user_id', user.id);

        if (error) throw error;

        const directIds = data?.map(row => row.event_id.toString()) || [];
        setAssignedEvents(directIds);

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

  // Fetch selected event name
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

  const setSelectedEvent = (eventId) => {
    setSelectedEventId(eventId);
  };

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
        isSuperAdmin,
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