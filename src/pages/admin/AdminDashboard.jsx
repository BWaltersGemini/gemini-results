// src/pages/admin/AdminDashboard.jsx
import { useState, useEffect, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadAppConfig } from '../../utils/appConfig';
import { createAdminSupabaseClient } from '../../supabaseClient';

// Lazy load heavy tabs
const EventsAdmin = lazy(() => import('./EventsAdmin'));
const MastersAdmin = lazy(() => import('./MastersAdmin'));
const PerformanceAdmin = lazy(() => import('./PerformanceAdmin'));

export default function AdminDashboard() {
  const navigate = useNavigate();

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('events');
  const [saveStatus, setSaveStatus] = useState('');

  // Shared global state
  const [masterGroups, setMasterGroups] = useState({});
  const [editedEvents, setEditedEvents] = useState({});
  const [hiddenRaces, setHiddenRaces] = useState({});
  const [showAdsPerMaster, setShowAdsPerMaster] = useState({});
  const [eventLogos, setEventLogos] = useState({});
  const [ads, setAds] = useState([]);
  const [liveAutoFetchPerEvent, setLiveAutoFetchPerEvent] = useState({});

  const adminSupabase = createAdminSupabaseClient();

  const loadGlobalConfig = async () => {
    const config = await loadAppConfig();
    setMasterGroups(config.masterGroups || {});
    setEditedEvents(config.editedEvents || {});
    setEventLogos(config.eventLogos || {});
    setShowAdsPerMaster(config.showAdsPerMaster || {});
    setAds(config.ads || []);
    setHiddenRaces(config.hiddenRaces || {});
    setLiveAutoFetchPerEvent(config.liveAutoFetchPerEvent || {});
  };

  const autoSaveConfig = async (key, value) => {
    try {
      const { error } = await adminSupabase
        .from('app_config')
        .upsert({ key, value }, { onConflict: 'key' });
      if (error) throw error;
      setSaveStatus(`${key.replace(/([A-Z])/g, ' $1').trim()} saved`);
      setTimeout(() => setSaveStatus(''), 4000);
    } catch (err) {
      setSaveStatus('Auto-save failed');
      setTimeout(() => setSaveStatus(''), 6000);
    }
  };

  const saveAllChanges = async () => {
    try {
      await Promise.all([
        autoSaveConfig('masterGroups', masterGroups),
        autoSaveConfig('editedEvents', editedEvents),
        autoSaveConfig('eventLogos', eventLogos),
        autoSaveConfig('showAdsPerMaster', showAdsPerMaster),
        autoSaveConfig('ads', ads),
        autoSaveConfig('hiddenRaces', hiddenRaces),
        autoSaveConfig('liveAutoFetchPerEvent', liveAutoFetchPerEvent),
      ]);
      setSaveStatus('All changes saved!');
      setTimeout(() => setSaveStatus(''), 5000);
    } catch {
      setSaveStatus('Bulk save failed');
    }
  };

  useEffect(() => {
    const loggedIn = localStorage.getItem('adminLoggedIn') === 'true';
    setIsLoggedIn(loggedIn);
    if (loggedIn) loadGlobalConfig();
  }, []);

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
          <h1 className="text-3xl font-bold text-center text-gemini-dark-gray mb-8">Admin Login</h1>
          {error && <p className="text-red-600 text-center mb-4">{error}</p>}
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full p-4 border border-gray-300 rounded-xl mb-4"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-4 border border-gray-300 rounded-xl mb-6"
          />
          <button
            onClick={() => {
              if (username === 'admin' && password === 'gemini2025') {
                localStorage.setItem('adminLoggedIn', 'true');
                setIsLoggedIn(true);
              } else {
                setError('Invalid credentials');
              }
            }}
            className="w-full bg-gemini-blue text-white py-4 rounded-xl font-bold hover:bg-gemini-blue/90 transition"
          >
            Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-12">
          <h1 className="text-4xl font-bold text-gemini-dark-gray">Admin Dashboard</h1>
          <button
            onClick={() => {
              localStorage.removeItem('adminLoggedIn');
              setIsLoggedIn(false);
            }}
            className="px-6 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition"
          >
            Logout
          </button>
        </div>

        {saveStatus && (
          <div className="fixed top-24 right-8 z-50 bg-gemini-blue text-white px-8 py-4 rounded-2xl shadow-2xl animate-pulse text-lg font-semibold">
            {saveStatus}
          </div>
        )}

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-10 bg-gray-100 p-2 rounded-xl w-fit">
          <button onClick={() => setActiveTab('events')} className={`px-8 py-3 rounded-lg font-semibold transition ${activeTab === 'events' ? 'bg-gemini-blue text-white' : 'text-gray-600 hover:bg-gray-200'}`}>
            Events
          </button>
          <button onClick={() => setActiveTab('masters')} className={`px-8 py-3 rounded-lg font-semibold transition ${activeTab === 'masters' ? 'bg-gemini-blue text-white' : 'text-gray-600 hover:bg-gray-200'}`}>
            Masters
          </button>
          <button onClick={() => setActiveTab('performance')} className={`px-8 py-3 rounded-lg font-semibold transition ${activeTab === 'performance' ? 'bg-gemini-blue text-white' : 'text-gray-600 hover:bg-gray-200'}`}>
            Performance
          </button>
          <button onClick={() => setActiveTab('website')} className={`px-8 py-3 rounded-lg font-semibold transition ${activeTab === 'website' ? 'bg-gemini-blue text-white' : 'text-gray-600 hover:bg-gray-200'}`}>
            Website
          </button>
        </div>

        {/* Lazy-loaded tabs */}
        <Suspense fallback={<div className="text-center py-20 text-xl text-gray-600">Loading...</div>}>
          {activeTab === 'events' && (
            <EventsAdmin
              masterGroups={masterGroups}
              editedEvents={editedEvents}
              hiddenRaces={hiddenRaces}
              eventLogos={eventLogos}
              liveAutoFetchPerEvent={liveAutoFetchPerEvent}
              setMasterGroups={setMasterGroups}
              setEditedEvents={setEditedEvents}
              setHiddenRaces={setHiddenRaces}
              setLiveAutoFetchPerEvent={setLiveAutoFetchPerEvent}
              autoSaveConfig={autoSaveConfig}
            />
          )}
          {activeTab === 'masters' && (
            <MastersAdmin
              masterGroups={masterGroups}
              eventLogos={eventLogos}
              showAdsPerMaster={showAdsPerMaster}
              setMasterGroups={setMasterGroups}
              setEventLogos={setEventLogos}
              setShowAdsPerMaster={setShowAdsPerMaster}
              autoSaveConfig={autoSaveConfig}
            />
          )}
          {activeTab === 'performance' && <PerformanceAdmin />}
          {activeTab === 'website' && (
            <div className="space-y-12">
              <h2 className="text-3xl font-bold text-gemini-dark-gray mb-8">Website Management</h2>
              <div className="bg-white rounded-2xl shadow-lg p-8">
                <h3 className="text-2xl font-bold mb-6">Advertisements</h3>
                <input type="file" multiple accept="image/*" className="mb-6" />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  {ads.map((ad, i) => (
                    <div key={i} className="rounded-xl overflow-hidden shadow-md">
                      <img src={ad} alt={`Ad ${i + 1}`} className="w-full h-48 object-cover" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </Suspense>

        {/* Save All Button */}
        <div className="text-center mt-20">
          <button
            onClick={saveAllChanges}
            className="px-20 py-6 bg-gemini-blue text-white text-2xl font-bold rounded-full hover:bg-gemini-blue/90 shadow-2xl transition transform hover:scale-105"
          >
            Save All Changes to Supabase
          </button>
        </div>
      </div>
    </div>
  );
}