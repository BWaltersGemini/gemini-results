// src/context/DirectorContext.jsx
import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';

const DirectorContext = createContext();

export function DirectorProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [assignedEvents, setAssignedEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState(null);

  const navigate = useNavigate();

  useEffect(() => {
    console.log('[DirectorContext] Initializing auth listener...');

    // 1. Get current session on mount (including after refresh)
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('[DirectorContext] Initial getSession result:', session ? 'Session found' : 'No session');
      if (session) {
        console.log('[DirectorContext] Setting currentUser from initial session:', session.user.id);
        setCurrentUser(session.user);
      } else {
        console.log('[DirectorContext] No initial session → redirecting to login');
        navigate('/director-login', { replace: true });
      }
    });

    // 2. Listen for ALL auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[DirectorContext] Auth event:', event);
      console.log('[DirectorContext] Session user:', session?.user?.id || 'null');

      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (session?.user) {
          console.log('[DirectorContext] User signed in / session restored:', session.user.id);
          setCurrentUser(session.user);
        } else {
          console.log('[DirectorContext] Event triggered but no user in session');
          setCurrentUser(null);
        }
      } else if (event === 'SIGNED_OUT') {
        console.log('[DirectorContext] User signed out');
        setCurrentUser(null);
        setAssignedEvents([]);
        setSelectedEventId(null);
        navigate('/director-login', { replace: true });
      }
    });

    console.log('[DirectorContext] Auth listener subscribed');

    // Cleanup
    return () => {
      console.log('[DirectorContext] Unsubscribing auth listener');
      subscription.unsubscribe();
    };
  }, [navigate]);

  const value = {
    currentUser,
    setCurrentUser,
    assignedEvents,
    setAssignedEvents,
    selectedEventId,
    setSelectedEventId,
  };

  return <DirectorContext.Provider value={value}>{children}</DirectorContext.Provider>;
}

export const useDirector = () => {
  const context = useContext(DirectorContext);
  if (!context) {
    throw new Error('useDirector must be used within a DirectorProvider');
  }
  return context;
};