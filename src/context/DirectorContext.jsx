// src/context/DirectorContext.jsx
import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';

const DirectorContext = createContext();

export function DirectorProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(undefined); // undefined = loading, null = logged out
  const [assignedEvents, setAssignedEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState(null);

  const navigate = useNavigate();

  useEffect(() => {
    // Force session restore
    const getInitialSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setCurrentUser(session?.user ?? null);
    };

    getInitialSession();

    // Listen for auth changes
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      setCurrentUser(session?.user ?? null);

      if (event === 'SIGNED_OUT') {
        setAssignedEvents([]);
        setSelectedEventId(null);
        navigate('/director-login', { replace: true });
      }
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, [navigate]);

  return (
    <DirectorContext.Provider
      value={{
        currentUser,
        setCurrentUser,
        assignedEvents,
        setAssignedEvents,
        selectedEventId,
        setSelectedEventId,
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