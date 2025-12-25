// src/context/DirectorContext.jsx
import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';

const DirectorContext = createContext();

export function DirectorProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(undefined); // undefined = loading, null = logged out, object = logged in
  const [assignedEvents, setAssignedEvents] = useState([]);   // List of event IDs assigned to this director
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [selectedEventName, setSelectedEventName] = useState('No Event Selected');

  const navigate = useNavigate();

  // Auth setup + session restore
  useEffect(() => {
    console.log('[DirectorContext] Setting up auth system');

    const restoreSession = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        console.error('[DirectorContext] getSession error:', error);
      }
      const user = data.session?.user ?? null;
      setCurrentUser(user);

      if (user) {
        // Load assigned events when user logs in
        loadAssignedEvents(user.id);
      }
    };

    restoreSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[DirectorContext] onAuthStateChange:', event);

      const user = session?.user ?? null;
      setCurrentUser(user);

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (user) loadAssignedEvents(user.id);
      }

      if (event === 'SIGNED_OUT') {
        setAssignedEvents([]);
        setSelectedEventId(null);
        setSelectedEventName('No Event Selected');
        navigate('/director-login', { replace: true });
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [navigate]);

  // Load events assigned to this director
  const loadAssignedEvents = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('director_event_assignments')
        .select('event_id')
        .eq('user_id', userId);

      if (error) throw error;

      const eventIds = data?.map(row => row.event_id) || [];
      setAssignedEvents(eventIds);
    } catch (err) {
      console.error('[DirectorContext] Failed to load assigned events:', err);
      setAssignedEvents([]);
    }
  };

  // Fetch event name whenever selectedEventId changes
  useEffect(() => {
    if (!selectedEventId) {
      setSelectedEventName('No Event Selected');
      return;
    }

    const fetchEventName = async () => {
      try {
        const { data, error } = await supabase
          .from('chronotrack_results')
          .select('event_name')
          .eq('event_id', selectedEventId)
          .limit(1)
          .single();

        if (error || !data) {
          setSelectedEventName(`Event ${selectedEventId}`);
        } else {
          setSelectedEventName(data.event_name || `Event ${selectedEventId}`);
        }
      } catch (err) {
        console.error('[DirectorContext] Failed to fetch event name:', err);
        setSelectedEventName(`Event ${selectedEventId}`);
      }
    };

    fetchEventName();
  }, [selectedEventId]);

  // Helper to select an event (ID + auto-fetch name)
  const setSelectedEvent = (eventId) => {
    setSelectedEventId(eventId);
    // Name will be fetched automatically by the useEffect above
  };

  // Render logging
  console.log('[DirectorContext] Current state:', {
    userStatus: currentUser === undefined ? 'LOADING' : currentUser ? 'LOGGED IN' : 'LOGGED OUT',
    userId: currentUser?.id || null,
    selectedEventId,
    selectedEventName,
    assignedEventsCount: assignedEvents.length,
  });

  return (
    <DirectorContext.Provider
      value={{
        currentUser,
        setCurrentUser,
        assignedEvents,
        setAssignedEvents,
        selectedEventId,
        setSelectedEventId,
        selectedEventName,
        setSelectedEventName,
        setSelectedEvent, // ← convenient helper
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