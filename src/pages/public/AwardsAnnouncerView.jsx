// src/pages/public/AwardsAnnouncerView.jsx
// FINAL — Auto-updates places + button realigned
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { formatChronoTime } from '../../utils/timeUtils';

export default function AwardsAnnouncerView() {
  const { eventId } = useParams();
  const [finishers, setFinishers] = useState([]);
  const [eventName, setEventName] = useState('Loading Event...');
  const [races, setRaces] = useState([]);
  const [selectedRace, setSelectedRace] = useState('');
  const [announced, setAnnounced] = useState(new Set());
  const [awardSettings, setAwardSettings] = useState({ overall_places: 3, age_group_places: 3 });
  const [loading, setLoading] = useState(true);
  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    if (!eventId) return;

    const fetchEventInfo = async () => {
      const { data: eventData } = await supabase
        .from('chronotrack_events')
        .select('name')
        .eq('id', eventId)
        .single();

      setEventName(eventData?.name || 'Awards Ceremony');

      // Load current award settings
      const { data: settingsData } = await supabase
        .from('event_results_visibility')
        .select('overall_places, age_group_places')
        .eq('event_id', eventId)
        .single();

      setAwardSettings({
        overall_places: settingsData?.overall_places || 3,
        age_group_places: settingsData?.age_group_places || 3,
      });

      // Load races
      const { data: results } = await supabase
        .from('chronotrack_results')
        .select('race_name')
        .eq('event_id', eventId);

      const uniqueRaces = ['all', ...new Set(results?.map(r => r.race_name).filter(Boolean))];
      setRaces(uniqueRaces);

      // Default selection
      if (uniqueRaces.length > 1) {
        setSelectedRace(uniqueRaces[0]);
      } else {
        setSelectedRace('all');
      }
    };

    fetchEventInfo();
  }, [eventId]);

  useEffect(() => {
    if (!eventId) return;

    const fetchResults = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('chronotrack_results')
        .select('*')
        .eq('event_id', eventId)
        .order('place', { ascending: true });

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
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'event_results_visibility', filter: `event_id=eq.${eventId}` },
        (payload) => {
          // Auto-update when director changes number of places
          setAwardSettings({
            overall_places: payload.new.overall_places || 3,
            age_group_places: payload.new.age_group_places || 3,
          });
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [eventId]);

  useEffect(() => {
    const handleScroll = () => setShowBackToTop(window.scrollY > 500);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  const markAnnounced = (entryId) => {
    setAnnounced(prev => {
      const newSet = new Set(prev);
      newSet.has(entryId) ? newSet.delete(entryId) : newSet.add(entryId);
      return newSet;
    });
  };

  const filteredFinishers = selectedRace === 'all'
    ? finishers
    : finishers.filter(r => r.race_name === selectedRace);

  const getDivisions = () => {
    const ageGroups = [...new Set(filteredFinishers.map(r => r.age_group_name).filter(Boolean))];
    const sorted = ageGroups
      .filter(g => g !== 'Overall')
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
    const places = div.includes('Overall') ? awardSettings.overall_places : awardSettings.age_group_places;

    if (div === 'Male Overall') {
      return filteredFinishers
        .filter(r => r.gender === 'M')
        .sort((a, b) => (a.place || Infinity) - (b.place || Infinity))
        .slice(0, places);
    }
    if (div === 'Female Overall') {
      return filteredFinishers
        .filter(r => r.gender === 'F')
        .sort((a, b) => (a.place || Infinity) - (b.place || Infinity))
        .slice(0, places);
    }
    return filteredFinishers
      .filter(r => r.age_group_name === div)
      .sort((a, b) => (a.age_group_place || Infinity) - (b.age_group_place || Infinity))
      .slice(0, places);
  };

  const onCourseInDivision = (div) => {
    const runners = div.includes('Overall')
      ? filteredFinishers.filter(r => (div === 'Male Overall' ? r.gender === 'M' : r.gender === 'F'))
      : filteredFinishers.filter(r => r.age_group_name === div);
    return runners.filter(r => !r.chip_time || r.chip_time.trim() === '').length;
  };

  // Progress
  const totalToAnnounce = divisions.reduce((sum, div) => sum + getRunnersInDivision(div).length, 0);
  const announcedCount = divisions.reduce((sum, div) => {
    const runners = getRunnersInDivision(div);
    return sum + runners.filter(r => announced.has(r.entry_id)).length;
  }, 0);
  const progress = totalToAnnounce > 0 ? (announcedCount / totalToAnnounce) * 100 : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-3xl text-gray-700">Loading awards...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 relative">
      <header className="bg-primary text-white py-6 shadow-xl sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <h1 className="text-4xl md:text-5xl font-black mb-2">{eventName}</h1>
          <p className="text-xl md:text-2xl">Awards Ceremony</p>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Controls */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-8">
          {races.length > 1 && (
            <div className="mb-6 text-center">
              <label className="block text-lg font-bold text-gray-800 mb-3">Select Race</label>
              <select
                value={selectedRace}
                onChange={(e) => setSelectedRace(e.target.value)}
                className="px-8 py-4 rounded-xl border-2 border-primary text-lg focus:outline-none focus:ring-4 focus:ring-primary/30"
              >
                <option value="all">All Races</option>
                {races.filter(r => r !== 'all').map(race => (
                  <option key={race} value={race}>{race}</option>
                ))}
              </select>
            </div>
          )}

          <div className="text-center">
            <p className="text-2xl font-bold text-gray-800 mb-4">
              Progress: {announcedCount} / {totalToAnnounce} announced
            </p>
            <div className="w-full bg-gray-300 rounded-full h-10 overflow-hidden">
              <div className="bg-primary h-full transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-lg text-gray-600 mt-3">{Math.round(progress)}% Complete</p>
          </div>
        </div>

        {/* Jump Links */}
        <div className="flex flex-wrap justify-center gap-3 mb-12">
          {divisions.map((div) => {
            const onCourse = onCourseInDivision(div);
            return (
              <a
                key={div}
                href={`#division-${div.replace(/\s+/g, '-')}`}
                className="px-5 py-3 bg-primary text-white rounded-full text-sm md:text-base font-semibold hover:bg-primary/90 transition"
              >
                {div}
                {onCourse > 0 && <span className="ml-2 text-yellow-300 text-sm">+{onCourse}</span>}
              </a>
            );
          })}
        </div>

        {/* Divisions */}
        {divisions.map((div) => {
          const runners = getRunnersInDivision(div);

          return (
            <div
              key={div}
              id={`division-${div.replace(/\s+/g, '-')}`}
              className="mb-20 scroll-mt-32"
            >
              <h2 className="text-4xl md:text-5xl font-black text-center text-gray-800 mb-12">
                {div}
                {onCourseInDivision(div) > 0 && (
                  <p className="text-xl md:text-2xl text-orange-600 mt-4">
                    {onCourseInDivision(div)} still on course
                  </p>
                )}
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
                      <p className="text-6xl md:text-7xl font-black text-primary mb-6">
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
                      <p className="text-3xl md:text-4xl text-gray-700 mb-8">
                        {formatChronoTime(runner.chip_time)}
                      </p>
                      <p className="text-lg md:text-xl text-gray-600 mb-10">
                        {runner.city && `${runner.city}, `}{runner.state}
                      </p>

                      {/* Re-aligned Announced Button */}
                      <div className="mt-auto">
                        <button
                          onClick={() => markAnnounced(runner.entry_id)}
                          className={`w-full max-w-xs mx-auto px-12 py-6 rounded-full text-2xl md:text-3xl font-bold transition ${
                            announced.has(runner.entry_id)
                              ? 'bg-gray-500 text-white'
                              : 'bg-primary text-white hover:bg-primary/90'
                          }`}
                        >
                          {announced.has(runner.entry_id) ? 'Announced ✓' : 'Mark Announced'}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}

        <footer className="text-center py-12 text-gray-600">
          <p className="text-xl">Live results by Gemini Timing</p>
        </footer>
      </div>

      {showBackToTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-8 right-8 bg-primary text-white w-14 h-14 rounded-full shadow-2xl flex items-center justify-center text-3xl hover:bg-primary/90 transition z-50"
          aria-label="Back to top"
        >
          ↑
        </button>
      )}
    </div>
  );
}