// src/context/DirectorContext.jsx
import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import { useRace } from './RaceContext'; // ← Import RaceContext to get masterGroups

const DirectorContext = createContext();

export function DirectorProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(undefined); // undefined = loading, null = logged out, object = logged in
  const [assignedEvents, setAssignedEvents] = useState([]); // Directly assigned event IDs
  const [expandedAssignedEvents, setExpandedAssignedEvents] = useState([]); // All accessible (via master groups)
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [selectedEventName, setSelectedEventName] = useState('No Event Selected');

  const { masterGroups = {} } = useRace(); // Get masterGroups from global RaceContext
  const navigate = useNavigate();

  // Auth setup
  useEffect(() => {
    console.log('[DirectorContext] Setting up auth system');

    const restoreSession = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error) console.error('[DirectorContext] getSession error:', error);

      const user = data.session?.user ?? null;
      setCurrentUser(user);

      if (user) {
        loadAssignedEvents(user.id);
      }
    };

    restoreSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const user = session?.user ?? null;
      setCurrentUser(user);

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (user) loadAssignedEvents(user.id);
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

  // Load directly assigned events
  const loadAssignedEvents = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('director_event_assignments')
        .select('event_id')
        .eq('user_id', userId);

      if (error) throw error;

      const eventIds = data?.map(row => row.event_id.toString()) || [];
      setAssignedEvents(eventIds);
    } catch (err) {
      console.error('[DirectorContext] Failed to load assigned events:', err);
      setAssignedEvents([]);
    }
  };

  // Expand access using masterGroups
  useEffect(() => {
    if (assignedEvents.length === 0 || Object.keys(masterGroups).length === 0) {
      setExpandedAssignedEvents(assignedEvents);
      return;
    }

    const expanded = new Set(assignedEvents);

    Object.values(masterGroups).forEach((eventIdList) => {
      const stringList = eventIdList.map(String);
      const hasAccessToOne = assignedEvents.some(id => stringList.includes(id));
      if (hasAccessToOne) {
        stringList.forEach(id => expanded.add(id));
      }
    });

    setExpandedAssignedEvents(Array.from(expanded));
  }, [assignedEvents, masterGroups]);

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
        expandedAssignedEvents, // ← Use this in dropdowns/analytics
        selectedEventId,
        setSelectedEventId,
        selectedEventName,
        setSelectedEvent,
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