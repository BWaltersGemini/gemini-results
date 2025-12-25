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

  // Critical: Listen to Supabase auth state changes
  useEffect(() => {
    // Get the current session on mount (including after refresh)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setCurrentUser(session?.user ?? null);
    });

    // Listen for all auth events (login, logout, token refresh, page load)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUser(session?.user ?? null);

      // If signed out, redirect to login
      if (!session) {
        setAssignedEvents([]);
        setSelectedEventId(null);
        navigate('/director-login', { replace: true });
      }
    });

    // Cleanup subscription on unmount
    return () => {
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