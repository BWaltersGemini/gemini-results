// src/pages/public/AwardsAnnouncerView.jsx
// FINAL — Mark Announced + Progress Bar + Event/Race Selector
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../supabaseClient';

export default function AwardsAnnouncerView() {
  const { eventId } = useParams();
  const [finishers, setFinishers] = useState([]);
  const [eventName, setEventName] = useState('Loading Event...');
  const [races, setRaces] = useState([]);
  const [selectedRace, setSelectedRace] = useState('all');
  const [announced, setAnnounced] = useState(new Set());
  const [loading, setLoading] = useState(true);

  // Fetch event name and races
  useEffect(() => {
    if (!eventId) return;

    const fetchEventInfo = async () => {
      const { data: eventData } = await supabase
        .from('chronotrack_events')
        .select('name')
        .eq('id', eventId)
        .single();

      setEventName(eventData?.name || 'Awards Ceremony');

      // Get unique race names
      const { data: results } = await supabase
        .from('chronotrack_results')
        .select('race_name')
        .eq('event_id', eventId);

      const uniqueRaces = ['all', ...new Set(results?.map(r => r.race_name).filter(Boolean))];
      setRaces(uniqueRaces);
    };

    fetchEventInfo();
  }, [eventId]);

  // Load results
  useEffect(() => {
    if (!eventId) return;

    const fetchResults = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('chronotrack_results')
        .select('*')
        .eq('event_id', eventId)
        .order('age_group_place', { ascending: true });

      setFinishers(data || []);
      setLoading(false);
    };

    fetchResults();

    const channel = supabase
      .channel(`announcer-${eventId}`)
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

  // Divisions (age groups only)
  const getDivisions = () => {
    const filtered = selectedRace === 'all'
      ? finishers
      : finishers.filter(r => r.race_name === selectedRace);

    const ageGroups = [...new Set(filtered.map(r => r.age_group_name).filter(Boolean))];
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
    const filtered = selectedRace === 'all'
      ? finishers
      : finishers.filter(r => r.race_name === selectedRace);

    return filtered
      .filter(r => r.age_group_name === div)
      .sort((a, b) => (a.age_group_place || Infinity) - (b.age_group_place || Infinity))
      .slice(0, 3); // Top 3 only for announcer
  };

  // Progress calculation
  const totalToAnnounce = divisions.reduce((sum, div) => {
    const runners = getRunnersInDivision(div);
    return sum + runners.length;
  }, 0);

  const announcedCount = divisions.reduce((sum, div) => {
    const runners = getRunnersInDivision(div);
    return sum + runners.filter(r => announced.has(r.entry_id)).length;
  }, 0);

  const progress = totalToAnnounce > 0 ? (announcedCount / totalToAnnounce) * 100 : 0;

  const markAnnounced = (entryId) => {
    setAnnounced(prev => {
      const newSet = new Set(prev);
      if (newSet.has(entryId)) {
        newSet.delete(entryId);
      } else {
        newSet.add(entryId);
      }
      return newSet;
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-3xl text-gray-700">Loading awards...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-primary text-white py-6 shadow-xl">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <h1 className="text-4xl md:text-5xl font-black mb-2">{eventName}</h1>
          <p className="text-xl md:text-2xl">Awards Ceremony • Top 3 Age Group Winners</p>
        </div>
      </header>

      {/* Controls */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-8">
          {/* Race Selector */}
          {races.length > 1 && (
            <div className="mb-6">
              <label className="block text-lg font-bold text-gray-800 mb-3">Select Race</label>
              <select
                value={selectedRace}
                onChange={(e) => setSelectedRace(e.target.value)}
                className="w-full md:w-80 px-6 py-4 rounded-xl border-2 border-primary text-lg focus:outline-none focus:ring-4 focus:ring-primary/30"
              >
                <option value="all">All Races</option>
                {races.filter(r => r !== 'all').map(race => (
                  <option key={race} value={race}>{race}</option>
                ))}
              </select>
            </div>
          )}

          {/* Progress Bar */}
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-800 mb-4">
              Progress: {announcedCount} / {totalToAnnounce} announced
            </p>
            <div className="w-full bg-gray-300 rounded-full h-10 overflow-hidden">
              <div
                className="bg-primary h-full transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-lg text-gray-600 mt-3">{Math.round(progress)}% Complete</p>
          </div>
        </div>

        {/* Division Cards */}
        <div className="space-y-16">
          {divisions.map((div) => {
            const runners = getRunnersInDivision(div);

            return (
              <div key={div} className="scroll-mt-32">
                <h2 className="text-4xl md:text-5xl font-black text-center text-gray-800 mb-12">
                  {div}
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-10 max-w-5xl mx-auto">
                  {runners.length === 0 ? (
                    <p className="col-span-3 text-center text-2xl text-gray-500">No finishers yet</p>
                  ) : (
                    runners.map((runner, i) => (
                      <div
                        key={runner.entry_id}
                        className={`bg-white rounded-3xl shadow-2xl p-10 text-center transition-all ${
                          announced.has(runner.entry_id) ? 'opacity-50 grayscale' : ''
                        }`}
                      >
                        <p className="text-7xl md:text-8xl font-black text-primary mb-6">
                          #{i + 1}
                        </p>
                        <h3 className="text-3xl md:text-4xl font-bold text-gray-800 mb-4">
                          {runner.first_name} {runner.last_name}
                        </h3>
                        {runner.race_name && (
                          <p className="text-xl md:text-2xl text-primary mb-4 font-medium">
                            {runner.race_name}
                          </p>
                        )}
                        <p className="text-3xl md:text-4xl text-gray-700 mb-6">
                          {runner.chip_time || '—'}
                        </p>
                        <p className="text-xl md:text-2xl text-gray-600">
                          {runner.city && `${runner.city}, `}{runner.state}
                        </p>

                        <button
                          onClick={() => markAnnounced(runner.entry_id)}
                          className={`mt-10 px-12 py-6 rounded-full text-2xl font-bold transition ${
                            announced.has(runner.entry_id)
                              ? 'bg-gray-500 text-white'
                              : 'bg-primary text-white hover:bg-primary/90'
                          }`}
                        >
                          {announced.has(runner.entry_id) ? 'Announced ✓' : 'Mark Announced'}
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <footer className="text-center py-12 text-gray-600">
          <p className="text-xl">Live results powered by Gemini Timing</p>
        </footer>
      </div>
    </div>
  );
}