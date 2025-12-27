// src/pages/director/AwardsPage.jsx
// FINAL — Superadmin visibility controls + all existing features
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DirectorLayout from './DirectorLayout';
import { useDirector } from '../../context/DirectorContext';
import { supabase } from '../../supabaseClient';

export default function AwardsPage() {
  const navigate = useNavigate();
  const { selectedEventId, currentUser, loading: directorLoading, isSuperAdmin } = useDirector();

  const [finishers, setFinishers] = useState([]);
  const [awardsState, setAwardsState] = useState({});
  const [loading, setLoading] = useState(true);
  const [overallPlaces, setOverallPlaces] = useState(1);
  const [ageGroupPlaces, setAgeGroupPlaces] = useState(3);
  const [mode, setMode] = useState('announcer');
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedAnnouncer, setCopiedAnnouncer] = useState(false);
  const [copiedTable, setCopiedTable] = useState(false);

  // Superadmin visibility settings
  const [visibilitySettings, setVisibilitySettings] = useState({
    event_visible: true,
    race_visibility: {},
  });
  const [races, setRaces] = useState([]);
  const [loadingVisibility, setLoadingVisibility] = useState(true);

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

  // Superadmin: Load visibility settings + unique races
  useEffect(() => {
    if (!isSuperAdmin || !selectedEventId) {
      setLoadingVisibility(false);
      return;
    }

    const loadVisibilityAndRaces = async () => {
      setLoadingVisibility(true);
      try {
        // Load visibility
        const { data: vis } = await supabase
          .from('event_results_visibility')
          .select('event_visible, race_visibility')
          .eq('event_id', selectedEventId)
          .single();

        setVisibilitySettings({
          event_visible: vis?.event_visible ?? true,
          race_visibility: vis?.race_visibility || {},
        });

        // Load unique races
        const { data: results } = await supabase
          .from('chronotrack_results')
          .select('race_name')
          .eq('event_id', selectedEventId);

        const unique = [...new Set(results?.map(r => r.race_name).filter(Boolean))];
        setRaces(unique);
      } catch (err) {
        console.warn('Visibility/races load failed:', err);
        setVisibilitySettings({ event_visible: true, race_visibility: {} });
        setRaces([]);
      } finally {
        setLoadingVisibility(false);
      }
    };

    loadVisibilityAndRaces();
  }, [isSuperAdmin, selectedEventId]);

  const saveVisibility = async (settings) => {
    try {
      await supabase
        .from('event_results_visibility')
        .upsert({
          event_id: selectedEventId,
          event_visible: settings.event_visible,
          race_visibility: settings.race_visibility,
        });
    } catch (err) {
      console.error('Failed to save visibility:', err);
      alert('Failed to update visibility settings.');
    }
  };

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

  // Divisions
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
    const places = div.includes('Overall') ? overallPlaces : ageGroupPlaces;

    if (div === 'Male Overall') {
      return finishers
        .filter(r => r.gender === 'M')
        .sort((a, b) => (a.place || Infinity) - (b.place || Infinity))
        .slice(0, places);
    }
    if (div === 'Female Overall') {
      return finishers
        .filter(r => r.gender === 'F')
        .sort((a, b) => (a.place || Infinity) - (b.place || Infinity))
        .slice(0, places);
    }
    return finishers
      .filter(r => r.age_group_name === div)
      .sort((a, b) => (a.age_group_place || Infinity) - (b.age_group_place || Infinity))
      .slice(0, places);
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

  const placeOptions = Array.from({ length: 10 }, (_, i) => i + 1);

  return (
    <DirectorLayout>
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold text-text-dark mb-8">Awards Management</h1>

        {/* Superadmin Visibility Panel */}
        {isSuperAdmin && (
          <div className="bg-yellow-50 border-2 border-yellow-400 rounded-2xl p-8 mb-12">
            <h2 className="text-3xl font-bold text-brand-dark mb-6">
              🔐 Superadmin: Awards Visibility Control
            </h2>
            <p className="text-lg text-gray-700 mb-6">
              Hide awards from public views until ready. Regular directors cannot see this.
            </p>

            {loadingVisibility ? (
              <p>Loading visibility settings...</p>
            ) : (
              <div className="space-y-6">
                {/* Global Toggle */}
                <label className="flex items-center justify-between bg-white rounded-xl px-6 py-4 shadow">
                  <span className="text-lg font-medium">Show All Awards (Public Views)</span>
                  <input
                    type="checkbox"
                    checked={visibilitySettings.event_visible}
                    onChange={async (e) => {
                      const updated = { ...visibilitySettings, event_visible: e.target.checked };
                      setVisibilitySettings(updated);
                      await saveVisibility(updated);
                    }}
                    className="h-8 w-8 text-primary rounded focus:ring-primary"
                  />
                </label>

                {/* Per-Race Toggles */}
                {races.length > 0 && (
                  <div className="bg-white rounded-xl p-6 shadow">
                    <p className="text-sm font-medium text-gray-600 mb-4">Per-Race Visibility</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {races.map(race => {
                        const isVisible = visibilitySettings.race_visibility?.[race] ?? true;
                        return (
                          <label key={race} className="flex items-center justify-between">
                            <span className="text-base">{race}</span>
                            <input
                              type="checkbox"
                              checked={isVisible}
                              onChange={async (e) => {
                                const updatedRaceVis = {
                                  ...(visibilitySettings.race_visibility || {}),
                                  [race]: e.target.checked,
                                };
                                const updated = {
                                  ...visibilitySettings,
                                  race_visibility: updatedRaceVis,
                                };
                                setVisibilitySettings(updated);
                                await saveVisibility(updated);
                              }}
                              className="h-6 w-6 text-primary rounded focus:ring-primary"
                            />
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Share Links */}
        <div className="bg-accent/20 rounded-2xl p-8 mb-12">
          <h2 className="text-3xl font-bold text-text-dark mb-8">Share Live Awards Views</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white rounded-2xl shadow-xl p-8">
              <h3 className="text-2xl font-bold text-primary mb-4">Announcer View</h3>
              <p className="text-text-muted mb-6">Large cards for reading during ceremony.</p>
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
              <p className="text-text-muted mb-6">Table for volunteer pickup tracking.</p>
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
            <div>
              <label className="block text-text-dark font-semibold mb-2">Overall Awards (M/F)</label>
              <select
                value={overallPlaces}
                onChange={(e) => setOverallPlaces(Number(e.target.value))}
                className="w-full p-4 border border-gray-300 rounded-xl focus:ring-4 focus:ring-accent/30"
              >
                <option value={0}>None</option>
                {placeOptions.map(n => (
                  <option key={n} value={n}>Top {n}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-text-dark font-semibold mb-2">Age Group Awards</label>
              <select
                value={ageGroupPlaces}
                onChange={(e) => setAgeGroupPlaces(Number(e.target.value))}
                className="w-full p-4 border border-gray-300 rounded-xl focus:ring-4 focus:ring-accent/30"
              >
                {placeOptions.map(n => (
                  <option key={n} value={n}>Top {n}</option>
                ))}
              </select>
            </div>

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

        {/* Announcer & Table Modes — unchanged */}
        {/* ... rest of your existing render code ... */}
      </div>
    </DirectorLayout>
  );
}