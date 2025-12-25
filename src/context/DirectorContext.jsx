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
    console.log('[DirectorContext] Setting up auth listener...');

    // Do NOT call getSession() and redirect here
    // Trust the onAuthStateChange to restore session

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[DirectorContext] Auth event:', event, 'User:', session?.user?.id || 'none');

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
        setCurrentUser(session?.user ?? null);
      } else if (event === 'SIGNED_OUT') {
        console.log('[DirectorContext] Explicit sign out detected');
        setCurrentUser(null);
        setAssignedEvents([]);
        setSelectedEventId(null);
        navigate('/director-login', { replace: true });
      }
    });

    return () => {
      console.log('[DirectorContext] Cleaning up auth listener');
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