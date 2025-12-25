// src/pages/public/AwardsAnnouncerView.jsx
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../../supabaseClient';

export default function AwardsAnnouncerView() {
  const { eventId } = useParams();

  const [finishers, setFinishers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [topPlaces] = useState(3); // Fixed for announcer — change if needed

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
      .channel(`public-announcer-${eventId}`)
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
    const maleOverall = finishers.filter((r) => r.gender === 'M');
    const femaleOverall = finishers.filter((r) => r.gender === 'F');

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

  const onCourseInDivision = (divName) => {
    const runners = getRunnersInDivision(divName);
    return runners.filter((r) => !r.chip_time).length;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-light flex items-center justify-center">
        <p className="text-3xl text-text-dark">Loading live results...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-light">
      {/* Simple header */}
      <header className="bg-primary text-text-light py-6 shadow-lg">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h1 className="text-4xl font-bold">Awards Announcer View</h1>
          <p className="text-xl mt-2">Live Results • Top {topPlaces} per Division</p>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Division Jump Links */}
        <div className="flex flex-wrap justify-center gap-4 mb-12">
          {divisions.map((div) => {
            const runners = getRunnersInDivision(div);
            const onCourse = onCourseInDivision(div);

            return (
              <a
                key={div}
                href={`#division-${div.replace(/\s+/g, '-')}`}
                className="px-8 py-4 bg-primary text-text-light rounded-full text-lg font-semibold hover:bg-primary/90 transition"
              >
                {div}
                {onCourse > 0 && <span className="ml-2 text-yellow-300">+{onCourse} on course</span>}
              </a>
            );
          })}
        </div>

        {/* Divisions */}
        {divisions.map((div) => {
          const top = getRunnersInDivision(div).slice(0, topPlaces);
          const onCourse = onCourseInDivision(div);

          return (
            <div
              key={div}
              id={`division-${div.replace(/\s+/g, '-')}`}
              className="mb-20 scroll-mt-32"
            >
              <h2 className="text-5xl font-bold text-text-dark text-center mb-12">
                {div}
                {onCourse > 0 && (
                  <span className="block text-3xl text-orange-600 mt-4">
                    {onCourse} still on course
                  </span>
                )}
              </h2>

              <div className="space-y-12">
                {top.length === 0 ? (
                  <p className="text-center text-2xl text-text-muted">No finishers yet</p>
                ) : (
                  top.map((runner, i) => (
                    <div
                      key={runner.entry_id}
                      className="bg-white rounded-3xl shadow-2xl p-12 text-center max-w-2xl mx-auto"
                    >
                      <p className="text-7xl font-black text-primary mb-6">#{i + 1}</p>
                      <h3 className="text-5xl font-bold text-text-dark mb-4">
                        {runner.first_name} {runner.last_name}
                      </h3>
                      <p className="text-4xl text-text-muted mb-6">{runner.chip_time || '—'}</p>
                      <p className="text-3xl text-text-muted">
                        {runner.city && `${runner.city}, `}{runner.state}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}

        {/* Footer */}
        <footer className="text-center py-12 text-text-muted">
          <p className="text-xl">Live results powered by Gemini Timing</p>
          <Link to="/" className="text-primary hover:underline mt-4 inline-block">
            Return to Main Site
          </Link>
        </footer>
      </div>
    </div>
  );
}