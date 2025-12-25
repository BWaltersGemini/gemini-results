// src/pages/director/DirectorLayout.jsx
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useDirector } from '../../context/DirectorContext';
import { supabase } from '../../supabaseClient';

export default function DirectorLayout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser, selectedEventId, allEvents = [] } = useDirector(); // Assume allEvents passed or fetched if needed

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Find current event name for display
  const currentEvent = allEvents.find(e => e.id === selectedEventId);
  const eventDisplay = currentEvent ? `${currentEvent.name} (${new Date(currentEvent.start_time * 1000).getFullYear()})` : 'No Event Selected';

  const navItems = [
    { path: '/race-directors-hub', label: 'Dashboard', icon: '🏠' },
    { 
      path: selectedEventId ? `/director-live-tracking/${selectedEventId}` : '#', 
      label: 'Live Tracking', 
      icon: '📊',
      disabled: !selectedEventId 
    },
    { path: '/director-awards', label: 'Awards', icon: '🏆' },
    { path: '/director-analytics', label: 'Analytics', icon: '📈', disabled: true },
  ];

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/director-login');
  };

  const isActive = (path) => {
    if (path.includes('/director-live-tracking/')) {
      return location.pathname.startsWith('/director-live-tracking/');
    }
    if (path === '/director-awards') {
      return location.pathname === '/director-awards';
    }
    return location.pathname === path;
  };

  return (
    <div className="min-h-screen bg-bg-light flex">
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex flex-col w-72 bg-text-dark text-text-light shadow-2xl">
        <div className="p-8 border-b border-white/10">
          <h1 className="text-3xl font-bold">Director Hub</h1>
          <p className="mt-2 text-gray-300">
            {currentUser?.profile?.full_name || 'Director'}
          </p>
          <div className="mt-6 bg-primary/20 px-4 py-3 rounded-xl">
            <p className="text-sm opacity-80">Current Event</p>
            <p className="text-lg font-semibold truncate">{eventDisplay}</p>
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
                    {item.disabled && !item.path.includes('live') && <span className="ml-auto text-xs bg-gray-600 px-2 py-1 rounded">Soon</span>}
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

      {/* Mobile Header & Menu */}
      <div className="flex-1 flex flex-col">
        <header className="md:hidden bg-text-dark text-text-light p-4 flex justify-between items-center shadow-lg">
          <div>
            <h2 className="text-2xl font-bold">Director Hub</h2>
            <p className="text-sm opacity-80 truncate max-w-xs">{eventDisplay}</p>
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
            <aside className="fixed left-0 top-0 h-full w-72 bg-text-dark text-text-light z-50 shadow-2xl flex flex-col">
              <div className="p-8 border-b border-white/10 flex justify-between items-center">
                <div>
                  <h1 className="text-3xl font-bold">Director Hub</h1>
                  <p className="mt-2 text-gray-300 text-sm">
                    {currentUser?.profile?.full_name}
                  </p>
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-3xl"
                >
                  ✕
                </button>
              </div>

              <nav className="flex-1 p-6">
                <ul className="space-y-3">
                  {navItems.map((item) => (
                    <li key={item.path}>
                      {item.disabled ? (
                        <span className="flex items-center gap-4 px-6 py-4 rounded-xl text-gray-500 opacity-60">
                          <span className="text-2xl">{item.icon}</span>
                          <span className="text-lg">{item.label}</span>
                          {item.disabled && !item.path.includes('live') && <span className="ml-auto text-xs bg-gray-600 px-2 py-1 rounded">Soon</span>}
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

        {/* Main Content Area */}
        <main className="flex-1 p-6 md:p-12 overflow-y-auto bg-bg-light">
          {children}
        </main>
      </div>
    </div>
  );
}