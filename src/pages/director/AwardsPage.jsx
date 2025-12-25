// src/pages/director/AwardsPage.jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DirectorLayout from './DirectorLayout';
import { useDirector } from '../../context/DirectorContext';
import { fetchResultsForEvent } from '../../api/chronotrackapi';
import { supabase } from '../../supabaseClient';

export default function AwardsPage() {
  const navigate = useNavigate();
  const { selectedEventId, currentUser } = useDirector();

  const [results, setResults] = useState({ finishers: [], nonFinishers: [] });
  const [awardsState, setAwardsState] = useState({});
  const [loading, setLoading] = useState(true);
  const [topPlaces, setTopPlaces] = useState(3);
  const [mode, setMode] = useState('announcer');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Load results
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
        console.error('Failed to load results:', err);
      } finally {
        setLoading(false);
      }
    };

    loadResults();
  }, [selectedEventId, navigate]);

  // Load awards state from Supabase
  useEffect(() => {
    if (!selectedEventId || !currentUser) return;

    const loadAwardsState = async () => {
      const { data } = await supabase
        .from('director_awards_state')
        .select('*')
        .eq('event_id', selectedEventId)
        .eq('user_id', currentUser.id);

      const state = {};
      data?.forEach(row => {
        const div = row.division;
        if (!state[div]) state[div] = { announced: new Set(), pickedUp: new Set() };
        if (row.announced) state[div].announced.add(row.entry_id);
        if (row.picked_up) state[div].pickedUp.add(row.entry_id);
      });
      setAwardsState(state);
    };

    loadAwardsState();
  }, [selectedEventId, currentUser]);

  // Save state to Supabase
  const saveState = async (division, entryId, type) => {
    const field = type === 'announced' ? 'announced' : 'picked_up';
    const currentValue = type === 'announced'
      ? awardsState[division]?.announced?.has(entryId) || false
      : awardsState[division]?.pickedUp?.has(entryId) || false;

    const newValue = !currentValue;

    await supabase
      .from('director_awards_state')
      .upsert({
        event_id: selectedEventId,
        user_id: currentUser.id,
        division,
        entry_id: entryId,
        [field]: newValue,
      }, { onConflict: 'event_id,user_id,division,entry_id' });

    setAwardsState(prev => {
      const divState = prev[division] || { announced: new Set(), pickedUp: new Set() };
      const set = type === 'announced' ? divState.announced : divState.pickedUp;
      if (newValue) set.add(entryId);
      else set.delete(entryId);
      return { ...prev, [division]: divState };
    });
  };

  const finishers = results.finishers || [];

  // Group by division
  const divisions = {};
  finishers.forEach(r => {
    const div = r.age_group_name || 'Overall';
    if (!divisions[div]) divisions[div] = [];
    divisions[div].push(r);
  });

  // Sort each division by place
  Object.keys(divisions).forEach(div => {
    divisions[div].sort((a, b) => (a.place || Infinity) - (b.place || Infinity));
  });

  // Count runners still on course per division (simplified: any with no chip_time)
  const onCourseByDivision = {};
  finishers.forEach(r => {
    if (!r.chip_time) { // No finish time = still on course
      const div = r.age_group_name || 'Overall';
      onCourseByDivision[div] = (onCourseByDivision[div] || 0) + 1;
    }
  });

  const divisionNames = Object.keys(divisions);

  // Search filter
  let visibleDivisions = divisionNames.filter(div => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return divisions[div].some(r =>
      `${r.first_name} ${r.last_name}`.toLowerCase().includes(term) ||
      r.city?.toLowerCase().includes(term) ||
      r.state?.toLowerCase().includes(term)
    );
  });

  const exportCSV = () => {
    const rows = [];
    visibleDivisions.forEach(div => {
      divisions[div].forEach(r => {
        rows.push([
          div,
          r.place || '-',
          `${r.first_name} ${r.last_name}`,
          r.chip_time || '-',
          r.city || '',
          r.state || '',
          awardsState[div]?.pickedUp?.has(r.entry_id) ? 'Yes' : 'No'
        ]);
      });
    });

    const csv = [['Division','Place','Name','Time','City','State','Picked Up'], ...rows]
      .map(row => row.join(',')).join('\n');
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
        <h1 className="text-4xl font-bold text-text-dark mb-8">Awards Management</h1>

        {loading ? (
          <p className="text-center text-xl text-text-muted">Loading results...</p>
        ) : (
          <>
            <div className="bg-bg-light rounded-2xl shadow-xl p-8 mb-8">
              <div className="grid md:grid-cols-3 gap-6 mb-6">
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
                  <label className="block text-text-dark font-semibold mb-2">Mode</label>
                  <div className="flex gap-4">
                    <button
                      onClick={() => setMode('announcer')}
                      className={`flex-1 py-4 rounded-xl font-bold transition ${mode === 'announcer' ? 'bg-primary text-text-light' : 'bg-white text-text-dark border'}`}
                    >
                      Announcer
                    </button>
                    <button
                      onClick={() => setMode('table')}
                      className={`flex-1 py-4 rounded-xl font-bold transition ${mode === 'table' ? 'bg-primary text-text-light' : 'bg-white text-text-dark border'}`}
                    >
                      Awards Table
                    </button>
                  </div>
                </div>
                <div className="flex items-end">
                  <button
                    onClick={exportCSV}
                    className="w-full bg-primary text-text-light py-4 rounded-xl font-bold hover:bg-primary/90 transition"
                  >
                    Export CSV
                  </button>
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

            {/* Division Jump Links */}
            <div className="flex flex-wrap gap-4 mb-12">
              {visibleDivisions.map(div => {
                const total = divisions[div].length;
                const announcedCount = awardsState[div]?.announced?.size || 0;
                const topCount = Math.min(topPlaces, total);
                const isComplete = announcedCount >= topCount;
                const onCourse = onCourseByDivision[div] || 0;

                return (
                  <a
                    key={div}
                    href={`#division-${div.replace(/\s+/g, '-')}`}
                    className={`px-6 py-4 rounded-xl font-semibold transition ${
                      isComplete
                        ? 'bg-gray-500 text-white cursor-default'
                        : 'bg-primary text-text-light hover:bg-primary/90'
                    }`}
                  >
                    {div} ({announcedCount}/{topCount})
                    {onCourse > 0 && <span className="ml-2 text-yellow-300"> +{onCourse} on course</span>}
                  </a>
                );
              })}
            </div>

            {/* Announcer Mode */}
            {mode === 'announcer' && visibleDivisions.map(div => {
              const top = divisions[div].slice(0, topPlaces);
              const announcedSet = awardsState[div]?.announced || new Set();
              const onCourse = onCourseByDivision[div] || 0;

              return (
                <div
                  key={div}
                  id={`division-${div.replace(/\s+/g, '-')}`}
                  className="mb-16 scroll-mt-24"
                >
                  <h2 className="text-3xl font-bold text-text-dark mb-6">
                    {div} Awards
                    {onCourse > 0 && (
                      <span className="ml-4 text-2xl text-orange-600">
                        ({onCourse} still on course)
                      </span>
                    )}
                  </h2>
                  <div className="space-y-8">
                    {top.length === 0 ? (
                      <p className="text-xl text-text-muted">No finishers in this division yet.</p>
                    ) : (
                      top.map((r, i) => (
                        <div
                          key={r.entry_id}
                          className={`bg-white rounded-2xl shadow-xl p-8 transition ${
                            announcedSet.has(r.entry_id) ? 'opacity-60' : ''
                          }`}
                        >
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="text-5xl font-black text-primary">#{i + 1}</p>
                              <p className="text-3xl font-bold text-text-dark mt-4">
                                {r.first_name} {r.last_name}
                              </p>
                              <p className="text-2xl text-text-muted mt-2">{r.chip_time || '—'}</p>
                              <p className="text-xl text-text-muted mt-4">
                                {r.city && `${r.city}, `}{r.state}
                              </p>
                            </div>
                            <button
                              onClick={() => saveState(div, r.entry_id, 'announced')}
                              className={`px-12 py-6 rounded-full text-2xl font-bold transition ${
                                announcedSet.has(r.entry_id)
                                  ? 'bg-gray-500 text-white'
                                  : 'bg-primary text-text-light hover:bg-primary/90'
                              }`}
                            >
                              {announcedSet.has(r.entry_id) ? 'Announced ✓' : 'Mark Announced'}
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}

            {/* Awards Table Mode */}
            {mode === 'table' && (
              <div>
                <h2 className="text-3xl font-bold text-text-dark mb-6">Awards Pickup Table</h2>
                <div className="overflow-x-auto bg-white rounded-2xl shadow-xl">
                  <table className="w-full">
                    <thead className="bg-text-dark text-text-light">
                      <tr>
                        <th className="px-8 py-6 text-left">Division</th>
                        <th className="px-8 py-6 text-left">Place</th>
                        <th className="px-8 py-6 text-left">Name</th>
                        <th className="px-8 py-6 text-left">Time</th>
                        <th className="px-8 py-6 text-left">City, State</th>
                        <th className="px-8 py-6 text-center">Picked Up</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {visibleDivisions.flatMap(div =>
                        divisions[div].slice((page - 1) * pageSize, page * pageSize).map(r => (
                          <tr key={r.entry_id} className="hover:bg-bg-light transition">
                            <td className="px-8 py-6 font-medium">{div}</td>
                            <td className="px-8 py-6 font-bold text-xl text-primary">{r.place || '-'}</td>
                            <td className="px-8 py-6 font-semibold">{r.first_name} {r.last_name}</td>
                            <td className="px-8 py-6">{r.chip_time || '-'}</td>
                            <td className="px-8 py-6">{r.city && `${r.city}, `}{r.state}</td>
                            <td className="px-8 py-6 text-center">
                              <input
                                type="checkbox"
                                checked={awardsState[div]?.pickedUp?.has(r.entry_id) || false}
                                onChange={() => saveState(div, r.entry_id, 'pickedUp')}
                                className="h-8 w-8 text-primary rounded focus:ring-primary"
                              />
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {divisionNames.length > pageSize && (
                  <div className="flex justify-center gap-4 mt-8">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="px-6 py-3 bg-text-dark text-text-light rounded-full disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <span className="text-xl self-center">Page {page}</span>
                    <button
                      onClick={() => setPage(p => p + 1)}
                      disabled={visibleDivisions.flatMap(d => divisions[d]).length <= page * pageSize}
                      className="px-6 py-3 bg-text-dark text-text-light rounded-full disabled:opacity-50"
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