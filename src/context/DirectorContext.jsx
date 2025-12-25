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
    console.log('[DirectorContext] Starting auth setup...');

    // Force get current session first
    const restoreSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      console.log('[DirectorContext] Restored session:', session ? `User ${session.user.id}` : 'No session');
      if (session) {
        setCurrentUser(session.user);
      }
    };

    restoreSession();

    // Then listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[DirectorContext] Auth event:', event, 'User:', session?.user?.id || 'none');
      setCurrentUser(session?.user ?? null);

      if (event === 'SIGNED_OUT') {
        setAssignedEvents([]);
        setSelectedEventId(null);
        navigate('/director-login', { replace: true });
      }
    });

    return () => {
      console.log('[DirectorContext] Cleaning up');
      subscription.unsubscribe();
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