// src/pages/MasterEvents.jsx (FULLY FIXED — Uses start_time only, no more crashes)
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchEvents as fetchChronoEvents } from '../api/chronotrackapi.cjs';
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
      <div className="min-h-screen bg-gemini-light-gray pt-32 py-12">
        <div className="max-w-md mx-auto bg-white p-8 rounded-lg shadow">
          <h2 className="text-3xl font-bold mb-6 text-center">Admin Login</h2>
          {error && <p className="text-gemini-red mb-4">{error}</p>}
          <form onSubmit={handleLogin}>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Username"
              className="w-full p-4 mb-4 rounded-lg border border-gray-300"
              required
            />
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full p-4 mb-6 rounded-lg border border-gray-300"
              required
            />
            <button type="submit" className="w-full bg-gemini-blue text-white p-4 rounded-lg hover:bg-gemini-blue/90">
              Login
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gemini-light-gray pt-32 pb-20 px-6">
      <div className="max-w-7xl mx-auto">
        <button
          onClick={() => navigate('/admin')}
          className="mb-8 bg-gray-600 text-white px-6 py-3 rounded-xl hover:bg-gray-700"
        >
          ← Back to Admin Dashboard
        </button>

        <h1 className="text-5xl font-bold text-center mb-16 text-gemini-dark-gray">
          Manage Master Events
        </h1>

        {loading && <p className="text-center text-3xl">Loading events...</p>}

        <section className="space-y-12">
          {Object.keys(masterGroups).map(masterKey => {
            const linkedEvents = getLinkedEvents(masterKey);
            const displayName = editedEvents[masterKey]?.name || masterKey;
            const logo = eventLogos[masterKey];

            return (
              <div key={masterKey} className="mb-12 p-8 bg-white rounded-2xl shadow-xl border border-gray-200">
                <div className="flex flex-col space-y-6 mb-8">
                  <div>
                    <span className="text-sm text-gray-500">Key:</span>
                    <span className="ml-2 font-mono text-sm bg-gray-100 px-2 py-1 rounded">{masterKey}</span>
                  </div>

                  <input
                    type="text"
                    value={displayName}
                    onChange={e => handleEditName(masterKey, e.target.value)}
                    className="text-3xl font-bold p-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-gemini-blue"
                    placeholder="Master Event Display Name"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                  <div>
                    <label className="block font-medium mb-3 text-lg">Upload Logo</label>
                    <input
                      type="file"
                      onChange={e => handleFileUpload(e, masterKey)}
                      accept="image/*"
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-3 file:px-6 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-gemini-blue file:text-white hover:file:bg-gemini-blue/90"
                    />
                    {logo && (
                      <img src={logo} alt={`${displayName} Logo`} className="mt-6 max-h-40 rounded-xl shadow-lg" />
                    )}
                  </div>

                  <div className="flex flex-col justify-center space-y-6">
                    <label className="flex items-center text-lg">
                      <input
                        type="checkbox"
                        checked={!hiddenMasters.includes(masterKey)}
                        onChange={() => toggleMasterVisibility(masterKey)}
                        className="mr-4 h-6 w-6 text-gemini-blue rounded"
                      />
                      <span>Visible in App</span>
                    </label>

                    <label className="flex items-center text-lg">
                      <input
                        type="checkbox"
                        checked={!!showAdsPerMaster[masterKey]}
                        onChange={() => toggleShowAds(masterKey)}
                        className="mr-4 h-6 w-6 text-gemini-blue rounded"
                      />
                      <span>Show Ads on This Series</span>
                    </label>
                  </div>
                </div>

                <div>
                  <h3 className="text-2xl font-bold mb-6 text-gemini-dark-gray">
                    Linked Event Years ({linkedEvents.length})
                  </h3>
                  {linkedEvents.length > 0 ? (
                    <ul className="space-y-4">
                      {linkedEvents.map(event => (
                        <li key={event.id} className="bg-gray-50 p-5 rounded-xl border border-gray-200 flex justify-between items-center">
                          <span className="font-medium">{formatDate(event.start_time)}</span>
                          <span className="text-gray-700">{editedEvents[event.id]?.name || event.name}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-gray-500 italic">No events currently linked to this master.</p>
                  )}
                </div>
              </div>
            );
          })}

          <div className="text-center mt-16">
            <button
              onClick={handleSaveChanges}
              className="bg-gemini-blue text-white px-16 py-6 rounded-full text-2xl font-bold hover:bg-gemini-blue/90 shadow-2xl transition"
            >
              Save All Changes to Supabase
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}