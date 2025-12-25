// src/pages/public/AwardsTableView.jsx
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../../supabaseClient';

export default function AwardsTableView() {
  const { eventId } = useParams();

  const [finishers, setFinishers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Load live results
  useEffect(() => {
    if (!eventId) return;

    const fetchInitial = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('chronotrack_results')
        .select('*')
        .eq('event_id', eventId)
        .order('place', { ascending: true });

      setFinishers(data || []);
      setLoading(false);
    };

    fetchInitial();

    const channel = supabase
      .channel(`public-table-${eventId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chronotrack_results',
          filter: `event_id=eq.${eventId}`,
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

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId]);

  // Smart division ordering: Male Overall → Female Overall → youngest to oldest, alternating
  const getDivisions = () => {
    const ageGroups = [...new Set(finishers.map((r) => r.age_group_name).filter(Boolean))];
    const sortedAgeGroups = ageGroups
      .filter((g) => g !== 'Overall')
      .sort((a, b) => {
        const ageA = parseInt(a.match(/\d+/)?.[0] || 0);
        const ageB = parseInt(b.match(/\d+/)?.[0] || 0);
        return ageA - ageB; // youngest first
      });

    const ordered = [
      'Male Overall',
      'Female Overall',
      ...sortedAgeGroups.flatMap((group) => {
        const male = finishers.filter((r) => r.age_group_name === group && r.gender === 'M');
        const female = finishers.filter((r) => r.age_group_name === group && r.gender === 'F');
        return [
          male.length ? `${group} Male` : null,
          female.length ? `${group} Female` : null,
        ].filter(Boolean);
      }),
    ].filter(Boolean);

    return ordered;
  };

  const divisions = getDivisions();

  const getRunnersInDivision = (divName) => {
    if (divName === 'Male Overall') return finishers.filter((r) => r.gender === 'M');
    if (divName === 'Female Overall') return finishers.filter((r) => r.gender === 'F');
    const [ageGroup, gender] = divName.split(' ');
    return finishers.filter(
      (r) => r.age_group_name === ageGroup && (gender === 'Male' ? r.gender === 'M' : r.gender === 'F')
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-light flex items-center justify-center">
        <p className="text-3xl text-text-dark">Loading awards table...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-light">
      {/* Header */}
      <header className="bg-primary text-text-light py-6 shadow-lg">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <h1 className="text-4xl font-bold">Awards Pickup Table</h1>
          <p className="text-xl mt-2">Live Results • All Awarded Finishers</p>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-12">
        {/* Table */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-text-dark text-text-light">
                <tr>
                  <th className="px-8 py-6 text-left text-lg">Division</th>
                  <th className="px-8 py-6 text-left text-lg">Place</th>
                  <th className="px-8 py-6 text-left text-lg">Name</th>
                  <th className="px-8 py-6 text-left text-lg">Time</th>
                  <th className="px-8 py-6 text-left text-lg">City, State</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {divisions.map((div) => {
                  const runners = getRunnersInDivision(div);

                  return runners.length > 0 ? (
                    runners.map((runner) => (
                      <tr key={runner.entry_id} className="hover:bg-bg-light transition">
                        <td className="px-8 py-6 font-medium text-lg">{div}</td>
                        <td className="px-8 py-6 font-bold text-xl text-primary">
                          {runner.place || '-'}
                        </td>
                        <td className="px-8 py-6 font-semibold text-lg">
                          {runner.first_name} {runner.last_name}
                        </td>
                        <td className="px-8 py-6 text-lg">{runner.chip_time || '—'}</td>
                        <td className="px-8 py-6 text-lg">
                          {runner.city && `${runner.city}, `}{runner.state}
                        </td>
                      </tr>
                    ))
                  ) : null;
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <footer className="text-center py-12 text-text-muted">
          <p className="text-xl">Live awards table powered by Gemini Timing</p>
          <Link to="/" className="text-primary hover:underline mt-4 inline-block text-lg">
            Return to Main Site
          </Link>
        </footer>
      </div>
    </div>
  );
}