// src/pages/public/AwardsTableView.jsx
// FIXED — Male/Female Overall now correctly use gender_place instead of overall place
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

  // Fetch initial data
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
        .select('entry_id, picked_up')
        .eq('event_id', eventId);

      if (isMounted && pickupData) {
        const statusMap = {};
        pickupData.forEach((row) => {
          statusMap[row.entry_id] = row.picked_up;
        });
        setPickupStatus(statusMap);
      }

      setLoading(false);
    };

    loadData();

    // Realtime channels (unchanged)
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
              [payload.new.entry_id]: payload.new.picked_up,
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

  const togglePickup = async (entryId) => {
    const current = pickupStatus[entryId] || false;
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

    if (error) {
      console.error('Failed to save pickup status:', error);
      alert('Failed to update pickup status');
    } else {
      setPickupStatus((prev) => ({ ...prev, [entryId]: newStatus }));
    }
  };

  // Filtered winners
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

  // Divisions
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
        .filter((r) => r.gender === 'M')
        .sort((a, b) => (a.gender_place || Infinity) - (b.gender_place || Infinity))
        .slice(0, places);
    }
    if (div === 'Female Overall') {
      return searchFiltered
        .filter((r) => r.gender === 'F')
        .sort((a, b) => (a.gender_place || Infinity) - (b.gender_place || Infinity))
        .slice(0, places);
    }

    return searchFiltered
      .filter((r) => r.age_group_name === div)
      .sort((a, b) => (a.age_group_place || Infinity) - (b.age_group_place || Infinity))
      .slice(0, places);
  };

  // Progress
  const totalAwards = divisions.reduce(
    (sum, div) => sum + getRunnersInDivision(div).length,
    0
  );
  const pickedUpCount = divisions.reduce((sum, div) => {
    const runners = getRunnersInDivision(div);
    return sum + runners.filter((r) => pickupStatus[r.entry_id]).length;
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
    <div className="min-h-screen bg-gray-50">
      <header className="bg-primary text-white py-8 shadow-2xl">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <h1 className="text-4xl md:text-5xl font-black mb-2">{eventName}</h1>
          <p className="text-2xl">Awards Pickup Table</p>
          <p className="text-xl mt-4">
            Progress: {pickedUpCount} / {totalAwards} picked up ({Math.round(progress)}%)
          </p>
          <div className="w-full max-w-md mx-auto mt-4 bg-gray-300 rounded-full h-6 overflow-hidden">
            <div
              className="bg-green-400 h-full transition-all duration-700"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Controls */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-10">
          <div className="grid md:grid-cols-2 gap-6">
            {races.length > 1 && (
              <div>
                <label className="block text-lg font-bold text-gray-800 mb-3">Filter by Race</label>
                <select
                  value={selectedRace}
                  onChange={(e) => setSelectedRace(e.target.value)}
                  className="w-full px-6 py-4 rounded-xl border-2 border-primary text-lg focus:ring-4 focus:ring-primary/30"
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
              <label className="block text-lg font-bold text-gray-800 mb-3">Search Winners</label>
              <input
                type="text"
                placeholder="Name, bib, city..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-6 py-4 rounded-xl border-2 border-primary text-lg focus:ring-4 focus:ring-primary/30"
              />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-primary text-white">
                <tr>
                  <th className="px-8 py-6 text-left text-lg font-bold">Division</th>
                  <th className="px-8 py-6 text-left text-lg font-bold">Place</th>
                  <th className="px-8 py-6 text-left text-lg font-bold">Bib</th>
                  <th className="px-8 py-6 text-left text-lg font-bold">Name</th>
                  <th className="px-8 py-6 text-left text-lg font-bold">Race</th>
                  <th className="px-8 py-6 text-left text-lg font-bold">Time</th>
                  <th className="px-8 py-6 text-center text-lg font-bold">Picked Up</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {divisions.flatMap((div) => {
                  const runners = getRunnersInDivision(div);
                  return runners.length > 0
                    ? runners.map((r) => {
                        // CORRECTED: Use gender_place for Overall divisions
                        const place = div.includes('Overall')
                          ? r.gender_place
                          : r.age_group_place;

                        return (
                          <tr
                            key={r.entry_id}
                            className={`hover:bg-green-50 transition ${
                              pickupStatus[r.entry_id] ? 'bg-green-100' : ''
                            }`}
                          >
                            <td className="px-8 py-6 font-medium text-lg">{div}</td>
                            <td className="px-8 py-6 font-bold text-xl text-primary">#{place || '-'}</td>
                            <td className="px-8 py-6 font-bold text-lg">{r.bib || '-'}</td>
                            <td className="px-8 py-6 font-semibold text-lg">
                              {r.first_name} {r.last_name}
                            </td>
                            <td className="px-8 py-6 text-lg">{r.race_name || '-'}</td>
                            <td className="px-8 py-6 text-lg">{formatChronoTime(r.chip_time)}</td>
                            <td className="px-8 py-6 text-center">
                              <input
                                type="checkbox"
                                checked={pickupStatus[r.entry_id] || false}
                                onChange={() => togglePickup(r.entry_id)}
                                className="h-8 w-8 text-green-600 rounded focus:ring-green-500 cursor-pointer"
                              />
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

        <footer className="text-center py-16 text-gray-600">
          <p className="text-xl">Live awards pickup table by Gemini Timing</p>
        </footer>
      </div>
    </div>
  );
}