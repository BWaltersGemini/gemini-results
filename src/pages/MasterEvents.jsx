// src/pages/MasterEvents.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchEvents as fetchChronoEvents } from '../api/chronotrackapi.cjs';  // Updated to .cjs

export default function MasterEvents() {
  const navigate = useNavigate();
  const [isLoggedIn, setIsLoggedIn] = useState(localStorage.getItem('adminLoggedIn') === 'true');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [masterGroups, setMasterGroups] = useState(JSON.parse(localStorage.getItem('masterGroups')) || {});
  const [editedEvents, setEditedEvents] = useState(JSON.parse(localStorage.getItem('editedEvents')) || {});
  const [hiddenMasters, setHiddenMasters] = useState(JSON.parse(localStorage.getItem('hiddenMasters')) || []);
  const [showAdsPerMaster, setShowAdsPerMaster] = useState(JSON.parse(localStorage.getItem('showAdsPerMaster')) || {});
  const [eventLogos, setEventLogos] = useState(JSON.parse(localStorage.getItem('eventLogos')) || {});
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

  useEffect(() => {
    if (isLoggedIn) {
      const fetchData = async () => {
        try {
          const events = await fetchChronoEvents();
          // Sort by date descending
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
    const ids = masterGroups[masterKey] || [];
    return chronoEvents
      .filter(event => ids.includes(event.id))
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
    localStorage.setItem('editedEvents', JSON.stringify(editedEvents));
    localStorage.setItem('hiddenMasters', JSON.stringify(hiddenMasters));
    localStorage.setItem('showAdsPerMaster', JSON.stringify(showAdsPerMaster));
    localStorage.setItem('eventLogos', JSON.stringify(eventLogos));
    alert('Changes saved!');
  };

  return (
    <div className="min-h-screen bg-gemini-light-gray pt-32 py-12">
      <div className="max-w-7xl mx-auto px-6">
        {!isLoggedIn ? (
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
        ) : (
          <>
            <button
              onClick={() => navigate('/admin')}
              className="mb-6 bg-blue-500 text-white px-6 py-3 rounded-xl hover:bg-blue-600"
            >
              Back to Admin Page
            </button>
            <h1 className="text-4xl font-bold mb-12 text-center text-gemini-dark-gray">Manage Master Events</h1>
            {loading && <p className="text-center text-2xl">Loading events...</p>}
            <section className="mb-12">
              {Object.keys(masterGroups).sort().map((masterKey) => {
                const linkedEvents = getLinkedEvents(masterKey);
                return (
                  <div key={masterKey} className="mb-4 p-6 bg-white rounded-xl shadow">
                    <div className="flex flex-col space-y-1">
                      <span className="text-sm text-gray-500">Key: {masterKey}</span>
                      <span className="text-sm text-gray-500">Original/Default: {masterKey}</span>
                      <input
                        type="text"
                        value={editedEvents[masterKey]?.name || masterKey}
                        onChange={e => handleEditName(masterKey, e.target.value)}
                        className="text-2xl font-bold p-2 border border-gray-300 rounded"
                      />
                    </div>
                    <div className="mt-2">
                      <label>Upload Logo:</label>
                      <input type="file" onChange={e => handleFileUpload(e, 'logo', masterKey)} accept="image/*" />
                      {eventLogos[masterKey] && <img src={eventLogos[masterKey]} alt="Logo" className="mt-2 max-h-20" />}
                    </div>
                    <div className="flex items-center mt-2">
                      <input
                        type="checkbox"
                        checked={!hiddenMasters.includes(masterKey)}
                        onChange={() => toggleMasterVisibility(masterKey)}
                        className="mr-2"
                      />
                      <span>Visible in App</span>
                      <input
                        type="checkbox"
                        checked={!!showAdsPerMaster[masterKey]}
                        onChange={() => toggleShowAds(masterKey)}
                        className="ml-4 mr-2"
                      />
                      <span>Show Ads</span>
                    </div>
                    <div className="mt-4">
                      <h3 className="text-xl font-bold mb-2">Linked Event Years</h3>
                      {linkedEvents.length > 0 ? (
                        <ul className="list-disc ml-6">
                          {linkedEvents.map(event => (
                            <li key={event.id}>
                              {formatDate(event.date)} - {editedEvents[event.id]?.name || event.name}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p>No events linked to this master.</p>
                      )}
                    </div>
                  </div>
                );
              })}
              <button onClick={handleSaveChanges} className="mt-4 bg-gemini-blue text-white px-6 py-3 rounded-xl hover:bg-gemini-blue/90">
                Save Changes
              </button>
            </section>
          </>
        )}
      </div>
    </div>
  );
}