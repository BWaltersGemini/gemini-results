// src/pages/MasterEvents.jsx (FINAL — Uses admin client for all writes to Supabase)
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchEvents as fetchChronoEvents } from '../api/chronotrackapi.cjs';
import { createAdminSupabaseClient } from '../supabaseClient'; // ← Admin client only
import { loadAppConfig } from '../utils/appConfig';

export default function MasterEvents() {
  const navigate = useNavigate();

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);

  // Global config loaded from Supabase
  const [masterGroups, setMasterGroups] = useState({});
  const [editedEvents, setEditedEvents] = useState({});
  const [hiddenMasters, setHiddenMasters] = useState([]);
  const [showAdsPerMaster, setShowAdsPerMaster] = useState({});
  const [eventLogos, setEventLogos] = useState({});

  const [chronoEvents, setChronoEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  // Create admin client (bypasses RLS)
  const adminSupabase = createAdminSupabaseClient();

  // Load global config from Supabase (public read is fine)
  const loadGlobalConfig = async () => {
    const config = await loadAppConfig();
    setMasterGroups(config.masterGroups || {});
    setEditedEvents(config.editedEvents || {});
    setEventLogos(config.eventLogos || {});
    setHiddenMasters(config.hiddenMasters || []);
    setShowAdsPerMaster(config.showAdsPerMaster || {});
  };

  // Save individual config key to Supabase using admin client
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

  // Login check + load config
  useEffect(() => {
    const loggedIn = typeof window !== 'undefined' && localStorage.getItem('adminLoggedIn') === 'true';
    setIsLoggedIn(loggedIn);
    if (loggedIn) {
      loadGlobalConfig();
    }
  }, []);

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Date TBD';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return 'Invalid Date';
    const year = parseInt(parts[0]);
    const month = parseInt(parts[1]);
    const day = parseInt(parts[2]);
    if (isNaN(year) || isNaN(month) || isNaN(day)) return 'Invalid Date';
    const d = new Date(year, month - 1, day);
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  const parseDate = (dateStr) => {
    if (!dateStr) return new Date(NaN);
    const parts = dateStr.split('-');
    if (parts.length !== 3) return new Date(NaN);
    const year = parseInt(parts[0]);
    const month = parseInt(parts[1]);
    const day = parseInt(parts[2]);
    if (isNaN(year) || isNaN(month) || isNaN(day)) return new Date(NaN);
    return new Date(year, month - 1, day);
  };

  // Fetch events when logged in
  useEffect(() => {
    if (isLoggedIn) {
      const fetchData = async () => {
        try {
          setLoading(true);
          const events = await fetchChronoEvents();
          const sortedEvents = events.sort((a, b) => {
            const dateA = parseDate(a.date);
            const dateB = parseDate(b.date);
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
    // Same credentials as AdminPage
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
    const ids = (masterGroups[masterKey] || []).map(String);
    return chronoEvents
      .filter(event => ids.includes(String(event.id)))
      .sort((a, b) => parseDate(b.date) - parseDate(a.date));
  };

  const handleEditName = async (masterKey, value) => {
    const newEdited = {
      ...editedEvents,
      [masterKey]: { ...editedEvents[masterKey], name: value }
    };
    setEditedEvents(newEdited);
    await saveConfig('editedEvents', newEdited);
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
    const files = Array.from(e.target.files);
    for (const file of files) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const newLogos = { ...eventLogos, [masterKey]: reader.result };
        setEventLogos(newLogos);
        await saveConfig('eventLogos', newLogos);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveChanges = async () => {
    await Promise.all([
      saveConfig('editedEvents', editedEvents),
      saveConfig('hiddenMasters', hiddenMasters),
      saveConfig('showAdsPerMaster', showAdsPerMaster),
      saveConfig('eventLogos', eventLogos),
    ]);
    alert('All changes saved to Supabase successfully!');
  };

  // Login screen
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

  // Loading
  if (loading) {
    return (
      <div className="min-h-screen bg-gemini-light-gray pt-32 py-12 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-t-4 border-gemini-blue mb-8"></div>
          <p className="text-2xl text-gray-700">Loading master events...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gemini-light-gray pt-32 py-12">
      <div className="max-w-7xl mx-auto px-6">
        <button
          onClick={() => navigate('/admin')}
          className="mb-6 bg-blue-500 text-white px-6 py-3 rounded-xl hover:bg-blue-600"
        >
          Back to Admin Dashboard
        </button>

        <h1 className="text-4xl font-bold mb-12 text-center text-gemini-dark-gray">Manage Master Events</h1>

        <section className="mb-12">
          {Object.keys(masterGroups).length === 0 ? (
            <p className="text-center text-gray-600 text-xl">
              No master events created yet. Create and assign them in the main Admin Dashboard.
            </p>
          ) : (
            Object.keys(masterGroups).sort().map((masterKey) => {
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
                            <span className="font-medium">{formatDate(event.date)}</span>
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
            })
          )}

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