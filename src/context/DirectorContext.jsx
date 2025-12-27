// src/context/DirectorContext.jsx
// FINAL — Full master series support + superadmin + fixed auth loading
import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import { fetchEvents } from '../api/chronotrackapi';

const DirectorContext = createContext();

export function DirectorProvider({ children }) {
  const navigate = useNavigate();

  const [currentUser, setCurrentUser] = useState(undefined); // undefined = loading
  const [assignedEvents, setAssignedEvents] = useState([]);
  const [expandedAssignedEvents, setExpandedAssignedEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [selectedEventName, setSelectedEventName] = useState('No Event Selected');
  const [masterGroups, setMasterGroups] = useState({});
  const [loadingConfig, setLoadingConfig] = useState(true);

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

  // Auth listener
  useEffect(() => {
    const restoreSession = async () => {
      const { data } = await supabase.auth.getSession();
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

  const loadEventsForUser = async (user) => {
    if (isSuperAdmin) {
      try {
        const allEvents = await fetchEvents();
        const allIds = allEvents.map(e => String(e.id));
        setAssignedEvents(allIds);
        setExpandedAssignedEvents(allIds);
        if (allIds.length > 0 && !selectedEventId) {
          setSelectedEventId(allIds[0]);
        }
      } catch (err) {
        console.error('[DirectorContext] Superadmin load failed:', err);
        setAssignedEvents([]);
        setExpandedAssignedEvents([]);
      }
      return;
    }

    try {
      const { data: direct } = await supabase
        .from('director_event_assignments')
        .select('event_id')
        .eq('user_id', user.id);

      const directIds = (direct || []).map(a => String(a.event_id));
      setAssignedEvents(directIds);

      const { data: masterAssigns } = await supabase
        .from('director_master_assignments')
        .select('master_key')
        .eq('director_user_id', user.id);

      const masterKeys = (masterAssigns || []).map(a => a.master_key);

      const expanded = new Set(directIds);
      masterKeys.forEach(key => {
        const eventIds = masterGroups[key] || [];
        eventIds.forEach(id => expanded.add(String(id)));
      });

      const expandedArray = Array.from(expanded);
      setExpandedAssignedEvents(expandedArray);

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
        const { data } = await supabase
          .from('chronotrack_events')
          .select('name')
          .eq('id', selectedEventId)
          .single();

        setSelectedEventName(data?.name?.trim() || `Event ${selectedEventId}`);
      } catch (err) {
        setSelectedEventName(`Event ${selectedEventId}`);
      }
    };

    fetchName();
  }, [selectedEventId]);

  const setSelectedEvent = (eventId) => {
    const idStr = String(eventId);
    if (expandedAssignedEvents.includes(idStr)) {
      setSelectedEventId(idStr);
    }
  };

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
  if (!context) throw new Error('useDirector must be used within DirectorProvider');
  return context;
};