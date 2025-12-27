// src/pages/public/AwardsTableView.jsx
// FINAL — No city/state + Race column + search + dynamic top places
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { formatChronoTime } from '../../utils/timeUtils';

export default function AwardsTableView() {
  const { eventId } = useParams();
  const [finishers, setFinishers] = useState([]);
  const [eventName, setEventName] = useState('Awards Table');
  const [races, setRaces] = useState([]);
  const [selectedRace, setSelectedRace] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!eventId) return;

    const fetchData = async () => {
      setLoading(true);

      const { data: eventData } = await supabase
        .from('chronotrack_events')
        .select('name')
        .eq('id', eventId)
        .single();

      setEventName(eventData?.name || 'Awards Table');

      const { data } = await supabase
        .from('chronotrack_results')
        .select('*')
        .eq('event_id', eventId)
        .order('age_group_place', { ascending: true });

      setFinishers(data || []);

      const uniqueRaces = ['all', ...new Set(data?.map(r => r.race_name).filter(Boolean))];
      setRaces(uniqueRaces);

      setLoading(false);
    };

    fetchData();

    const channel = supabase
      .channel(`table-${eventId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chronotrack_results', filter: `event_id=eq.${eventId}` },
        (payload) => {
          setFinishers((prev) => {
            const index = prev.findIndex(r => r.entry_id === payload.new.entry_id);
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
  }, [eventId]);

  const filteredByRace = selectedRace === 'all'
    ? finishers
    : finishers.filter(r => r.race_name === selectedRace);

  const searched = searchTerm
    ? filteredByRace.filter(r =>
        String(r.bib).toLowerCase().includes(searchTerm.toLowerCase()) ||
        `${r.first_name} ${r.last_name}`.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : filteredByRace;

  const getDivisions = () => {
    const ageGroups = [...new Set(searched.map(r => r.age_group_name).filter(Boolean))];
    return ageGroups
      .filter(g => g !== 'Overall')
      .sort((a, b) => {
        const ageA = parseInt(a.match(/\d+/)?.[0] || 99);
        const ageB = parseInt(b.match(/\d+/)?.[0] || 99);
        return ageA - ageB;
      });
  };

  const divisions = getDivisions();

  const getRunnersInDivision = (div) => {
    return searched
      .filter(r => r.age_group_name === div)
      .sort((a, b) => (a.age_group_place || Infinity) - (b.age_group_place || Infinity))
      .slice(0, 3); // Matches director's typical setting
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-3xl text-gray-700">Loading table...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-primary text-white py-6 shadow-xl">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <h1 className="text-3xl md:text-4xl font-bold">{eventName}</h1>
          <p className="text-xl mt-2">Awards Pickup Table • Top 3 Age Group Winners</p>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-8">
          <div className="grid md:grid-cols-2 gap-6">
            {races.length > 1 && (
              <div>
                <label className="block text-lg font-bold text-gray-800 mb-3">Select Race</label>
                <select
                  value={selectedRace}
                  onChange={(e) => setSelectedRace(e.target.value)}
                  className="w-full px-6 py-4 rounded-xl border-2 border-primary text-lg focus:outline-none focus:ring-4 focus:ring-primary/30"
                >
                  <option value="all">All Races</option>
                  {races.filter(r => r !== 'all').map(race => (
                    <option key={race} value={race}>{race}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-lg font-bold text-gray-800 mb-3">Search by Bib or Name</label>
              <input
                type="text"
                placeholder="e.g. 123 or John"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-6 py-4 rounded-xl border-2 border-primary text-lg focus:outline-none focus:ring-4 focus:ring-primary/30"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-max">
              <thead className="bg-primary text-white">
                <tr>
                  <th className="px-6 py-5 text-left text-lg">Division</th>
                  <th className="px-6 py-5 text-left text-lg">Place</th>
                  <th className="px-6 py-5 text-left text-lg">Bib</th>
                  <th className="px-6 py-5 text-left text-lg">Name</th>
                  <th className="px-6 py-5 text-left text-lg">Race</th>
                  <th className="px-6 py-5 text-left text-lg">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {divisions.map(div => {
                  const runners = getRunnersInDivision(div);
                  return runners.length > 0
                    ? runners.map(r => (
                        <tr key={r.entry_id} className="hover:bg-gray-50 transition">
                          <td className="px-6 py-5 font-medium text-lg">{div}</td>
                          <td className="px-6 py-5 font-bold text-xl text-primary">#{r.age_group_place}</td>
                          <td className="px-6 py-5 text-lg font-bold">{r.bib}</td>
                          <td className="px-6 py-5 font-semibold text-lg">{r.first_name} {r.last_name}</td>
                          <td className="px-6 py-5 text-lg">{r.race_name || '-'}</td>
                          <td className="px-6 py-5 text-lg">{formatChronoTime(r.chip_time)}</td>
                        </tr>
                      ))
                    : null;
                })}
              </tbody>
            </table>
          </div>
        </div>

        <footer className="text-center py-12 text-gray-600">
          <p className="text-xl">Live awards table by Gemini Timing</p>
        </footer>
      </div>
    </div>
  );
}