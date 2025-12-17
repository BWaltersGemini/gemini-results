// src/pages/MasterEvents.jsx (FIXED — Loading state for masterGroups)
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchEvents as fetchChronoEvents } from '../api/chronotrackapi.cjs';
import { useLocalStorage } from '../utils/useLocalStorage';

export default function MasterEvents() {
  const navigate = useNavigate();

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);

  const [masterGroups, , masterGroupsLoading] = useLocalStorage('masterGroups', {});
  const [editedEvents, setEditedEvents] = useLocalStorage('editedEvents', {});
  const [hiddenMasters, setHiddenMasters] = useLocalStorage('hiddenMasters', []);
  const [showAdsPerMaster, setShowAdsPerMaster] = useLocalStorage('showAdsPerMaster', {});
  const [eventLogos, setEventLogos] = useLocalStorage('eventLogos', {});

  const [chronoEvents, setChronoEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Date TBD';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return 'Invalid Date';
    const year = parseInt(parts[0]);
    const month = parseInt(parts[1]);
    const day = parseInt(parts[2]);
    if (isNaN(year) || isNaN(month) || isNaN(day)) return 'Invalid Date';
    const d = new Date(year, month - 1, day);
    if (isNaN(d.getTime())) return 'Invalid Date';
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

  // Check login status
  useEffect(() => {
    const loggedIn = typeof window !== 'undefined' && localStorage.getItem('adminLoggedIn') === 'true';
    setIsLoggedIn(loggedIn);
  }, []);

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
    if (username === 'admin' && password === 'password') {
      localStorage.setItem('adminLoggedIn', 'true');
      setIsLoggedIn(true);
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

  const handleEditName = (id, value) => {
    setEditedEvents(prev => ({
      ...prev,
      [id]: { ...prev[id], name: value }
    }));
  };

  const toggleMasterVisibility = (masterKey) => {
    setHiddenMasters(prev => prev.includes(masterKey) ? prev.filter(id => id !== masterKey) : [...prev, masterKey]);
  };

  const toggleShowAds = (masterKey) => {
    setShowAdsPerMaster(prev => ({ ...prev, [masterKey]: !prev[masterKey] }));
  };

  const handleFileUpload = (e, type, id) => {
    const files = Array.from(e.target.files);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (type === 'logo') {
          setEventLogos(prev => ({ ...prev, [id]: reader.result }));
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleSaveChanges = () => {
    alert('Changes saved!');
  };

  // Show loading if either events or masterGroups are loading
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gemini-light-gray pt-32 py-12">
        <div className="max-w-7xl mx-auto px-6">
          <form onSubmit={handleLogin} className="max-w-md mx-auto bg-white p-8 rounded-lg shadow">
            <h2 className="text-3xl font-bold mb-6 text-center">Admin Login</h2>
            {error && <p className="text-gemini-red mb-4">{error}</p>}
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

  if (loading || masterGroupsLoading) {
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
          Back to Admin Page
        </button>
        <h1 className="text-4xl font-bold mb-12 text-center text-gemini-dark-gray">Manage Master Events</h1>

        <section className="mb-12">
          {Object.keys(masterGroups).length === 0 ? (
            <p className="text-center text-gray-600 text-xl">
              No master events created yet. Create them in the main Admin page.
            </p>
          ) : (
            Object.keys(masterGroups).sort().map((masterKey) => {
              const linkedEvents = getLinkedEvents(masterKey);
              return (
                <div key={masterKey} className="mb-8 p-8 bg-white rounded-2xl shadow-xl border border-gray-200">
                  <div className="flex flex-col space-y-4 mb-6">
                    <div>
                      <span className="text-sm text-gray-500">Key:</span>
                      <span className="ml-2 font-mono text-sm bg-gray-100 px-2 py-1 rounded">{masterKey}</span>
                    </div>
                    <input
                      type="text"
                      value={editedEvents[masterKey]?.name || masterKey}
                      onChange={e => handleEditName(masterKey, e.target.value)}
                      className="text-3xl font-bold p-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-gemini-blue"
                      placeholder="Master Event Display Name"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div>
                      <label className="block font-medium mb-2">Upload Logo</label>
                      <input type="file" onChange={e => handleFileUpload(e, 'logo', masterKey)} accept="image/*" className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-gemini-blue file:text-white hover:file:bg-gemini-blue/90" />
                      {eventLogos[masterKey] && (
                        <img src={eventLogos[masterKey]} alt="Master Logo" className="mt-4 max-h-32 rounded-lg shadow-md" />
                      )}
                    </div>
                    <div className="flex flex-col justify-center space-y-4">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={!hiddenMasters.includes(masterKey)}
                          onChange={() => toggleMasterVisibility(masterKey)}
                          className="mr-3 h-5 w-5 text-gemini-blue"
                        />
                        <span className="text-lg">Visible in App</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={!!showAdsPerMaster[masterKey]}
                          onChange={() => toggleShowAds(masterKey)}
                          className="mr-3 h-5 w-5 text-gemini-blue"
                        />
                        <span className="text-lg">Show Ads</span>
                      </label>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold mb-4 text-gemini-dark-gray">Linked Event Years ({linkedEvents.length})</h3>
                    {linkedEvents.length > 0 ? (
                      <ul className="space-y-3">
                        {linkedEvents.map(event => (
                          <li key={event.id} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                            <span className="font-medium">{formatDate(event.date)}</span> —
                            <span className="ml-2">{editedEvents[event.id]?.name || event.name}</span>
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
          <div className="text-center mt-12">
            <button onClick={handleSaveChanges} className="bg-gemini-blue text-white px-12 py-4 rounded-full text-xl font-bold hover:bg-gemini-blue/90 shadow-lg">
              Save All Changes
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}