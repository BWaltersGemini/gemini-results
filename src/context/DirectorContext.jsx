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

  // Global auth listener — restores session on refresh + handles sign out/in
  useEffect(() => {
    // Initial session check
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setCurrentUser(session.user);
      }
    });

    // Listen for all auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        setCurrentUser(session?.user ?? null);
      } else if (event === 'SIGNED_OUT') {
        setCurrentUser(null);
        setAssignedEvents([]);
        setSelectedEventId(null);
        navigate('/director-login');
      }
    });

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
    throw new Error('useDirector must be used within DirectorProvider');
  }
  return context;
};