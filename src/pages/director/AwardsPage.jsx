// src/pages/director/AwardsPage.jsx
// FINAL — Separate Overall (1 or 3) and Age Group (3/5/10) award controls
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DirectorLayout from './DirectorLayout';
import { useDirector } from '../../context/DirectorContext';
import { supabase } from '../../supabaseClient';

export default function AwardsPage() {
  const navigate = useNavigate();
  const { selectedEventId, currentUser, loading: directorLoading } = useDirector();

  const [finishers, setFinishers] = useState([]);
  const [awardsState, setAwardsState] = useState({});
  const [loading, setLoading] = useState(true);
  const [overallPlaces, setOverallPlaces] = useState(1); // 0 = none, 1 = 1st, 3 = top 3
  const [ageGroupPlaces, setAgeGroupPlaces] = useState(3); // 3, 5, or 10
  const [mode, setMode] = useState('announcer');
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedAnnouncer, setCopiedAnnouncer] = useState(false);
  const [copiedTable, setCopiedTable] = useState(false);

  // Auth guard
  if (currentUser === undefined || directorLoading) {
    return (
      <DirectorLayout>
        <div className="flex items-center justify-center min-h-[70vh]">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-16 w-16 border-t-4 border-primary mb-8"></div>
            <p className="text-2xl text-brand-dark">Loading awards...</p>
          </div>
        </div>
      </DirectorLayout>
    );
  }

  if (currentUser === null || !selectedEventId) {
    navigate('/race-directors-hub');
    return null;
  }

  // Load live results
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
        {
          event: '*',
          schema: 'public',
          table: 'chronotrack_results',
          filter: `event_id=eq.${selectedEventId}`,
        },
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

  // Load awards state
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

  // Division ordering
  const getDivisions = () => {
    const ageGroups = [...new Set(finishers.map(r => r.age_group_name).filter(Boolean))];
    const sorted = ageGroups
      .filter(g => g !== 'Overall')
      .sort((a, b) => {
        const ageA = parseInt(a.match(/\d+/)?.[0] || 99);
        const ageB = parseInt(b.match(/\d+/)?.[0] || 99);
        return ageA - ageB;
      });

    const divisions = [];
    if (overallPlaces > 0) {
      divisions.push('Male Overall', 'Female Overall');
    }
    divisions.push(...sorted);
    return divisions;
  };

  const divisions = getDivisions();

  const getRunnersInDivision = (div) => {
    if (div === 'Male Overall') {
      return finishers
        .filter(r => r.gender === 'M')
        .sort((a, b) => (a.place || Infinity) - (b.place || Infinity))
        .slice(0, overallPlaces);
    }
    if (div === 'Female Overall') {
      return finishers
        .filter(r => r.gender === 'F')
        .sort((a, b) => (a.place || Infinity) - (b.place || Infinity))
        .slice(0, overallPlaces);
    }
    return finishers
      .filter(r => r.age_group_name === div)
      .sort((a, b) => (a.age_group_place || Infinity) - (b.age_group_place || Infinity))
      .slice(0, ageGroupPlaces);
  };

  const onCourseInDivision = (div) => {
    const allInDiv = div.includes('Overall')
      ? finishers.filter(r => (div === 'Male Overall' ? r.gender === 'M' : r.gender === 'F'))
      : finishers.filter(r => r.age_group_name === div);
    return allInDiv.filter(r => !r.chip_time || r.chip_time.trim() === '').length;
  };

  const visibleDivisions = divisions.filter((div) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    const runners = getRunnersInDivision(div);
    return runners.some(r =>
      `${r.first_name} ${r.last_name}`.toLowerCase().includes(term) ||
      r.city?.toLowerCase().includes(term) ||
      r.state?.toLowerCase().includes(term)
    );
  });

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

        {/* Share Links */}
        <div className="bg-accent/20 rounded-2xl p-8 mb-12">
          <h2 className="text-3xl font-bold text-text-dark mb-8">Share Live Awards Views</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white rounded-2xl shadow-xl p-8">
              <h3 className="text-2xl font-bold text-primary mb-4">Announcer View</h3>
              <p className="text-text-muted mb-6">Large cards — perfect for reading during ceremony.</p>
              <div className="flex gap-4 mb-4">
                <input type="text" value={announcerUrl} readOnly className="flex-1 p-4 border border-gray-300 rounded-xl bg-gray-50" />
                <button onClick={() => handleCopy(announcerUrl, 'announcer')} className="bg-primary text-text-light px-8 py-4 rounded-xl font-bold hover:bg-primary/90">
                  {copiedAnnouncer ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <a href={announcerUrl} target="_blank" rel="noopener noreferrer" className="block text-center bg-red-600 text-white py-4 rounded-xl font-bold hover:bg-red-700">
                Open Announcer View
              </a>
            </div>
            <div className="bg-white rounded-2xl shadow-xl p-8">
              <h3 className="text-2xl font-bold text-primary mb-4">Awards Table View</h3>
              <p className="text-text-muted mb-6">Full table for pickup tracking.</p>
              <div className="flex gap-4 mb-4">
                <input type="text" value={tableUrl} readOnly className="flex-1 p-4 border border-gray-300 rounded-xl bg-gray-50" />
                <button onClick={() => handleCopy(tableUrl, 'table')} className="bg-primary text-text-light px-8 py-4 rounded-xl font-bold hover:bg-primary/90">
                  {copiedTable ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <a href={tableUrl} target="_blank" rel="noopener noreferrer" className="block text-center bg-red-600 text-white py-4 rounded-xl font-bold hover:bg-red-700">
                Open Table View
              </a>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-12">
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            {/* Overall Awards */}
            <div>
              <label className="block text-text-dark font-semibold mb-2">Overall Awards</label>
              <select
                value={overallPlaces}
                onChange={(e) => setOverallPlaces(Number(e.target.value))}
                className="w-full p-4 border border-gray-300 rounded-xl focus:ring-4 focus:ring-accent/30"
              >
                <option value={0}>None</option>
                <option value={1}>1st Place Only</option>
                <option value={3}>Top 3</option>
              </select>
            </div>

            {/* Age Group Awards */}
            <div>
              <label className="block text-text-dark font-semibold mb-2">Age Group Awards</label>
              <select
                value={ageGroupPlaces}
                onChange={(e) => setAgeGroupPlaces(Number(e.target.value))}
                className="w-full p-4 border border-gray-300 rounded-xl focus:ring-4 focus:ring-accent/30"
              >
                <option value={3}>Top 3</option>
                <option value={5}>Top 5</option>
                <option value={10}>Top 10</option>
              </select>
            </div>

            {/* View Mode */}
            <div>
              <label className="block text-text-dark font-semibold mb-2">View Mode</label>
              <div className="flex gap-4">
                <button
                  onClick={() => setMode('announcer')}
                  className={`flex-1 py-4 rounded-xl font-bold transition ${
                    mode === 'announcer' ? 'bg-primary text-text-light' : 'bg-gray-200 text-text-dark'
                  }`}
                >
                  Announcer
                </button>
                <button
                  onClick={() => setMode('table')}
                  className={`flex-1 py-4 rounded-xl font-bold transition ${
                    mode === 'table' ? 'bg-primary text-text-light' : 'bg-gray-200 text-text-dark'
                  }`}
                >
                  Table
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

        {/* Jump Links */}
        <div className="flex flex-wrap justify-center gap-4 mb-12">
          {divisions.map((div) => {
            const runners = getRunnersInDivision(div);
            const maxPlaces = div.includes('Overall') ? overallPlaces : ageGroupPlaces;
            const topCount = Math.min(maxPlaces, runners.length);
            const announcedCount = awardsState[div]?.announced?.size || 0;
            const onCourse = onCourseInDivision(div);
            const isComplete = announcedCount >= topCount;

            return (
              <a
                key={div}
                href={`#division-${div.replace(/\s+/g, '-')}`}
                className={`px-6 py-4 rounded-full font-bold transition ${
                  isComplete
                    ? 'bg-gray-500 text-white'
                    : 'bg-primary text-text-light hover:bg-primary/90'
                }`}
              >
                {div} ({announcedCount}/{topCount})
                {onCourse > 0 && <span className="ml-3 text-yellow-300">+{onCourse} on course</span>}
              </a>
            );
          })}
        </div>

        {/* Announcer Mode */}
        {mode === 'announcer' && visibleDivisions.map((div) => {
          const runners = getRunnersInDivision(div);
          const announcedSet = awardsState[div]?.announced || new Set();
          const onCourse = onCourseInDivision(div);

          return (
            <div
              key={div}
              id={`division-${div.replace(/\s+/g, '-')}`}
              className="mb-20 scroll-mt-32"
            >
              <h2 className="text-4xl font-bold text-center text-text-dark mb-8">
                {div}
                {onCourse > 0 && (
                  <p className="text-2xl text-orange-600 mt-4">{onCourse} still on course</p>
                )}
              </h2>

              <div className="space-y-12">
                {runners.length === 0 ? (
                  <p className="text-center text-2xl text-gray-500">No finishers in this division yet</p>
                ) : (
                  runners.map((r, i) => {
                    const place = div.includes('Overall') ? r.place : r.age_group_place || i + 1;
                    const raceName = r.race_name || '';

                    return (
                      <div
                        key={r.entry_id}
                        className={`bg-white rounded-3xl shadow-2xl p-12 text-center max-w-3xl mx-auto transition-all ${
                          announcedSet.has(r.entry_id) ? 'opacity-60' : ''
                        }`}
                      >
                        <p className="text-8xl font-black text-primary mb-6">#{place}</p>
                        <h3 className="text-5xl font-bold text-text-dark mb-4">
                          {r.first_name} {r.last_name}
                        </h3>
                        {raceName && (
                          <p className="text-3xl text-accent mb-4">{raceName}</p>
                        )}
                        <p className="text-4xl text-gray-700 mb-6">{r.chip_time || '—'}</p>
                        <p className="text-2xl text-gray-600">
                          {r.city && `${r.city}, `}{r.state}
                        </p>
                        <button
                          onClick={() => saveState(div, r.entry_id, 'announced')}
                          className={`mt-8 px-16 py-6 rounded-full text-3xl font-bold transition ${
                            announcedSet.has(r.entry_id)
                              ? 'bg-gray-500 text-white'
                              : 'bg-primary text-text-light hover:bg-primary/90'
                          }`}
                        >
                          {announcedSet.has(r.entry_id) ? 'Announced ✓' : 'Mark Announced'}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}

        {/* Table Mode */}
        {mode === 'table' && (
          <div>
            <h2 className="text-3xl font-bold text-text-dark mb-8">Awards Pickup Table</h2>
            <div className="overflow-x-auto bg-white rounded-2xl shadow-2xl">
              <table className="w-full min-w-max">
                <thead className="bg-text-dark text-text-light">
                  <tr>
                    <th className="px-8 py-6 text-left">Division</th>
                    <th className="px-8 py-6 text-left">Place</th>
                    <th className="px-8 py-6 text-left">Name</th>
                    <th className="px-8 py-6 text-left">Race</th>
                    <th className="px-8 py-6 text-left">Time</th>
                    <th className="px-8 py-6 text-left">Location</th>
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
                            <td className="px-8 py-6 text-accent font-medium">{r.race_name || '-'}</td>
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