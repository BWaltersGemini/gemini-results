// src/pages/public/AwardsTableView.jsx
// Simple pickup table view — matches announcer data
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../supabaseClient';

export default function AwardsTableView() {
  const { eventId } = useParams();
  const [finishers, setFinishers] = useState([]);
  const [eventName, setEventName] = useState('Awards Table');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!eventId) return;

    const fetchData = async () => {
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

  const getDivisions = () => {
    const ageGroups = [...new Set(finishers.map(r => r.age_group_name).filter(Boolean))];
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
    return finishers
      .filter(r => r.age_group_name === div)
      .sort((a, b) => (a.age_group_place || Infinity) - (b.age_group_place || Infinity))
      .slice(0, 3);
  };

  if (loading) {
    return <div className="p-10 text-center text-2xl">Loading table...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <h1 className="text-4xl font-bold text-center mb-8">{eventName} - Awards Pickup Table</h1>
      <div className="max-w-6xl mx-auto bg-white rounded-2xl shadow-2xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-primary text-white">
            <tr>
              <th className="px-6 py-4 text-left">Division</th>
              <th className="px-6 py-4 text-left">Place</th>
              <th className="px-6 py-4 text-left">Name</th>
              <th className="px-6 py-4 text-left">Race</th>
              <th className="px-6 py-4 text-left">Time</th>
              <th className="px-6 py-4 text-left">Location</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {divisions.map(div => {
              const runners = getRunnersInDivision(div);
              return runners.map(r => (
                <tr key={r.entry_id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium">{div}</td>
                  <td className="px-6 py-4 font-bold text-primary">#{r.age_group_place}</td>
                  <td className="px-6 py-4 font-semibold">{r.first_name} {r.last_name}</td>
                  <td className="px-6 py-4">{r.race_name || '-'}</td>
                  <td className="px-6 py-4">{r.chip_time || '-'}</td>
                  <td className="px-6 py-4">{r.city && `${r.city}, `}{r.state}</td>
                </tr>
              ));
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}