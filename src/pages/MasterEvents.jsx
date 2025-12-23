// src/pages/MasterEvents.jsx (FINAL — New Red/Turquoise Brand Palette)
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchEvents as fetchChronoEvents } from '../api/chronotrackapi.js';
import { createAdminSupabaseClient } from '../supabaseClient';
import { loadAppConfig } from '../utils/appConfig';

export default function MasterEvents() {
  const navigate = useNavigate();

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);

  const [masterGroups, setMasterGroups] = useState({});
  const [editedEvents, setEditedEvents] = useState({});
  const [hiddenMasters, setHiddenMasters] = useState([]);
  const [showAdsPerMaster, setShowAdsPerMaster] = useState({});
  const [eventLogos, setEventLogos] = useState({});
  const [chronoEvents, setChronoEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  const adminSupabase = createAdminSupabaseClient();

  const loadGlobalConfig = async () => {
    const config = await loadAppConfig();
    setMasterGroups(config.masterGroups || {});
    setEditedEvents(config.editedEvents || {});
    setEventLogos(config.eventLogos || {});
    setHiddenMasters(config.hiddenMasters || []);
    setShowAdsPerMaster(config.showAdsPerMaster || {});
  };

  const saveConfig = async (key, value) => {
    try {
      const { error } = await adminSupabase
        .from('app_config')
        .upsert({ key, value }, { onConflict: 'key' });
      if (error) throw error;
      console.log(`[MasterEvents] Saved ${key} to Supabase`);
    } catch (err) {
      console.error(`[MasterEvents] Failed to save ${key}:`, err);
      alert(`Failed to save ${key}. Check console for details.`);
    }
  };

  useEffect(() => {
    const loggedIn = typeof window !== 'undefined' && localStorage.getItem('adminLoggedIn') === 'true';
    setIsLoggedIn(loggedIn);
    if (loggedIn) {
      loadGlobalConfig();
    }
  }, []);

  // Safe date formatting from epoch (seconds)
  const formatDate = (epoch) => {
    if (!epoch || isNaN(epoch)) return 'Date TBD';
    const date = new Date(epoch * 1000);
    if (isNaN(date.getTime())) return 'Invalid Date';
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  const parseDate = (epoch) => {
    if (!epoch || isNaN(epoch)) return new Date(NaN);
    return new Date(epoch * 1000);
  };

  useEffect(() => {
    if (isLoggedIn) {
      const fetchData = async () => {
        try {
          setLoading(true);
          const events = await fetchChronoEvents();
          const sortedEvents = events.sort((a, b) => {
            const dateA = parseDate(a.start_time);
            const dateB = parseDate(b.start_time);
            if (isNaN(dateA.getTime()) && isNaN(dateB.getTime())) return 0;
            if (isNaN(dateA.getTime())) return 1;
            if (isNaN(dateB.getTime())) return -1;
            return dateB - dateA;
          });
          setChronoEvents(sortedEvents);
        } catch (err) {
          console.error('Failed to fetch ChronoEvents:', err);
        } finally {
          setLoading(false);
        }
      };
      fetchData();
    }
  }, [isLoggedIn]);

  const handleLogin = (e) => {
    e.preventDefault();
    if (username === 'G3M1N1_1912' && password === 'Br@nd0n81') {
      localStorage.setItem('adminLoggedIn', 'true');
      setIsLoggedIn(true);
      setError(null);
      loadGlobalConfig();
    } else {
      setError('Invalid credentials');
    }
  };

  const getLinkedEvents = (masterKey) => {
    const ids = masterGroups[masterKey] || [];
    return chronoEvents
      .filter(event => ids.includes(event.id))
      .sort((a, b) => parseDate(b.start_time) - parseDate(a.start_time));
  };

  const handleEditName = (id, value) => {
    setEditedEvents(prev => ({
      ...prev,
      [id]: { ...prev[id], name: value }
    }));
  };

  const toggleMasterVisibility = async (masterKey) => {
    const newHidden = hiddenMasters.includes(masterKey)
      ? hiddenMasters.filter(k => k !== masterKey)
      : [...hiddenMasters, masterKey];
    setHiddenMasters(newHidden);
    await saveConfig('hiddenMasters', newHidden);
  };

  const toggleShowAds = async (masterKey) => {
    const newShow = { ...showAdsPerMaster, [masterKey]: !showAdsPerMaster[masterKey] };
    setShowAdsPerMaster(newShow);
    await saveConfig('showAdsPerMaster', newShow);
  };

  const handleFileUpload = async (e, masterKey) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = async () => {
      const newLogos = { ...eventLogos, [masterKey]: reader.result };
      setEventLogos(newLogos);
      await saveConfig('eventLogos', newLogos);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveChanges = async () => {
    await Promise.all([
      saveConfig('editedEvents', editedEvents),
      saveConfig('hiddenMasters', hiddenMasters),
      saveConfig('showAdsPerMaster', showAdsPerMaster),
      saveConfig('eventLogos', eventLogos),
    ]);
    alert('All changes saved!');
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-brand-light pt-32 py-12 flex items-center justify-center">
        <div className="max-w-md w-full mx-auto bg-white p-10 rounded-3xl shadow-2xl border border-primary/20">
          <h2 className="text-4xl font-black text-center text-brand-dark mb-8">Admin Login</h2>
          {error && <p className="text-primary font-bold text-center mb-6 text-xl">{error}</p>}
          <form onSubmit={handleLogin} className="space-y-6">
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Username"
              className="w-full p-5 text-lg border-2 border-gray-300 rounded-xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/20"
              required
            />
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full p-5 text-lg border-2 border-gray-300 rounded-xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/20"
              required
            />
            <button
              type="submit"
              className="w-full bg-primary text-white py-5 text-2xl font-bold rounded-xl hover:bg-primary/90 transition shadow-xl"
            >
              Login
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-light pt-32 pb-20 px-6">
      <div className="max-w-7xl mx-auto">
        <button
          onClick={() => navigate('/admin')}
          className="mb-8 bg-brand-dark text-white px-8 py-4 rounded-xl hover:bg-brand-dark/90 font-bold transition shadow-lg"
        >
          ← Back to Admin Dashboard
        </button>

        <h1 className="text-5xl font-black text-center mb-16 text-brand-dark">
          Manage Master Events
        </h1>

        {loading && (
          <div className="text-center py-20">
            <div className="inline-block animate-spin rounded-full h-16 w-16 border-t-4 border-primary"></div>
            <p className="mt-8 text-2xl text-brand-dark">Loading events...</p>
          </div>
        )}

        <section className="space-y-12">
          {Object.keys(masterGroups).map(masterKey => {
            const linkedEvents = getLinkedEvents(masterKey);
            const displayName = editedEvents[masterKey]?.name || masterKey;
            const logo = eventLogos[masterKey];

            return (
              <div key={masterKey} className="p-10 bg-white rounded-3xl shadow-2xl border border-primary/20">
                <div className="flex flex-col space-y-6 mb-8">
                  <div>
                    <span className="text-sm text-gray-500">Master Key:</span>
                    <span className="ml-3 font-mono text-sm bg-gray-100 px-3 py-1 rounded-lg">{masterKey}</span>
                  </div>
                  <input
                    type="text"
                    value={displayName}
                    onChange={e => handleEditName(masterKey, e.target.value)}
                    className="text-4xl font-black p-5 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/20"
                    placeholder="Master Event Display Name"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mb-10">
                  <div>
                    <label className="block text-lg font-bold text-brand-dark mb-4">Upload Logo</label>
                    <input
                      type="file"
                      onChange={e => handleFileUpload(e, masterKey)}
                      accept="image/*"
                      className="block w-full text-sm text-gray-600 file:mr-6 file:py-4 file:px-8 file:rounded-full file:border-0 file:text-sm file:font-bold file:bg-primary file:text-white hover:file:bg-primary/90 transition"
                    />
                    {logo && (
                      <img src={logo} alt={`${displayName} Logo`} className="mt-8 max-h-48 rounded-2xl shadow-xl border border-primary/10" />
                    )}
                  </div>

                  <div className="flex flex-col justify-center space-y-8">
                    <label className="flex items-center text-xl">
                      <input
                        type="checkbox"
                        checked={!hiddenMasters.includes(masterKey)}
                        onChange={() => toggleMasterVisibility(masterKey)}
                        className="mr-6 h-8 w-8 text-primary rounded focus:ring-primary/30"
                      />
                      <span className="font-bold text-brand-dark">Visible in Public App</span>
                    </label>
                    <label className="flex items-center text-xl">
                      <input
                        type="checkbox"
                        checked={!!showAdsPerMaster[masterKey]}
                        onChange={() => toggleShowAds(masterKey)}
                        className="mr-6 h-8 w-8 text-primary rounded focus:ring-primary/30"
                      />
                      <span className="font-bold text-brand-dark">Show Ads on This Series</span>
                    </label>
                  </div>
                </div>

                <div>
                  <h3 className="text-3xl font-black text-brand-dark mb-6">
                    Linked Event Years ({linkedEvents.length})
                  </h3>
                  {linkedEvents.length > 0 ? (
                    <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {linkedEvents.map(event => (
                        <li key={event.id} className="bg-brand-light/50 p-6 rounded-2xl border border-primary/10 flex justify-between items-center shadow-md">
                          <span className="font-bold text-brand-dark">{formatDate(event.start_time)}</span>
                          <span className="text-brand-dark">{editedEvents[event.id]?.name || event.name}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-gray-500 italic text-lg">No events currently linked to this master.</p>
                  )}
                </div>
              </div>
            );
          })}

          <div className="text-center mt-20">
            <button
              onClick={handleSaveChanges}
              className="bg-primary text-white px-20 py-8 rounded-full text-3xl font-black hover:bg-primary/90 shadow-2xl transition transform hover:scale-105"
            >
              Save All Changes to Supabase
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}