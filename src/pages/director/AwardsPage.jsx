// src/pages/director/AwardsPage.jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DirectorLayout from './DirectorLayout';
import { useDirector } from '../../context/DirectorContext';
import { supabase } from '../../supabaseClient';

export default function AwardsPage() {
  const navigate = useNavigate();
  const { selectedEventId, currentUser } = useDirector();

  const [finishers, setFinishers] = useState([]);
  const [awardsState, setAwardsState] = useState({});
  const [loading, setLoading] = useState(true);
  const [topPlaces, setTopPlaces] = useState(3);
  const [mode, setMode] = useState('announcer');
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedAnnouncer, setCopiedAnnouncer] = useState(false);
  const [copiedTable, setCopiedTable] = useState(false);

  // If user is not authenticated yet (after refresh), show authenticating state
  if (!currentUser) {
    return (
      <DirectorLayout>
        <div className="flex items-center justify-center min-h-[70vh]">
          <p className="text-2xl text-text-muted">Authenticating...</p>
        </div>
      </DirectorLayout>
    );
  }

  // If no event selected, redirect to hub
  if (!selectedEventId) {
    navigate('/race-directors-hub');
    return null;
  }

  // Load live results from chronotrack_results
  useEffect(() => {
    const fetchInitial = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('chronotrack_results')
        .select('*')
        .eq('event_id', selectedEventId)
        .order('place', { ascending: true });

      setFinishers(data || []);
      setLoading(false);
    };

    fetchInitial();

    const channel = supabase
      .channel(`awards-${selectedEventId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chronotrack_results', filter: `event_id=eq.${selectedEventId}` },
        (payload) => {
          setFinishers((prev) => {
            const index = prev.findIndex((r) => r.entry_id === payload.new.entry_id);
            if (index >= 0) {
              const updated = [...prev];
              updated[index] = payload.new;
              return updated;
            }
            return [...prev, payload.new];
          });
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [selectedEventId]);

  // Load director-specific awards state
  useEffect(() => {
    if (!currentUser) return;

    const loadState = async () => {
      const { data } = await supabase
        .from('director_awards_state')
        .select('*')
        .eq('event_id', selectedEventId)
        .eq('user_id', currentUser.id);

      const state = {};
      data?.forEach((row) => {
        const div = row.division;
        if (!state[div]) state[div] = { announced: new Set(), pickedUp: new Set() };
        if (row.announced) state[div].announced.add(row.entry_id);
        if (row.picked_up) state[div].pickedUp.add(row.entry_id);
      });
      setAwardsState(state);
    };

    loadState();
  }, [selectedEventId, currentUser]);

  const saveState = async (division, entryId, type) => {
    const field = type === 'announced' ? 'announced' : 'picked_up';
    const current = type === 'announced'
      ? awardsState[division]?.announced?.has(entryId) || false
      : awardsState[division]?.pickedUp?.has(entryId) || false;

    await supabase
      .from('director_awards_state')
      .upsert(
        {
          event_id: selectedEventId,
          user_id: currentUser.id,
          division,
          entry_id: entryId,
          [field]: !current,
        },
        { onConflict: 'event_id,user_id,division,entry_id' }
      );

    setAwardsState((prev) => {
      const divState = prev[division] || { announced: new Set(), pickedUp: new Set() };
      const set = type === 'announced' ? divState.announced : divState.pickedUp;
      if (!current) set.add(entryId);
      else set.delete(entryId);
      return { ...prev, [division]: divState };
    });
  };

  // Division ordering: Male Overall → Female Overall → youngest to oldest age groups
  const getDivisions = () => {
    const ageGroupDivisions = [...new Set(finishers.map((r) => r.age_group_name).filter(Boolean))];

    const sortedAgeGroups = ageGroupDivisions.sort((a, b) => {
      const ageA = parseInt(a.match(/\d+/)?.[0] || 0);
      const ageB = parseInt(b.match(/\d+/)?.[0] || 0);
      return ageA - ageB; // youngest first
    });

    return ['Male Overall', 'Female Overall', ...sortedAgeGroups];
  };

  const divisions = getDivisions();

  const getRunnersInDivision = (divName) => {
    if (divName === 'Male Overall') {
      return finishers
        .filter((r) => r.gender === 'M')
        .sort((a, b) => (a.place || Infinity) - (b.place || Infinity));
    }
    if (divName === 'Female Overall') {
      return finishers
        .filter((r) => r.gender === 'F')
        .sort((a, b) => (a.place || Infinity) - (b.place || Infinity));
    }
    return finishers
      .filter((r) => r.age_group_name === divName)
      .sort((a, b) => (a.age_group_place || Infinity) - (b.age_group_place || Infinity));
  };

  const onCourseInDivision = (divName) => {
    const runners = getRunnersInDivision(divName);
    return runners.filter((r) => !r.chip_time).length;
  };

  const visibleDivisions = divisions.filter((div) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    const runners = getRunnersInDivision(div);
    return runners.some(
      (r) =>
        `${r.first_name} ${r.last_name}`.toLowerCase().includes(term) ||
        r.city?.toLowerCase().includes(term) ||
        r.state?.toLowerCase().includes(term)
    );
  });

  // Share URLs
  const announcerUrl = `${window.location.origin}/awards-announcer/${selectedEventId}`;
  const tableUrl = `${window.location.origin}/awards-table/${selectedEventId}`;

  const handleCopy = (text, type) => {
    navigator.clipboard.writeText(text);
    if (type === 'announcer') {
      setCopiedAnnouncer(true);
      setTimeout(() => setCopiedAnnouncer(false), 2000);
    } else {
      setCopiedTable(true);
      setTimeout(() => setCopiedTable(false), 2000);
    }
  };

  return (
    <DirectorLayout>
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold text-text-dark mb-8">Awards Management</h1>

        {/* Share Links Section */}
        <div className="bg-accent/20 rounded-2xl p-8 mb-12">
          <h2 className="text-3xl font-bold text-text-dark mb-8">Share Live Awards Views</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white rounded-2xl shadow-xl p-8">
              <h3 className="text-2xl font-bold text-primary mb-4">Announcer View</h3>
              <p className="text-text-muted mb-6">Large, phone-friendly cards — perfect for reading names during the ceremony.</p>
              <div className="flex gap-4">
                <input
                  type="text"
                  value={announcerUrl}
                  readOnly
                  className="flex-1 p-4 border border-gray-300 rounded-xl bg-gray-50"
                />
                <button
                  onClick={() => handleCopy(announcerUrl, 'announcer')}
                  className="bg-primary text-text-light px-8 py-4 rounded-xl font-bold hover:bg-primary/90 transition"
                >
                  {copiedAnnouncer ? 'Copied!' : 'Copy Link'}
                </button>
              </div>
              <a
                href={announcerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block mt-6 text-center bg-red-600 text-white py-4 rounded-xl font-bold hover:bg-red-700 transition"
              >
                Open Announcer View
              </a>
            </div>

            <div className="bg-white rounded-2xl shadow-xl p-8">
              <h3 className="text-2xl font-bold text-primary mb-4">Awards Table View</h3>
              <p className="text-text-muted mb-6">Full table for volunteers to check off pickups.</p>
              <div className="flex gap-4">
                <input
                  type="text"
                  value={tableUrl}
                  readOnly
                  className="flex-1 p-4 border border-gray-300 rounded-xl bg-gray-50"
                />
                <button
                  onClick={() => handleCopy(tableUrl, 'table')}
                  className="bg-primary text-text-light px-8 py-4 rounded-xl font-bold hover:bg-primary/90 transition"
                >
                  {copiedTable ? 'Copied!' : 'Copy Link'}
                </button>
              </div>
              <a
                href={tableUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block mt-6 text-center bg-red-600 text-white py-4 rounded-xl font-bold hover:bg-red-700 transition"
              >
                Open Table View
              </a>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-bg-light rounded-2xl shadow-xl p-8 mb-12">
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <div>
              <label className="block text-text-dark font-semibold mb-2">Top Places to Award</label>
              <select
                value={topPlaces}
                onChange={(e) => setTopPlaces(Number(e.target.value))}
                className="w-full p-4 border border-gray-300 rounded-xl focus:ring-4 focus:ring-accent/30"
              >
                {[3, 5, 10].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-text-dark font-semibold mb-2">View Mode</label>
              <div className="flex gap-4">
                <button
                  onClick={() => setMode('announcer')}
                  className={`flex-1 py-4 rounded-xl font-bold transition ${
                    mode === 'announcer' ? 'bg-primary text-text-light' : 'bg-white text-text-dark border'
                  }`}
                >
                  Announcer
                </button>
                <button
                  onClick={() => setMode('table')}
                  className={`flex-1 py-4 rounded-xl font-bold transition ${
                    mode === 'table' ? 'bg-primary text-text-light' : 'bg-white text-text-dark border'
                  }`}
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

        {/* Division Jump Links */}
        <div className="flex flex-wrap gap-4 mb-12">
          {visibleDivisions.map((div) => {
            const runners = getRunnersInDivision(div);
            const topCount = Math.min(topPlaces, runners.length);
            const announcedCount = awardsState[div]?.announced?.size || 0;
            const isComplete = announcedCount >= topCount;
            const onCourse = onCourseInDivision(div);

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
        {mode === 'announcer' &&
          visibleDivisions.map((div) => {
            const top = getRunnersInDivision(div).slice(0, topPlaces);
            const announcedSet = awardsState[div]?.announced || new Set();
            const onCourse = onCourseInDivision(div);

            return (
              <div
                key={div}
                id={`division-${div.replace(/\s+/g, '-')}`}
                className="mb-16 scroll-mt-24"
              >
                <h2 className="text-3xl font-bold text-text-dark mb-6">
                  {div}
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
                        className={`bg-white rounded-2xl shadow-xl p-8 ${announcedSet.has(r.entry_id) ? 'opacity-60' : ''}`}
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="text-5xl font-black text-primary">
                              #{div.includes('Overall') ? r.place : r.age_group_place || i + 1}
                            </p>
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
                            className={`px-12 py-6 rounded-full text-2xl font-bold ${
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

        {/* Table Mode */}
        {mode === 'table' && (
          <div>
            <h2 className="text-3xl font-bold text-text-dark mb-6">Awards Pickup Table</h2>
            <div className="overflow-x-auto bg-white rounded-2xl shadow-2xl">
              <table className="w-full">
                <thead className="bg-text-dark text-text-light">
                  <tr>
                    <th className="px-8 py-6 text-left">Division</th>
                    <th className="px-8 py-6 text-left">Division Place</th>
                    <th className="px-8 py-6 text-left">Name</th>
                    <th className="px-8 py-6 text-left">Time</th>
                    <th className="px-8 py-6 text-left">City, State</th>
                    <th className="px-8 py-6 text-center">Picked Up</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {visibleDivisions.map((div) => {
                    const runners = getRunnersInDivision(div);

                    return runners.length > 0
                      ? runners.map((r) => (
                          <tr key={r.entry_id} className="hover:bg-bg-light transition">
                            <td className="px-8 py-6 font-medium">{div}</td>
                            <td className="px-8 py-6 font-bold text-xl text-primary">
                              {div.includes('Overall') ? r.place || '-' : r.age_group_place || '-'}
                            </td>
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
                      : null;
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </DirectorLayout>
  );
}