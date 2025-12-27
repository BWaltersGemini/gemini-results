// src/context/DirectorContext.jsx
// FINAL — Full support for Master Series assignments + all legacy features preserved
import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import { fetchEvents } from '../api/chronotrackapi';

const DirectorContext = createContext();

export function DirectorProvider({ children }) {
  const navigate = useNavigate();

  const [currentUser, setCurrentUser] = useState(undefined); // undefined = loading
  const [assignedEvents, setAssignedEvents] = useState([]); // Direct assignments only
  const [expandedAssignedEvents, setExpandedAssignedEvents] = useState([]); // After master expansion
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [selectedEventName, setSelectedEventName] = useState('No Event Selected');
  const [masterGroups, setMasterGroups] = useState({}); // From app_config
  const [loadingConfig, setLoadingConfig] = useState(true);

  // === SUPERADMIN CONFIG ===
  const SUPERADMIN_EMAIL = 'brandon1@geminitiming.com';
  const isSuperAdmin = currentUser?.email === SUPERADMIN_EMAIL;

  // Load masterGroups from app_config
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const { data } = await supabase
          .from('app_config')
          .select('key, value')
          .eq('key', 'masterGroups');

        if (data && data[0]?.value) {
          setMasterGroups(data[0].value || {});
        }
      } catch (err) {
        console.error('[DirectorContext] Failed to load masterGroups:', err);
        setMasterGroups({});
      } finally {
        setLoadingConfig(false);
      }
    };
    loadConfig();
  }, []);

  // Auth state management
  useEffect(() => {
    console.log('[DirectorContext] Initializing auth listener');

    const restoreSession = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error) console.error('[DirectorContext] getSession error:', error);
      const user = data?.session?.user ?? null;
      setCurrentUser(user);
      if (user) loadEventsForUser(user);
    };

    restoreSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const user = session?.user ?? null;
      setCurrentUser(user);

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (user) loadEventsForUser(user);
      }

      if (event === 'SIGNED_OUT') {
        setCurrentUser(null);
        setAssignedEvents([]);
        setExpandedAssignedEvents([]);
        setSelectedEventId(null);
        setSelectedEventName('No Event Selected');
        setMasterGroups({});
        navigate('/director-login', { replace: true });
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  // Unified event loading (superadmin + individual + master series)
  const loadEventsForUser = async (user) => {
    if (isSuperAdmin) {
      console.log('[DirectorContext] SUPERADMIN MODE — Loading ALL events');
      try {
        const allEvents = await fetchEvents();
        const allIds = allEvents.map(e => String(e.id));
        setAssignedEvents(allIds);
        setExpandedAssignedEvents(allIds);

        // Auto-select most recent if none selected
        if (allIds.length > 0 && !selectedEventId) {
          setSelectedEventId(allIds[0]);
        }
      } catch (err) {
        console.error('[DirectorContext] Superadmin failed to load events:', err);
        setAssignedEvents([]);
        setExpandedAssignedEvents([]);
      }
      return;
    }

    // Regular director
    try {
      // 1. Load direct individual assignments
      const { data: direct } = await supabase
        .from('director_event_assignments')
        .select('event_id')
        .eq('user_id', user.id);

      const directIds = (direct || []).map(a => String(a.event_id));
      setAssignedEvents(directIds);

      // 2. Load master series assignments
      const { data: masterAssigns } = await supabase
        .from('director_master_assignments')
        .select('master_key')
        .eq('director_user_id', user.id);

      const masterKeys = (masterAssigns || []).map(a => a.master_key);

      // 3. Expand masters → event IDs
      const expanded = new Set(directIds);
      masterKeys.forEach(key => {
        const eventIds = masterGroups[key] || [];
        eventIds.forEach(id => expanded.add(String(id)));
      });

      const expandedArray = Array.from(expanded);
      setExpandedAssignedEvents(expandedArray);

      // Auto-select if none selected and events available
      if (expandedArray.length > 0 && !selectedEventId) {
        setSelectedEventId(expandedArray[0]);
      }
    } catch (err) {
      console.error('[DirectorContext] Failed to load assignments:', err);
      setAssignedEvents([]);
      setExpandedAssignedEvents([]);
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

  // Safe setter
  const setSelectedEvent = (eventId) => {
    const idStr = String(eventId);
    if (expandedAssignedEvents.includes(idStr)) {
      setSelectedEventId(idStr);
    } else {
      console.warn('[DirectorContext] Attempted to select unassigned event:', eventId);
    }
  };

  // Debug log
  useEffect(() => {
    console.log('[DirectorContext] Current state:', {
      user: currentUser ? currentUser.email : 'none',
      isSuperAdmin,
      assignedCount: assignedEvents.length,
      expandedCount: expandedAssignedEvents.length,
      selectedEventId,
      selectedEventName,
    });
  }, [currentUser, isSuperAdmin, assignedEvents, expandedAssignedEvents, selectedEventId, selectedEventName]);

  return (
    <DirectorContext.Provider
      value={{
        currentUser,
        assignedEvents,
        expandedAssignedEvents,
        selectedEventId,
        setSelectedEventId,
        selectedEventName,
        setSelectedEvent,
        isSuperAdmin,
        loading: currentUser === undefined || loadingConfig,
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