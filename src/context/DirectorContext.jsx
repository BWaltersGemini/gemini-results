// src/context/DirectorContext.jsx
import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';

const DirectorContext = createContext();

export function DirectorProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(undefined); // undefined = loading, null = logged out, object = logged in
  const [assignedEvents, setAssignedEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState(null);

  const navigate = useNavigate();

  useEffect(() => {
    console.log('[DirectorContext] Effect started - setting up auth system');

    const restoreSession = async () => {
      console.log('[DirectorContext] Attempting to restore session with supabase.auth.getSession()');
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        console.error('[DirectorContext] getSession error:', error);
      } else {
        console.log('[DirectorContext] getSession result:', data.session ? `Found session for user ${data.session.user.id}` : 'No session found');
      }
      setCurrentUser(data.session?.user ?? null);
    };

    restoreSession();

    console.log('[DirectorContext] Subscribing to onAuthStateChange listener');
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[DirectorContext] onAuthStateChange triggered');
      console.log('  Event:', event);
      console.log('  Session user ID:', session?.user?.id || 'none');
      console.log('  Session expires_at:', session?.expires_at ? new Date(session.expires_at * 1000).toISOString() : 'none');
      console.log('  Full session object keys:', session ? Object.keys(session) : 'none');

      setCurrentUser(session?.user ?? null);

      if (event === 'SIGNED_OUT') {
        console.log('[DirectorContext] SIGNED_OUT detected - clearing state and redirecting');
        setAssignedEvents([]);
        setSelectedEventId(null);
        navigate('/director-login', { replace: true });
      }
    });

    console.log('[DirectorContext] Auth listener successfully subscribed');

    return () => {
      console.log('[DirectorContext] Component unmounting - unsubscribing listener');
      subscription.unsubscribe();
    };
  }, [navigate]);

  // Render logging
  console.log('[DirectorContext] Render - currentUser state:', 
    currentUser === undefined ? 'LOADING (undefined)' :
    currentUser === null ? 'LOGGED OUT (null)' :
    `LOGGED IN (user ID: ${currentUser.id})`
  );

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