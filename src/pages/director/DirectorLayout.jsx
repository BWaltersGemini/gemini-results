// src/pages/director/DirectorLayout.jsx
// FINAL — Fixed stuck "Authenticating..." + all features preserved
import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useDirector } from '../../context/DirectorContext';
import { supabase } from '../../supabaseClient';

export default function DirectorLayout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    currentUser,
    selectedEventId,
    assignedEvents,
    setSelectedEvent,
    selectedEventName = 'No Event Selected',
    loading: directorLoading = false,
  } = useDirector();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [eventOptions, setEventOptions] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [currentEventDisplay, setCurrentEventDisplay] = useState('No Event Selected');

  // === CRITICAL AUTH FIX ===
  // currentUser: undefined = loading, null = logged out, object = logged in
  if (currentUser === undefined || directorLoading) {
    return (
      <div className="min-h-screen bg-bg-light flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-t-4 border-primary mb-8"></div>
          <p className="text-2xl text-brand-dark">Authenticating...</p>
        </div>
      </div>
    );
  }

  if (currentUser === null) {
    navigate('/director-login', { replace: true });
    return null;
  }

  // === Fetch event options for dropdown ===
  useEffect(() => {
    if (assignedEvents.length === 0) {
      setEventOptions([]);
      setLoadingEvents(false);
      return;
    }

    const fetchEventNames = async () => {
      setLoadingEvents(true);
      try {
        const { data, error } = await supabase
          .from('chronotrack_events')
          .select('id, name')
          .in('id', assignedEvents);

        if (error) throw error;

        const options = (data || [])
          .map(row => ({
            id: String(row.id),
            name: row.name?.trim() || `Event ${row.id}`,
          }))
          .sort((a, b) => a.name.localeCompare(b.name));

        // Fallback for any missing events
        const fetchedIds = options.map(o => o.id);
        const missing = assignedEvents.filter(id => !fetchedIds.includes(String(id)));
        missing.forEach(id => options.push({ id: String(id), name: `Event ${id}` }));

        setEventOptions(options);
      } catch (err) {
        console.error('Failed to fetch event options:', err);
        setEventOptions(assignedEvents.map(id => ({ id: String(id), name: `Event ${id}` })));
      } finally {
        setLoadingEvents(false);
      }
    };

    fetchEventNames();
  }, [assignedEvents]);

  // Update current display name
  useEffect(() => {
    setCurrentEventDisplay(selectedEventName);
  }, [selectedEventName]);

  // Navigation items with relative paths
  const navItems = [
    { path: '.', label: 'Dashboard', icon: '🏠' },
    {
      path: 'live-tracking',
      label: 'Live Tracking',
      icon: '📊',
      disabled: !selectedEventId,
    },
    { path: 'awards', label: 'Awards', icon: '🏆' },
    { path: 'analytics', label: 'Analytics', icon: '📈' },
  ];

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/director-login');
  };

  const isActive = (path) => {
    if (path === '.') {
      return location.pathname.endsWith('/race-directors-hub') || location.pathname === '/race-directors-hub';
    }
    return location.pathname.includes(path);
  };

  return (
    <div className="min-h-screen bg-bg-light flex">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-72 bg-text-dark text-text-light shadow-2xl">
        <div className="p-8 border-b border-white/10">
          <h1 className="text-3xl font-bold">Director Hub</h1>
          <p className="mt-2 text-gray-300">
            {currentUser?.user_metadata?.full_name || currentUser?.email || 'Director'}
          </p>
          <div className="mt-6 bg-primary/20 px-4 py-3 rounded-xl">
            <p className="text-sm opacity-80">Current Event</p>
            <p className="text-lg font-semibold truncate">{currentEventDisplay}</p>
          </div>

          {/* Event Selector - Desktop */}
          <div className="mt-6">
            <label className="text-sm opacity-80 block mb-2">Switch Event</label>
            {loadingEvents ? (
              <p className="text-sm text-gray-400">Loading events...</p>
            ) : (
              <select
                value={selectedEventId || ''}
                onChange={(e) => setSelectedEvent(e.target.value || null)}
                className="w-full px-4 py-3 bg-text-dark/50 text-text-light rounded-xl border border-white/20 focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="">
                  {eventOptions.length === 0 ? 'No events assigned' : 'Select an event...'}
                </option>
                {eventOptions.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.name}
                  </option>
                ))}
              </select>
            )}
            {eventOptions.length === 0 && !loadingEvents && (
              <p className="text-xs text-gray-400 mt-2">Contact admin to assign events</p>
            )}
          </div>
        </div>

        <nav className="flex-1 p-6">
          <ul className="space-y-3">
            {navItems.map((item) => (
              <li key={item.path}>
                {item.disabled ? (
                  <span className="flex items-center gap-4 px-6 py-4 rounded-xl text-gray-500 cursor-not-allowed opacity-60">
                    <span className="text-2xl">{item.icon}</span>
                    <span className="text-lg">{item.label}</span>
                  </span>
                ) : (
                  <Link
                    to={item.path}
                    className={`flex items-center gap-4 px-6 py-4 rounded-xl transition ${
                      isActive(item.path)
                        ? 'bg-primary text-text-light shadow-lg'
                        : 'hover:bg-white/10'
                    }`}
                  >
                    <span className="text-2xl">{item.icon}</span>
                    <span className="text-lg font-medium">{item.label}</span>
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </nav>

        <div className="p-6 border-t border-white/10">
          <button
            onClick={handleSignOut}
            className="w-full bg-primary text-text-light px-6 py-3 rounded-full font-bold hover:bg-primary/90 transition"
          >
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile Layout */}
      <div className="flex-1 flex flex-col">
        <header className="md:hidden bg-text-dark text-text-light p-4 flex justify-between items-center shadow-lg">
          <div>
            <h2 className="text-2xl font-bold">Director Hub</h2>
            <p className="text-sm opacity-80 truncate max-w-xs">{currentEventDisplay}</p>
          </div>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="text-3xl"
          >
            ☰
          </button>
        </header>

        {mobileMenuOpen && (
          <>
            <div
              className="fixed inset-0 bg-black/50 z-40 md:hidden"
              onClick={() => setMobileMenuOpen(false)}
            />
            <aside className="fixed left-0 top-0 h-full w-72 bg-text-dark text-text-light z-50 shadow-2xl flex flex-col overflow-y-auto">
              <div className="p-8 border-b border-white/10 flex justify-between items-center">
                <div>
                  <h1 className="text-3xl font-bold">Director Hub</h1>
                  <p className="mt-2 text-gray-300 text-sm">
                    {currentUser?.user_metadata?.full_name || currentUser?.email}
                  </p>
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-3xl"
                >
                  ✕
                </button>
              </div>

              <div className="p-6">
                <div className="bg-primary/20 px-4 py-3 rounded-xl mb-6">
                  <p className="text-sm opacity-80">Current Event</p>
                  <p className="text-lg font-semibold truncate">{currentEventDisplay}</p>
                </div>

                {/* Mobile Event Selector */}
                <div className="mb-6">
                  <label className="text-sm opacity-80 block mb-2">Switch Event</label>
                  {loadingEvents ? (
                    <p className="text-sm text-gray-400">Loading events...</p>
                  ) : (
                    <select
                      value={selectedEventId || ''}
                      onChange={(e) => {
                        setSelectedEvent(e.target.value || null);
                        setMobileMenuOpen(false);
                      }}
                      className="w-full px-4 py-3 bg-text-dark/50 text-text-light rounded-xl border border-white/20 focus:outline-none focus:ring-2 focus:ring-accent"
                    >
                      <option value="">
                        {eventOptions.length === 0 ? 'No events assigned' : 'Select an event...'}
                      </option>
                      {eventOptions.map((event) => (
                        <option key={event.id} value={event.id}>
                          {event.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              <nav className="flex-1 px-6">
                <ul className="space-y-3">
                  {navItems.map((item) => (
                    <li key={item.path}>
                      {item.disabled ? (
                        <span className="flex items-center gap-4 px-6 py-4 rounded-xl text-gray-500 opacity-60">
                          <span className="text-2xl">{item.icon}</span>
                          <span className="text-lg">{item.label}</span>
                        </span>
                      ) : (
                        <Link
                          to={item.path}
                          onClick={() => setMobileMenuOpen(false)}
                          className={`flex items-center gap-4 px-6 py-4 rounded-xl transition ${
                            isActive(item.path)
                              ? 'bg-primary text-text-light shadow-lg'
                              : 'hover:bg-white/10'
                          }`}
                        >
                          <span className="text-2xl">{item.icon}</span>
                          <span className="text-lg font-medium">{item.label}</span>
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </nav>

              <div className="p-6 border-t border-white/10">
                <button
                  onClick={handleSignOut}
                  className="w-full bg-primary text-text-light px-6 py-3 rounded-full font-bold hover:bg-primary/90 transition"
                >
                  Sign Out
                </button>
              </div>
            </aside>
          </>
        )}

        <main className="flex-1 p-6 md:p-12 overflow-y-auto bg-bg-light">
          {children}
        </main>
      </div>
    </div>
  );
}