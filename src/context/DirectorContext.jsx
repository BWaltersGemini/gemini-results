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
    console.log('[DirectorContext] Effect running - setting up auth');

    const getInitialSession = async () => {
      console.log('[DirectorContext] Calling supabase.auth.getSession()...');
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        console.error('[DirectorContext] getSession error:', error);
      }
      console.log('[DirectorContext] getSession result:', data.session ? `Session found for user ${data.session.user.id}` : 'No session');
      setCurrentUser(data.session?.user ?? null);
    };

    getInitialSession();

    console.log('[DirectorContext] Setting up onAuthStateChange listener...');
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[DirectorContext] onAuthStateChange fired');
      console.log('  Event:', event);
      console.log('  Session user ID:', session?.user?.id || 'none');
      console.log('  Session expires_at:', session?.expires_at ? new Date(session.expires_at * 1000) : 'none');

      setCurrentUser(session?.user ?? null);

      if (event === 'SIGNED_OUT') {
        console.log('[DirectorContext] Detected SIGNED_OUT - clearing state and redirecting');
        setAssignedEvents([]);
        setSelectedEventId(null);
        navigate('/director-login', { replace: true });
      } else if (event === 'TOKEN_REFRESHED') {
        console.log('[DirectorContext] Token refreshed - session restored');
      } else if (event === 'INITIAL_SESSION') {
        console.log('[DirectorContext] INITIAL_SESSION event - this is page load');
      }
    });

    console.log('[DirectorContext] Listener subscribed successfully');

    return () => {
      console.log('[DirectorContext] Cleaning up - unsubscribing listener');
      listener.subscription.unsubscribe();
    };
  }, [navigate]);

  console.log('[DirectorContext] Render - currentUser state:', 
    currentUser === undefined ? 'LOADING (undefined)' :
    currentUser === null ? 'LOGGED OUT (null)' :
    `LOGGED IN (${currentUser.id})`
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