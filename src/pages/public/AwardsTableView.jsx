// src/pages/public/AwardsTableView.jsx
// FINAL — Dual award support + mobile-optimized UX + correct checkboxes per division
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { formatChronoTime } from '../../utils/timeUtils';

export default function AwardsTableView() {
  const { eventId } = useParams();

  const [finishers, setFinishers] = useState([]);
  const [pickupStatus, setPickupStatus] = useState({});
  const [eventName, setEventName] = useState('Awards Pickup Table');
  const [races, setRaces] = useState([]);
  const [selectedRace, setSelectedRace] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [awardSettings, setAwardSettings] = useState({
    overall_places: 3,
    age_group_places: 3,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!eventId) return;

    let isMounted = true;

    const loadData = async () => {
      setLoading(true);

      const { data: eventData } = await supabase
        .from('chronotrack_events')
        .select('name')
        .eq('id', eventId)
        .single();
      if (isMounted) setEventName(eventData?.name || 'Awards Pickup Table');

      const { data: results } = await supabase
        .from('chronotrack_results')
        .select('*')
        .eq('event_id', eventId)
        .order('place', { ascending: true });

      if (isMounted) {
        setFinishers(results || []);

        const uniqueRaces = [
          'all',
          ...new Set(results?.map((r) => r.race_name).filter(Boolean)),
        ];
        setRaces(uniqueRaces);
        setSelectedRace('all');
      }

      const { data: settings } = await supabase
        .from('event_results_visibility')
        .select('overall_places, age_group_places')
        .eq('event_id', eventId)
        .maybeSingle();

      if (isMounted) {
        setAwardSettings({
          overall_places: settings?.overall_places ?? 3,
          age_group_places: settings?.age_group_places ?? 3,
        });
      }

      const { data: pickupData } = await supabase
        .from('awards_pickup_status')
        .select('entry_id, picked_up, is_overall_winner, overall_picked_up')
        .eq('event_id', eventId);

      if (isMounted && pickupData) {
        const statusMap = {};
        pickupData.forEach((row) => {
          statusMap[row.entry_id] = {
            picked_up: row.picked_up || false,
            is_overall_winner: row.is_overall_winner || false,
            overall_picked_up: row.overall_picked_up || false,
          };
        });
        setPickupStatus(statusMap);
      }

      setLoading(false);
    };

    loadData();

    // Realtime channels
    const resultsChannel = supabase
      .channel(`table-results-${eventId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chronotrack_results',
          filter: `event_id=eq.${eventId}`,
        },
        (payload) => {
          if (!isMounted) return;
          setFinishers((prev) => {
            const index = prev.findIndex((r) => r.entry_id === payload.new?.entry_id);
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

    const settingsChannel = supabase
      .channel(`table-settings-${eventId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'event_results_visibility',
          filter: `event_id=eq.${eventId}`,
        },
        (payload) => {
          if (!isMounted) return;
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            setAwardSettings({
              overall_places: payload.new.overall_places ?? 3,
              age_group_places: payload.new.age_group_places ?? 3,
            });
          }
        }
      )
      .subscribe();

    const pickupChannel = supabase
      .channel(`table-pickup-${eventId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'awards_pickup_status',
          filter: `event_id=eq.${eventId}`,
        },
        (payload) => {
          if (!isMounted) return;
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

    return () => {
      isMounted = false;
      supabase.removeChannel(resultsChannel);
      supabase.removeChannel(settingsChannel);
      supabase.removeChannel(pickupChannel);
    };
  }, [eventId]);

  const toggleAGPickup = async (entryId) => {
    const current = pickupStatus[entryId]?.picked_up || false;
    const newStatus = !current;

    const { error } = await supabase
      .from('awards_pickup_status')
      .upsert(
        {
          event_id: eventId,
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

  const toggleOverallPickup = async (entryId) => {
    const current = pickupStatus[entryId]?.overall_picked_up || false;
    const newStatus = !current;

    const { error } = await supabase
      .from('awards_pickup_status')
      .upsert(
        {
          event_id: eventId,
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

  const filteredFinishers = selectedRace === 'all'
    ? finishers
    : finishers.filter((r) => r.race_name === selectedRace);

  const searchLower = searchTerm.toLowerCase();
  const searchFiltered = searchTerm
    ? filteredFinishers.filter(
        (r) =>
          `${r.first_name} ${r.last_name}`.toLowerCase().includes(searchLower) ||
          r.bib?.toString().includes(searchTerm) ||
          r.city?.toLowerCase().includes(searchLower) ||
          r.state?.toLowerCase().includes(searchLower)
      )
    : filteredFinishers;

  const getDivisions = () => {
    const ageGroups = [
      ...new Set(searchFiltered.map((r) => r.age_group_name).filter(Boolean)),
    ];

    const sorted = ageGroups
      .filter((g) => g !== 'Overall')
      .sort((a, b) => {
        const ageA = parseInt(a.match(/\d+/)?.[0] || 99);
        const ageB = parseInt(b.match(/\d+/)?.[0] || 99);
        return ageA - ageB;
      });

    const divisions = [];
    if (awardSettings.overall_places > 0) {
      divisions.push('Male Overall', 'Female Overall');
    }
    divisions.push(...sorted);
    return divisions;
  };

  const divisions = getDivisions();

  const getRunnersInDivision = (div) => {
    const places = div.includes('Overall')
      ? awardSettings.overall_places
      : awardSettings.age_group_places;

    if (div === 'Male Overall') {
      return searchFiltered
        .filter((r) => r.gender === 'M' && r.gender_place !== null)
        .sort((a, b) => (a.gender_place || Infinity) - (b.gender_place || Infinity))
        .slice(0, places);
    }
    if (div === 'Female Overall') {
      return searchFiltered
        .filter((r) => r.gender === 'F' && r.gender_place !== null)
        .sort((a, b) => (a.gender_place || Infinity) - (b.gender_place || Infinity))
        .slice(0, places);
    }

    return searchFiltered
      .filter((r) => r.age_group_name === div)
      .sort((a, b) => (a.age_group_place || Infinity) - (b.age_group_place || Infinity))
      .slice(0, places);
  };

  const totalAwards = divisions.reduce(
    (sum, div) => sum + getRunnersInDivision(div).length,
    0
  );
  const pickedUpCount = divisions.reduce((sum, div) => {
    const runners = getRunnersInDivision(div);
    return sum + runners.filter((r) => {
      const status = pickupStatus[r.entry_id] || {};
      return div.includes('Overall') ? status.overall_picked_up : status.picked_up;
    }).length;
  }, 0);
  const progress = totalAwards > 0 ? (pickedUpCount / totalAwards) * 100 : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-3xl text-gray-700">Loading pickup table...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Sticky Header */}
      <header className="fixed top-0 left-0 right-0 bg-primary text-white shadow-2xl z-50">
        <div className="px-6 py-6 text-center">
          <h1 className="text-3xl md:text-4xl font-black mb-2">{eventName}</h1>
          <p className="text-xl md:text-2xl font-bold">Awards Pickup</p>
          <div className="mt-4 max-w-md mx-auto">
            <p className="text-lg mb-2">
              {pickedUpCount} / {totalAwards} picked up
            </p>
            <div className="bg-white/30 rounded-full h-10 overflow-hidden">
              <div
                className="bg-green-400 h-full transition-all duration-1000 ease-out rounded-full"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-sm mt-2">{Math.round(progress)}% Complete</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="pt-48 px-4 md:px-6 max-w-5xl mx-auto">
        {/* Filters */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-8">
          <div className="space-y-6">
            {races.length > 1 && (
              <div>
                <label className="block text-lg font-bold text-gray-800 mb-3">Race</label>
                <select
                  value={selectedRace}
                  onChange={(e) => setSelectedRace(e.target.value)}
                  className="w-full px-5 py-4 rounded-xl border-2 border-primary text-lg focus:ring-4 focus:ring-primary/30"
                >
                  <option value="all">All Races</option>
                  {races
                    .filter((r) => r !== 'all')
                    .map((race) => (
                      <option key={race} value={race}>
                        {race}
                      </option>
                    ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-lg font-bold text-gray-800 mb-3">Search</label>
              <input
                type="text"
                placeholder="Name, bib, city..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-5 py-4 rounded-xl border-2 border-primary text-lg focus:ring-4 focus:ring-primary/30"
              />
            </div>
          </div>
        </div>

        {/* Winners List */}
        <div className="space-y-8">
          {divisions.map((div) => {
            const runners = getRunnersInDivision(div);
            if (runners.length === 0) return null;

            const isOverall = div.includes('Overall');

            return (
              <div key={div} className="bg-white rounded-2xl shadow-xl overflow-hidden">
                <div className="bg-primary text-white px-6 py-4">
                  <h2 className="text-2xl font-bold">{div}</h2>
                </div>

                {/* Mobile Cards */}
                <div className="md:hidden divide-y divide-gray-200">
                  {runners.map((r) => {
                    const place = isOverall ? r.gender_place : r.age_group_place;
                    const status = pickupStatus[r.entry_id] || {};
                    const isDual = status.is_overall_winner && !isOverall;

                    return (
                      <div
                        key={r.entry_id}
                        className={`p-6 ${status.picked_up || status.overall_picked_up ? 'bg-green-50' : ''}`}
                      >
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <div className="text-3xl font-black text-primary">#{place || '-'}</div>
                            <div className="text-xl font-bold mt-1">
                              {r.first_name} {r.last_name}
                            </div>
                            <div className="text-sm text-gray-600 mt-1">Bib: {r.bib || '-'}</div>
                            {isDual && (
                              <p className="text-sm font-bold text-purple-600 mt-2">
                                ⭐ Also Overall Winner
                              </p>
                            )}
                          </div>
                          <div className="space-y-4">
                            {!isOverall && (
                              <div className="text-center">
                                <label className="block text-sm font-medium text-gray-700">Age Group</label>
                                <input
                                  type="checkbox"
                                  checked={status.picked_up || false}
                                  onChange={() => toggleAGPickup(r.entry_id)}
                                  className="mt-1 h-8 w-8 text-green-600 rounded focus:ring-green-500"
                                />
                              </div>
                            )}
                            {status.is_overall_winner && (
                              <div className="text-center">
                                <label className="block text-sm font-medium text-purple-700">Overall</label>
                                <input
                                  type="checkbox"
                                  checked={status.overall_picked_up || false}
                                  onChange={() => toggleOverallPickup(r.entry_id)}
                                  className="mt-1 h-8 w-8 text-purple-600 rounded focus:ring-purple-500"
                                />
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="font-medium">Race:</span>
                            <br />
                            {r.race_name || '-'}
                          </div>
                          <div>
                            <span className="font-medium">Time:</span>
                            <br />
                            {formatChronoTime(r.chip_time)}
                          </div>
                          <div className="col-span-2">
                            <span className="font-medium">Location:</span>
                            <br />
                            {r.city && `${r.city}, `}{r.state}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop Table */}
                <div className="hidden md:block">
                  <table className="w-full">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-6 py-4 text-left text-sm font-bold text-gray-700">Place</th>
                        <th className="px-6 py-4 text-left text-sm font-bold text-gray-700">Bib</th>
                        <th className="px-6 py-4 text-left text-sm font-bold text-gray-700">Name</th>
                        <th className="px-6 py-4 text-left text-sm font-bold text-gray-700">Race</th>
                        <th className="px-6 py-4 text-left text-sm font-bold text-gray-700">Time</th>
                        <th className="px-6 py-4 text-left text-sm font-bold text-gray-700">Location</th>
                        {!isOverall && (
                          <th className="px-6 py-4 text-center text-sm font-bold text-gray-700">Age Group Picked Up</th>
                        )}
                        <th className="px-6 py-4 text-center text-sm font-bold text-gray-700">
                          Overall Picked Up
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {runners.map((r) => {
                        const place = isOverall ? r.gender_place : r.age_group_place;
                        const status = pickupStatus[r.entry_id] || {};
                        const showAG = !isOverall;
                        const showOverall = status.is_overall_winner || isOverall;

                        return (
                          <tr
                            key={r.entry_id}
                            className={`hover:bg-gray-50 transition ${
                              status.picked_up || status.overall_picked_up ? 'bg-green-50' : ''
                            }`}
                          >
                            <td className="px-6 py-4 font-bold text-xl text-primary">#{place || '-'}</td>
                            <td className="px-6 py-4 font-bold">{r.bib || '-'}</td>
                            <td className="px-6 py-4 font-semibold">
                              {r.first_name} {r.last_name}
                              {(status.is_overall_winner && !isOverall) && (
                                <span className="block text-sm font-bold text-purple-600">Dual Winner</span>
                              )}
                            </td>
                            <td className="px-6 py-4">{r.race_name || '-'}</td>
                            <td className="px-6 py-4">{formatChronoTime(r.chip_time)}</td>
                            <td className="px-6 py-4">
                              {r.city && `${r.city}, `}
                              {r.state}
                            </td>
                            {showAG && (
                              <td className="px-6 py-4 text-center">
                                <input
                                  type="checkbox"
                                  checked={status.picked_up || false}
                                  onChange={() => toggleAGPickup(r.entry_id)}
                                  className="h-7 w-7 text-green-600 rounded focus:ring-green-500 cursor-pointer"
                                />
                              </td>
                            )}
                            {showOverall && (
                              <td className="px-6 py-4 text-center">
                                <input
                                  type="checkbox"
                                  checked={status.overall_picked_up || false}
                                  onChange={() => toggleOverallPickup(r.entry_id)}
                                  className="h-7 w-7 text-purple-600 rounded focus:ring-purple-500 cursor-pointer"
                                />
                              </td>
                            )}
                            {!showAG && !showOverall && <td colSpan="2"></td>}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>

        <footer className="text-center py-12 text-gray-600 mt-12">
          <p className="text-lg">Live awards pickup by Gemini Timing</p>
        </footer>
      </div>
    </div>
  );
}