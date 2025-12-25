// src/pages/director/AwardsPage.jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DirectorLayout from './DirectorLayout';
import { useDirector } from '../../context/DirectorContext';
import { fetchResultsForEvent } from '../../api/chronotrackapi'; // Reuse public fetch for results

export default function AwardsPage() {
  const navigate = useNavigate();
  const { selectedEventId } = useDirector();

  const [results, setResults] = useState({ finishers: [], nonFinishers: [] });
  const [loading, setLoading] = useState(true);
  const [topPlaces, setTopPlaces] = useState(3); // Default top 3
  const [mode, setMode] = useState('announcer'); // 'announcer' or 'table'
  const [selectedRace, setSelectedRace] = useState('all');
  const [selectedDivision, setSelectedDivision] = useState('overall');
  const [announced, setAnnounced] = useState(new Set()); // Set of entry_id
  const [searchTerm, setSearchTerm] = useState('');
  const [pickedUp, setPickedUp] = useState(new Set()); // For table mode
  const [page, setPage] = useState(1);
  const pageSize = 20;

  useEffect(() => {
    if (!selectedEventId) {
      navigate('/race-directors-hub');
      return;
    }

    const loadResults = async () => {
      setLoading(true);
      try {
        const data = await fetchResultsForEvent(selectedEventId);
        setResults(data);
      } catch (err) {
        console.error('Failed to load results for awards:', err);
      } finally {
        setLoading(false);
      }
    };

    loadResults();
  }, [selectedEventId, navigate]);

  // Filter finishers only
  const allFinishers = results.finishers || [];

  // Unique races and divisions
  const races = ['all', ...new Set(allFinishers.map(r => r.race_name).filter(Boolean))];
  const divisions = ['overall', ...new Set(allFinishers.map(r => r.age_group_name).filter(Boolean))];

  // Filtered data
  let filtered = allFinishers.filter(r => {
    if (selectedRace !== 'all' && r.race_name !== selectedRace) return false;
    if (selectedDivision !== 'overall' && r.age_group_name !== selectedDivision) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return `${r.first_name} ${r.last_name}`.toLowerCase().includes(term) ||
             r.city?.toLowerCase().includes(term) ||
             r.state?.toLowerCase().includes(term);
    }
    return true;
  });

  // Sort by place (overall)
  filtered.sort((a, b) => (a.place || Infinity) - (b.place || Infinity));

  // Top finishers for awards
  const topFinishers = filtered.slice(0, topPlaces);

  // Paginated for table mode
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);
  const totalPages = Math.ceil(filtered.length / pageSize);

  const toggleAnnounced = (entryId) => {
    setAnnounced(prev => {
      const newSet = new Set(prev);
      if (newSet.has(entryId)) newSet.delete(entryId);
      else newSet.add(entryId);
      return newSet;
    });
  };

  const togglePickedUp = (entryId) => {
    setPickedUp(prev => {
      const newSet = new Set(prev);
      if (newSet.has(entryId)) newSet.delete(entryId);
      else newSet.add(entryId);
      return newSet;
    });
  };

  const exportCSV = () => {
    const headers = ['Place', 'Name', 'Time', 'City', 'State', 'Picked Up'];
    const rows = filtered.map(r => [
      r.place || '-',
      `${r.first_name} ${r.last_name}`,
      r.chip_time || '-',
      r.city || '',
      r.state || '',
      pickedUp.has(r.entry_id) ? 'Yes' : 'No'
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `awards-${selectedEventId}.csv`;
    a.click();
  };

  if (!selectedEventId) return null;

  return (
    <DirectorLayout>
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold text-brand-dark mb-8">Awards Management</h1>

        {loading ? (
          <p className="text-center text-xl text-text-muted">Loading results...</p>
        ) : (
          <>
            {/* Controls */}
            <div className="bg-bg-light rounded-2xl shadow-xl p-8 mb-8">
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                <div>
                  <label className="block text-text-dark font-semibold mb-2">Top Places to Award</label>
                  <select
                    value={topPlaces}
                    onChange={(e) => setTopPlaces(Number(e.target.value))}
                    className="w-full p-4 border border-gray-300 rounded-xl focus:ring-4 focus:ring-accent/30"
                  >
                    {[3, 5, 10].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-text-dark font-semibold mb-2">Race</label>
                  <select
                    value={selectedRace}
                    onChange={(e) => setSelectedRace(e.target.value)}
                    className="w-full p-4 border border-gray-300 rounded-xl"
                  >
                    {races.map(r => <option key={r} value={r}>{r === 'all' ? 'All Races' : r}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-text-dark font-semibold mb-2">Division</label>
                  <select
                    value={selectedDivision}
                    onChange={(e) => setSelectedDivision(e.target.value)}
                    className="w-full p-4 border border-gray-300 rounded-xl"
                  >
                    {divisions.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-text-dark font-semibold mb-2">Mode</label>
                  <div className="flex gap-4">
                    <button
                      onClick={() => setMode('announcer')}
                      className={`flex-1 py-4 rounded-xl font-bold transition ${mode === 'announcer' ? 'bg-primary text-white' : 'bg-white text-text-dark border'}`}
                    >
                      Announcer
                    </button>
                    <button
                      onClick={() => setMode('table')}
                      className={`flex-1 py-4 rounded-xl font-bold transition ${mode === 'table' ? 'bg-primary text-white' : 'bg-white text-text-dark border'}`}
                    >
                      Awards Table
                    </button>
                  </div>
                </div>
              </div>

              <input
                type="text"
                placeholder="Search by name, city, state..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full p-4 border border-gray-300 rounded-xl"
              />
            </div>

            {/* Announcer Mode */}
            {mode === 'announcer' && (
              <div className="space-y-8">
                <h2 className="text-3xl font-bold text-brand-dark">Top {topPlaces} Finishers</h2>
                {topFinishers.map((r, i) => (
                  <div
                    key={r.entry_id}
                    className={`bg-white rounded-2xl shadow-xl p-8 transition ${announced.has(r.entry_id) ? 'opacity-60' : ''}`}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-5xl font-black text-primary">#{i + 1}</p>
                        <p className="text-3xl font-bold text-text-dark mt-4">{r.first_name} {r.last_name}</p>
                        <p className="text-2xl text-text-muted mt-2">{r.chip_time}</p>
                        <p className="text-xl text-text-muted mt-4">{r.city}, {r.state}</p>
                      </div>
                      <button
                        onClick={() => toggleAnnounced(r.entry_id)}
                        className={`px-12 py-6 rounded-full text-2xl font-bold transition ${announced.has(r.entry_id) ? 'bg-gray-400 text-white' : 'bg-primary text-white hover:bg-primary/90'}`}
                      >
                        {announced.has(r.entry_id) ? 'Announced ✓' : 'Mark Announced'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Awards Table Mode */}
            {mode === 'table' && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-3xl font-bold text-brand-dark">Awards Pickup Table</h2>
                  <button
                    onClick={exportCSV}
                    className="bg-primary text-white px-8 py-4 rounded-full font-bold hover:bg-primary/90 transition"
                  >
                    Export CSV
                  </button>
                </div>

                <div className="overflow-x-auto bg-white rounded-2xl shadow-xl">
                  <table className="w-full">
                    <thead className="bg-brand-dark text-white">
                      <tr>
                        <th className="px-8 py-6 text-left">Place</th>
                        <th className="px-8 py-6 text-left">Name</th>
                        <th className="px-8 py-6 text-left">Time</th>
                        <th className="px-8 py-6 text-left">City, State</th>
                        <th className="px-8 py-6 text-center">Picked Up</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {paginated.map(r => (
                        <tr key={r.entry_id} className="hover:bg-bg-light transition">
                          <td className="px-8 py-6 font-bold text-xl text-primary">{r.place || '-'}</td>
                          <td className="px-8 py-6 font-semibold text-lg">{r.first_name} {r.last_name}</td>
                          <td className="px-8 py-6">{r.chip_time || '-'}</td>
                          <td className="px-8 py-6">{r.city && `${r.city}, `}{r.state}</td>
                          <td className="px-8 py-6 text-center">
                            <input
                              type="checkbox"
                              checked={pickedUp.has(r.entry_id)}
                              onChange={() => togglePickedUp(r.entry_id)}
                              className="h-8 w-8 text-primary rounded focus:ring-primary"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex justify-center gap-4 mt-8">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="px-6 py-3 bg-brand-dark text-white rounded-full disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <span className="text-xl self-center">Page {page} of {totalPages}</span>
                    <button
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="px-6 py-3 bg-brand-dark text-white rounded-full disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </DirectorLayout>
  );
}