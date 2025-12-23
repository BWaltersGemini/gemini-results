// src/pages/admin/AdminDashboard.jsx (FINAL — New Red/Turquoise Brand Palette)
import { useState, useEffect, lazy, Suspense } from 'react';
import { loadAppConfig } from '../../utils/appConfig';
import { createAdminSupabaseClient } from '../../supabaseClient';

// Lazy-load tabs for performance
const EventsAdmin = lazy(() => import('./EventsAdmin'));
const MastersAdmin = lazy(() => import('./MastersAdmin'));
const PerformanceAdmin = lazy(() => import('./PerformanceAdmin'));
const EmailCampaignsAdmin = lazy(() => import('./EmailCampaignsAdmin'));

export default function AdminDashboard() {
  // Login state
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);

  // Shared global config
  const [masterGroups, setMasterGroups] = useState({});
  const [editedEvents, setEditedEvents] = useState({});
  const [hiddenRaces, setHiddenRaces] = useState({});
  const [showAdsPerMaster, setShowAdsPerMaster] = useState({});
  const [eventLogos, setEventLogos] = useState({});
  const [ads, setAds] = useState([]);
  const [liveAutoFetchPerEvent, setLiveAutoFetchPerEvent] = useState({});

  // UI state
  const [activeTab, setActiveTab] = useState('events');
  const [saveStatus, setSaveStatus] = useState('');

  const adminSupabase = createAdminSupabaseClient();

  // Load config from Supabase
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

  // Auto-save individual keys
  const autoSaveConfig = async (key, value) => {
    try {
      const { error } = await adminSupabase
        .from('app_config')
        .upsert({ key, value }, { onConflict: 'key' });
      if (error) throw error;
      setSaveStatus(`${key.replace(/([A-Z])/g, ' $1').trim()} saved`);
      setTimeout(() => setSaveStatus(''), 4000);
    } catch (err) {
      console.error(`Auto-save failed for ${key}:`, err);
      setSaveStatus('Auto-save failed');
      setTimeout(() => setSaveStatus(''), 6000);
    }
  };

  // Bulk save all
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
      setSaveStatus('All changes saved to Supabase!');
      setTimeout(() => setSaveStatus(''), 5000);
    } catch {
      setSaveStatus('Bulk save failed');
    }
  };

  // Check login on mount
  useEffect(() => {
    const loggedIn = localStorage.getItem('adminLoggedIn') === 'true';
    setIsLoggedIn(loggedIn);
    if (loggedIn) loadGlobalConfig();
  }, []);

  // Login Screen
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-brand-light flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-12 border-2 border-primary/20">
          <h1 className="text-5xl font-black text-center text-brand-dark mb-12">Admin Login</h1>
          {error && <p className="text-primary font-bold text-center mb-8 text-2xl">{error}</p>}
          <div className="space-y-8">
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-8 py-6 text-2xl border-4 border-gray-300 rounded-2xl focus:outline-none focus:border-primary focus:ring-8 focus:ring-primary/20"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-8 py-6 text-2xl border-4 border-gray-300 rounded-2xl focus:outline-none focus:border-primary focus:ring-8 focus:ring-primary/20"
            />
            <button
              onClick={() => {
                if (username === 'admin' && password === 'gemini2025') {
                  localStorage.setItem('adminLoggedIn', 'true');
                  setIsLoggedIn(true);
                  setError(null);
                } else {
                  setError('Invalid credentials');
                }
              }}
              className="w-full bg-primary text-white py-6 text-3xl font-black rounded-2xl hover:bg-primary/90 transition shadow-2xl transform hover:scale-105"
            >
              Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Logged-in Dashboard
  return (
    <div className="min-h-screen bg-brand-light py-12 px-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-8 mb-12">
          <h1 className="text-5xl font-black text-brand-dark">Admin Dashboard</h1>
          <button
            onClick={() => {
              localStorage.removeItem('adminLoggedIn');
              setIsLoggedIn(false);
            }}
            className="px-10 py-5 bg-red-600 text-white text-xl font-bold rounded-2xl hover:bg-red-700 transition shadow-xl"
          >
            Logout
          </button>
        </div>

        {/* Save Status Toast */}
        {saveStatus && (
          <div className="fixed top-24 right-8 z-50 bg-primary text-white px-10 py-6 rounded-3xl shadow-2xl animate-pulse text-2xl font-black">
            {saveStatus}
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex flex-wrap gap-4 mb-12 bg-white p-4 rounded-3xl shadow-2xl border border-primary/20">
          <button
            onClick={() => setActiveTab('events')}
            className={`px-10 py-5 text-xl font-bold rounded-2xl transition shadow-md ${
              activeTab === 'events'
                ? 'bg-primary text-white'
                : 'bg-brand-light text-brand-dark hover:bg-primary/10'
            }`}
          >
            Events
          </button>
          <button
            onClick={() => setActiveTab('masters')}
            className={`px-10 py-5 text-xl font-bold rounded-2xl transition shadow-md ${
              activeTab === 'masters'
                ? 'bg-primary text-white'
                : 'bg-brand-light text-brand-dark hover:bg-primary/10'
            }`}
          >
            Masters
          </button>
          <button
            onClick={() => setActiveTab('performance')}
            className={`px-10 py-5 text-xl font-bold rounded-2xl transition shadow-md ${
              activeTab === 'performance'
                ? 'bg-primary text-white'
                : 'bg-brand-light text-brand-dark hover:bg-primary/10'
            }`}
          >
            Performance
          </button>
          <button
            onClick={() => setActiveTab('website')}
            className={`px-10 py-5 text-xl font-bold rounded-2xl transition shadow-md ${
              activeTab === 'website'
                ? 'bg-primary text-white'
                : 'bg-brand-light text-brand-dark hover:bg-primary/10'
            }`}
          >
            Website
          </button>
          <button
            onClick={() => setActiveTab('email')}
            className={`px-10 py-5 text-xl font-bold rounded-2xl transition shadow-md ${
              activeTab === 'email'
                ? 'bg-primary text-white'
                : 'bg-brand-light text-brand-dark hover:bg-primary/10'
            }`}
          >
            Email Campaigns
          </button>
        </div>

        {/* Tab Content */}
        <Suspense fallback={<div className="text-center py-32 text-3xl text-brand-dark">Loading tab...</div>}>
          {activeTab === 'events' && (
            <EventsAdmin
              masterGroups={masterGroups}
              editedEvents={editedEvents}
              hiddenRaces={hiddenRaces}
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
          {activeTab === 'performance' && <PerformanceAdmin masterGroups={masterGroups} />}
          {activeTab === 'website' && (
            <section className="space-y-12">
              <h2 className="text-4xl font-black text-brand-dark mb-12">Website Management</h2>
              <div className="bg-white rounded-3xl shadow-2xl p-12 border border-primary/20">
                <h3 className="text-3xl font-black text-brand-dark mb-8">Advertisements</h3>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={(e) => {
                    console.log('Ad upload:', e.target.files);
                  }}
                  className="block w-full text-lg text-gray-700 file:mr-8 file:py-5 file:px-10 file:rounded-full file:border-0 file:text-lg file:font-bold file:bg-primary file:text-white hover:file:bg-primary/90 transition mb-10"
                />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                  {ads.map((ad, i) => (
                    <div key={i} className="bg-brand-light rounded-3xl shadow-xl overflow-hidden border-2 border-primary/20 hover:shadow-2xl hover:border-primary/40 transition">
                      <img src={ad} alt={`Ad ${i + 1}`} className="w-full h-auto" />
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}
          {activeTab === 'email' && <EmailCampaignsAdmin eventLogos={eventLogos} />}
        </Suspense>

        {/* Global Save Button */}
        <div className="text-center mt-20">
          <button
            onClick={saveAllChanges}
            className="px-24 py-8 bg-primary text-white text-4xl font-black rounded-full hover:bg-primary/90 shadow-2xl transition transform hover:scale-105"
          >
            Save All Changes to Supabase
          </button>
        </div>
      </div>
    </div>
  );
}