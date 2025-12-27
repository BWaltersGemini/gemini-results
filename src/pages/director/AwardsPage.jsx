// src/pages/director/AwardsPage.jsx
// FINAL — Dual award support with separate Overall & AG pickup tracking
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DirectorLayout from './DirectorLayout';
import { useDirector } from '../../context/DirectorContext';
import { supabase } from '../../supabaseClient';
import { fetchParticipantContactDetails } from '../../api/director/rd_chronotrackapi';

export default function AwardsPage() {
  const navigate = useNavigate();
  const { selectedEventId, currentUser, loading: directorLoading, isSuperAdmin } = useDirector();

  const [finishers, setFinishers] = useState([]);
  const [announcedState, setAnnouncedState] = useState({});
  const [pickupStatus, setPickupStatus] = useState({}); // { entry_id: { picked_up: bool, is_overall_winner: bool, overall_picked_up: bool } }
  const [eventName, setEventName] = useState('Awards');
  const [loading, setLoading] = useState(true);
  const [overallPlaces, setOverallPlaces] = useState(1);
  const [ageGroupPlaces, setAgeGroupPlaces] = useState(3);
  const [mode, setMode] = useState('announcer');
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedAnnouncer, setCopiedAnnouncer] = useState(false);
  const [copiedTable, setCopiedTable] = useState(false);

  const [saveToast, setSaveToast] = useState(null);

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

  // Load event name
  useEffect(() => {
    const fetchEventName = async () => {
      const { data } = await supabase
        .from('chronotrack_events')
        .select('name')
        .eq('id', selectedEventId)
        .single();
      if (data?.name) setEventName(data.name);
    };
    fetchEventName();
  }, [selectedEventId]);

  // Load results
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
      .channel(`director-awards-results-${selectedEventId}`)
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
            const index = prev.findIndex((r) => r.entry_id === payload.new?.entry_id || r.entry_id === payload.old?.entry_id);
            if (payload.eventType === 'DELETE') {
              return prev.filter((r) => r.entry_id !== payload.old.entry_id);
            }
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

  // Load director announced marks
  useEffect(() => {
    if (!currentUser) return;
    const loadAnnounced = async () => {
      const { data } = await supabase
        .from('director_awards_state')
        .select('division, entry_id')
        .eq('event_id', selectedEventId)
        .eq('user_id', currentUser.id)
        .eq('announced', true);

      const state = {};
      data?.forEach((row) => {
        if (!state[row.division]) state[row.division] = new Set();
        state[row.division].add(row.entry_id);
      });
      setAnnouncedState(state);
    };
    loadAnnounced();
  }, [selectedEventId, currentUser]);

  // Load pickup status with new columns
  useEffect(() => {
    const loadPickup = async () => {
      const { data } = await supabase
        .from('awards_pickup_status')
        .select('entry_id, picked_up, is_overall_winner, overall_picked_up')
        .eq('event_id', selectedEventId);

      const map = {};
      data?.forEach((row) => {
        map[row.entry_id] = {
          picked_up: row.picked_up || false,
          is_overall_winner: row.is_overall_winner || false,
          overall_picked_up: row.overall_picked_up || false,
        };
      });
      setPickupStatus(map);
    };
    loadPickup();

    const channel = supabase
      .channel(`director-awards-pickup-${selectedEventId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'awards_pickup_status',
          filter: `event_id=eq.${selectedEventId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            setPickupStatus((prev) => ({
              ...prev,
              [payload.new.entry_id]: {
                picked_up: payload.new.picked_up || false,
                is_overall_winner: payload.new.is_overall_winner || false,
                overall_picked_up: payload.new.overall_picked_up || false,
              },
            }));
          }
          if (payload.eventType === 'DELETE') {
            setPickupStatus((prev) => {
              const next = { ...prev };
              delete next[payload.old.entry_id];
              return next;
            });
          }
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [selectedEventId]);

  // Auto-save places
  useEffect(() => {
    if (!selectedEventId) return;

    const savePlaces = async () => {
      try {
        const { error } = await supabase
          .from('event_results_visibility')
          .upsert(
            {
              event_id: selectedEventId,
              overall_places: overallPlaces,
              age_group_places: ageGroupPlaces,
            },
            { onConflict: 'event_id' }
          );

        if (error) {
          setSaveToast({ message: 'Failed to save award settings', error: true });
        } else {
          const message =
            overallPlaces === 0
              ? `Saved: No overall awards, Top ${ageGroupPlaces} per age group`
              : `Saved: Top ${overallPlaces} overall, Top ${ageGroupPlaces} per age group`;
          setSaveToast({ message });
        }
        setTimeout(() => setSaveToast(null), 4000);
      } catch (err) {
        setSaveToast({ message: 'Save failed', error: true });
        setTimeout(() => setSaveToast(null), 4000);
      }
    };

    const timeoutId = setTimeout(savePlaces, 500);
    return () => clearTimeout(timeoutId);
  }, [selectedEventId, overallPlaces, ageGroupPlaces]);

  // Superadmin visibility
  useEffect(() => {
    if (!isSuperAdmin || !selectedEventId) {
      setLoadingVisibility(false);
      return;
    }
    const load = async () => {
      setLoadingVisibility(true);
      try {
        const { data: vis } = await supabase
          .from('event_results_visibility')
          .select('event_visible, race_visibility')
          .eq('event_id', selectedEventId)
          .single();

        setVisibilitySettings({
          event_visible: vis?.event_visible ?? true,
          race_visibility: vis?.race_visibility || {},
        });

        const { data: results } = await supabase
          .from('chronotrack_results')
          .select('race_name')
          .eq('event_id', selectedEventId);

        const unique = [...new Set(results?.map((r) => r.race_name).filter(Boolean))];
        setRaces(unique);
      } catch (err) {
        console.warn('Failed to load visibility/races:', err);
        setVisibilitySettings({ event_visible: true, race_visibility: {} });
        setRaces([]);
      } finally {
        setLoadingVisibility(false);
      }
    };
    load();
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
      alert('Failed to update visibility.');
    }
  };

  const saveAnnounced = async (division, entryId) => {
    const current = announcedState[division]?.has(entryId) || false;

    await supabase
      .from('director_awards_state')
      .upsert(
        {
          event_id: selectedEventId,
          user_id: currentUser.id,
          division,
          entry_id: entryId,
          announced: !current,
        },
        { onConflict: 'event_id,user_id,division,entry_id' }
      );

    setAnnouncedState((prev) => {
      const divSet = new Set(prev[division] || []);
      if (!current) divSet.add(entryId);
      else divSet.delete(entryId);
      return { ...prev, [division]: divSet };
    });
  };

  // Toggle Age Group pickup
  const toggleAGPickup = async (entryId) => {
    const current = pickupStatus[entryId]?.picked_up || false;
    const newStatus = !current;

    const { error } = await supabase
      .from('awards_pickup_status')
      .upsert(
        {
          event_id: selectedEventId,
          entry_id: entryId,
          picked_up: newStatus,
        },
        { onConflict: 'event_id,entry_id' }
      );

    if (!error) {
      setPickupStatus((prev) => ({
        ...prev,
        [entryId]: { ...prev[entryId], picked_up: newStatus },
      }));
    }
  };

  // Toggle Overall pickup
  const toggleOverallPickup = async (entryId) => {
    const current = pickupStatus[entryId]?.overall_picked_up || false;
    const newStatus = !current;

    const { error } = await supabase
      .from('awards_pickup_status')
      .upsert(
        {
          event_id: selectedEventId,
          entry_id: entryId,
          overall_picked_up: newStatus,
        },
        { onConflict: 'event_id,entry_id' }
      );

    if (!error) {
      setPickupStatus((prev) => ({
        ...prev,
        [entryId]: { ...prev[entryId], overall_picked_up: newStatus },
      }));
    }
  };

  // Mark runner as overall winner (used when settings change)
  const markAsOverallWinner = async (entryId) => {
    await supabase
      .from('awards_pickup_status')
      .upsert(
        {
          event_id: selectedEventId,
          entry_id: entryId,
          is_overall_winner: true,
        },
        { onConflict: 'event_id,entry_id' }
      );
  };

  // Auto-mark overall winners when places change
  useEffect(() => {
    const markOverallWinners = async () => {
      const maleOverall = getRunnersInDivision('Male Overall');
      const femaleOverall = getRunnersInDivision('Female Overall');
      const overallEntryIds = [...maleOverall, ...femaleOverall].map(r => r.entry_id);

      if (overallEntryIds.length > 0) {
        await Promise.all(overallEntryIds.map(id => markAsOverallWinner(id)));
      }
    };

    if (!loading) {
      markOverallWinners();
    }
  }, [overallPlaces, finishers, loading]);

  // SMART EXPORT with dual award support
  const exportAwardsCSV = async () => {
    const currentDivisions = getDivisions();
    const currentWinners = new Set();

    currentDivisions.forEach((div) => {
      const runners = getRunnersInDivision(div);
      runners.forEach((runner) => {
        currentWinners.add(runner.entry_id);
      });
    });

    const { data: historicalPickedUp } = await supabase
      .from('awards_pickup_status')
      .select('entry_id')
      .eq('event_id', selectedEventId)
      .or('picked_up.eq.true,overall_picked_up.eq.true');

    const historicalIds = new Set(historicalPickedUp?.map(row => row.entry_id) || []);

    const allToInclude = new Set([...currentWinners, ...historicalIds]);

    if (allToInclude.size === 0) {
      alert('No award winners or picked-up awards to export.');
      return;
    }

    const contactDetails = await fetchParticipantContactDetails(selectedEventId, Array.from(allToInclude));

    const entryIdToRunner = {};
    finishers.forEach((r) => {
      entryIdToRunner[r.entry_id] = r;
    });

    const rows = [];

    currentDivisions.forEach((div) => {
      const runners = getRunnersInDivision(div);
      runners.forEach((runner) => {
        if (allToInclude.has(runner.entry_id)) {
          const details = contactDetails.get(runner.entry_id) || {};
          const status = pickupStatus[runner.entry_id] || {};
          const place = div.includes('Overall') ? runner.gender_place : runner.age_group_place;

          rows.push({
            Division: div,
            Place: place || '',
            Bib: runner.bib || '',
            Name: `${runner.first_name || ''} ${runner.last_name || ''}`.trim(),
            Race: runner.race_name || '',
            Time: runner.chip_time || '',
            City: details.city || '',
            State: details.state || '',
            ZIP: details.zip || '',
            Country: details.country || '',
            Email: details.email || '',
            'Mailing Address': [details.street, details.street2, details.city, details.state, details.zip]
              .filter(Boolean)
              .join(', ') || '',
            Phone: details.phone || '',
            'Age Group Picked Up': status.picked_up ? 'Yes' : 'No',
            'Overall Picked Up': status.overall_picked_up ? 'Yes' : 'No',
            Status: 'Current Winner',
          });
        }
      });
    });

    historicalIds.forEach((entryId) => {
      if (!currentWinners.has(entryId)) {
        const runner = entryIdToRunner[entryId];
        if (runner) {
          const details = contactDetails.get(entryId) || {};
          const status = pickupStatus[entryId] || {};
          rows.push({
            Division: 'Previous Winner',
            Place: '',
            Bib: runner.bib || '',
            Name: `${runner.first_name || ''} ${runner.last_name || ''}`.trim(),
            Race: runner.race_name || '',
            Time: runner.chip_time || '',
            City: details.city || '',
            State: details.state || '',
            ZIP: details.zip || '',
            Country: details.country || '',
            Email: details.email || '',
            'Mailing Address': [details.street, details.street2, details.city, details.state, details.zip]
              .filter(Boolean)
              .join(', ') || '',
            Phone: details.phone || '',
            'Age Group Picked Up': status.picked_up ? 'Yes' : 'No',
            'Overall Picked Up': status.overall_picked_up ? 'Yes' : 'No',
            Status: 'Previously Picked Up (No Longer in Awards)',
          });
        }
      });
    });

    rows.sort((a, b) => (a.Status.includes('Current') ? -1 : 1));

    const headers = [
      'Division',
      'Place',
      'Bib',
      'Name',
      'Race',
      'Time',
      'City',
      'State',
      'ZIP',
      'Country',
      'Email',
      'Mailing Address',
      'Phone',
      'Age Group Picked Up',
      'Overall Picked Up',
      'Status'
    ];

    const csvContent = [
      headers.join(','),
      ...rows.map((row) =>
        headers
          .map((h) => `"${(row[h] || '').toString().replace(/"/g, '""')}"`)
          .join(',')
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    const safeEventName = eventName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const dateStr = new Date().toISOString().slice(0, 10);
    link.setAttribute('download', `Awards_Pickup_Report_${safeEventName}_${dateStr}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Divisions logic
  const getDivisions = () => {
    const ageGroups = [...new Set(finishers.map((r) => r.age_group_name).filter(Boolean))];
    const sorted = ageGroups
      .filter((g) => g !== 'Overall')
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
        .filter((r) => r.gender === 'M' && r.gender_place !== null)
        .sort((a, b) => (a.gender_place || Infinity) - (b.gender_place || Infinity))
        .slice(0, places);
    }
    if (div === 'Female Overall') {
      return finishers
        .filter((r) => r.gender === 'F' && r.gender_place !== null)
        .sort((a, b) => (a.gender_place || Infinity) - (b.gender_place || Infinity))
        .slice(0, places);
    }

    return finishers
      .filter((r) => r.age_group_name === div)
      .sort((a, b) => (a.age_group_place || Infinity) - (b.age_group_place || Infinity))
      .slice(0, places);
  };

  const onCourseInDivision = (div) => {
    const allInDiv = div.includes('Overall')
      ? finishers.filter((r) => (div === 'Male Overall' ? r.gender === 'M' : r.gender === 'F'))
      : finishers.filter((r) => r.age_group_name === div);
    return allInDiv.filter((r) => !r.chip_time || r.chip_time.trim() === '').length;
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
      <div className="max-w-7xl mx-auto relative">
        <h1 className="text-4xl font-bold text-text-dark mb-8">Awards Management</h1>

        {saveToast && (
          <div
            className={`fixed bottom-8 right-8 px-8 py-5 rounded-2xl shadow-2xl text-white font-bold text-lg z-50 transition-all duration-500 ${
              saveToast.error ? 'bg-red-600' : 'bg-green-600'
            }`}
          >
            {saveToast.error ? '⚠️ ' : '✓ '} {saveToast.message}
          </div>
        )}

        {/* Superadmin Visibility Panel */}
        {isSuperAdmin && (
          <div className="bg-yellow-50 border-2 border-yellow-400 rounded-2xl p-8 mb-12">
            <h2 className="text-3xl font-bold text-brand-dark mb-6">
              🔐 Superadmin: Awards Visibility Control
            </h2>
            <p className="text-lg text-gray-700 mb-6">
              Hide awards from public views until ready.
            </p>
            {loadingVisibility ? (
              <p>Loading settings...</p>
            ) : (
              <div className="space-y-6">
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
                {races.length > 0 && (
                  <div className="bg-white rounded-xl p-6 shadow">
                    <p className="text-sm font-medium text-gray-600 mb-4">Per-Race Visibility</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {races.map((race) => {
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
                <input
                  type="text"
                  value={announcerUrl}
                  readOnly
                  className="flex-1 p-4 border border-gray-300 rounded-xl bg-gray-50"
                />
                <button
                  onClick={() => handleCopy(announcerUrl, 'announcer')}
                  className="bg-primary text-text-light px-8 py-4 rounded-xl font-bold hover:bg-primary/90"
                >
                  {copiedAnnouncer ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <a
                href={announcerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-center bg-red-600 text-white py-4 rounded-xl font-bold hover:bg-red-700"
              >
                Open Announcer View
              </a>
            </div>
            <div className="bg-white rounded-2xl shadow-xl p-8">
              <h3 className="text-2xl font-bold text-primary mb-4">Awards Table View</h3>
              <p className="text-text-muted mb-6">Table for volunteer pickup tracking.</p>
              <div className="flex gap-4 mb-4">
                <input
                  type="text"
                  value={tableUrl}
                  readOnly
                  className="flex-1 p-4 border border-gray-300 rounded-xl bg-gray-50"
                />
                <button
                  onClick={() => handleCopy(tableUrl, 'table')}
                  className="bg-primary text-text-light px-8 py-4 rounded-xl font-bold hover:bg-primary/90"
                >
                  {copiedTable ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <a
                href={tableUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-center bg-red-600 text-white py-4 rounded-xl font-bold hover:bg-red-700"
              >
                Open Table View
              </a>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-12">
          <div className="grid md:grid-cols-3 gap-6 mb-8 items-end">
            <div>
              <label className="block text-text-dark font-semibold mb-2">Overall Awards (M/F)</label>
              <select
                value={overallPlaces}
                onChange={(e) => setOverallPlaces(Number(e.target.value))}
                className="w-full p-4 border border-gray-300 rounded-xl focus:ring-4 focus:ring-accent/30"
              >
                <option value={0}>None</option>
                {placeOptions.map((n) => (
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
                {placeOptions.map((n) => (
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

          {/* Export Button */}
          <div className="mb-8 text-center">
            <button
              onClick={exportAwardsCSV}
              className="inline-flex items-center gap-3 px-10 py-5 bg-green-600 text-white text-xl font-bold rounded-full hover:bg-green-700 transition shadow-xl"
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export Awards Pickup Report (CSV)
            </button>
            <p className="text-sm text-gray-600 mt-3">
              Includes email, full address, and separate Overall/AG pickup status
            </p>
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
            const announcedCount = announcedState[div]?.size || 0;
            const onCourse = onCourseInDivision(div);
            const isComplete = announcedCount >= topCount;
            return (
              <a
                key={div}
                href={`#division-${div.replace(/\s+/g, '-')}`}
                className={`px-6 py-4 rounded-full font-bold transition ${
                  isComplete ? 'bg-gray-500 text-white' : 'bg-primary text-text-light hover:bg-primary/90'
                }`}
              >
                {div} ({announcedCount}/{topCount})
                {onCourse > 0 && <span className="ml-3 text-yellow-300">+{onCourse} on course</span>}
              </a>
            );
          })}
        </div>

        {/* Announcer Mode */}
        {mode === 'announcer' &&
          visibleDivisions.map((div) => {
            const runners = getRunnersInDivision(div);
            const announcedSet = announcedState[div] || new Set();
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
                    <p className="text-center text-2xl text-gray-500">
                      No finishers in this division yet
                    </p>
                  ) : (
                    runners.map((r, i) => {
                      const place = div.includes('Overall') ? r.gender_place : r.age_group_place || i + 1;
                      const raceName = r.race_name || '';
                      const status = pickupStatus[r.entry_id] || {};
                      const isDual = status.is_overall_winner;

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
                          {raceName && <p className="text-3xl text-accent mb-4">{raceName}</p>}
                          <p className="text-4xl text-gray-700 mb-6">{r.chip_time || '—'}</p>
                          <p className="text-2xl text-gray-600">
                            {r.city && `${r.city}, `}
                            {r.state}
                          </p>
                          {isDual && (
                            <p className="text-xl font-bold text-purple-600 mt-4">
                              ⭐ Dual Winner (Overall + Age Group)
                            </p>
                          )}
                          <button
                            onClick={() => saveAnnounced(div, r.entry_id)}
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

        {/* Table Mode — now with dual checkboxes */}
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
                    <th className="px-8 py-6 text-center">Age Group Picked Up</th>
                    <th className="px-8 py-6 text-center">Overall Picked Up</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {visibleDivisions.flatMap((div) => {
                    const runners = getRunnersInDivision(div);
                    return runners.length > 0
                      ? runners.map((r) => {
                          const place = div.includes('Overall') ? r.gender_place : r.age_group_place || '-';
                          const status = pickupStatus[r.entry_id] || {};
                          const isOverall = div.includes('Overall');
                          const showOverallCheckbox = status.is_overall_winner || isOverall;

                          return (
                            <tr key={`${r.entry_id}-${div}`} className="hover:bg-bg-light transition">
                              <td className="px-8 py-6 font-medium">
                                {div}
                                {status.is_overall_winner && !isOverall && (
                                  <span className="block text-sm font-bold text-purple-600">Dual Winner</span>
                                )}
                              </td>
                              <td className="px-8 py-6 font-bold text-xl text-primary">#{place}</td>
                              <td className="px-8 py-6 font-semibold">
                                {r.first_name} {r.last_name}
                              </td>
                              <td className="px-8 py-6 text-accent font-medium">{r.race_name || '-'}</td>
                              <td className="px-8 py-6">{r.chip_time || '-'}</td>
                              <td className="px-8 py-6">
                                {r.city && `${r.city}, `}
                                {r.state}
                              </td>
                              <td className="px-8 py-6 text-center">
                                <input
                                  type="checkbox"
                                  checked={status.picked_up || false}
                                  onChange={() => toggleAGPickup(r.entry_id)}
                                  className="h-8 w-8 text-primary rounded focus:ring-primary"
                                />
                              </td>
                              <td className="px-8 py-6 text-center">
                                {showOverallCheckbox ? (
                                  <input
                                    type="checkbox"
                                    checked={status.overall_picked_up || false}
                                    onChange={() => toggleOverallPickup(r.entry_id)}
                                    className="h-8 w-8 text-purple-600 rounded focus:ring-purple-500"
                                  />
                                ) : (
                                  <span className="text-gray-400">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      : [];
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