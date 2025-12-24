// src/pages/director/DirectorLayout.jsx
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useDirector } from '../../context/DirectorContext';
import { supabase } from '../../supabaseClient';

export default function DirectorLayout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser, selectedEventId } = useDirector();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { path: '/race-directors-hub', label: 'Dashboard', icon: '🏠' },
    { path: `/director-live-tracking/${selectedEventId || ''}`, label: 'Live Tracking', icon: '📊', disabled: !selectedEventId },
    { path: '/director-awards', label: 'Awards', icon: '🏆', disabled: true },
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
    return location.pathname === path;
  };

  return (
    <div className="min-h-screen bg-gemini-light-gray flex">
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex flex-col w-72 bg-gemini-dark-gray text-white shadow-2xl">
        <div className="p-8 border-b border-white/10">
          <h1 className="text-3xl font-bold">Director Hub</h1>
          <p className="mt-2 text-gray-300">
            {currentUser?.profile?.full_name || 'Director'}
          </p>
          {selectedEventId && (
            <p className="mt-4 text-sm bg-gemini-blue/20 px-4 py-2 rounded-lg">
              Active Event: {selectedEventId}
            </p>
          )}
        </div>

        <nav className="flex-1 p-6">
          <ul className="space-y-3">
            {navItems.map((item) => (
              <li key={item.path}>
                {item.disabled ? (
                  <span className="flex items-center gap-4 px-6 py-4 rounded-xl text-gray-500 cursor-not-allowed opacity-60">
                    <span className="text-2xl">{item.icon}</span>
                    <span className="text-lg">{item.label}</span>
                    <span className="ml-auto text-xs bg-gray-600 px-2 py-1 rounded">Soon</span>
                  </span>
                ) : (
                  <Link
                    to={item.path}
                    className={`flex items-center gap-4 px-6 py-4 rounded-xl transition ${
                      isActive(item.path)
                        ? 'bg-gemini-blue text-white shadow-lg'
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
            className="w-full bg-white text-gemini-dark-gray px-6 py-3 rounded-full font-bold hover:bg-gray-100 transition"
          >
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="flex-1 flex flex-col">
        <header className="md:hidden bg-gemini-dark-gray text-white p-4 flex justify-between items-center shadow-lg">
          <h2 className="text-2xl font-bold">Director Hub</h2>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="text-3xl"
          >
            ☰
          </button>
        </header>

        {/* Mobile Menu Overlay */}
        {mobileMenuOpen && (
          <>
            <div
              className="fixed inset-0 bg-black/50 z-40 md:hidden"
              onClick={() => setMobileMenuOpen(false)}
            />
            <aside className="fixed left-0 top-0 h-full w-72 bg-gemini-dark-gray text-white z-50 shadow-2xl flex flex-col">
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
                          <span className="ml-auto text-xs bg-gray-600 px-2 py-1 rounded">Soon</span>
                        </span>
                      ) : (
                        <Link
                          to={item.path}
                          onClick={() => setMobileMenuOpen(false)}
                          className={`flex items-center gap-4 px-6 py-4 rounded-xl transition ${
                            isActive(item.path)
                              ? 'bg-gemini-blue text-white shadow-lg'
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
                  className="w-full bg-white text-gemini-dark-gray px-6 py-3 rounded-full font-bold hover:bg-gray-100 transition"
                >
                  Sign Out
                </button>
              </div>
            </aside>
          </>
        )}

        {/* Main Content */}
        <main className="flex-1 p-6 md:p-12 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}