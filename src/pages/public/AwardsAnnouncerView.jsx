// src/pages/public/AwardsAnnouncerView.jsx
// FINAL — Mobile-optimized + correct gender_place + fixed button text size
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
  const [awardSettings, setAwardSettings] = useState({
    overall_places: 3,
    age_group_places: 3,
  });
  const [loading, setLoading] = useState(true);
  const [showBackToTop, setShowBackToTop] = useState(false);

  // Fetch event name and races
  useEffect(() => {
    if (!eventId) return;

    const fetchInfo = async () => {
      try {
        const { data: eventData } = await supabase
          .from('chronotrack_events')
          .select('name')
          .eq('id', eventId)
          .single();
        setEventName(eventData?.name || 'Awards Ceremony');

        const { data: results } = await supabase
          .from('chronotrack_results')
          .select('race_name')
          .eq('event_id', eventId);

        const uniqueRaces = [
          'all',
          ...new Set(results?.map((r) => r.race_name).filter(Boolean)),
        ];
        setRaces(uniqueRaces);
        setSelectedRace(uniqueRaces[0] || 'all');
      } catch (err) {
        console.error('Error fetching event info:', err);
      }
    };

    fetchInfo();
  }, [eventId]);

  // Realtime: separate channels
  useEffect(() => {
    if (!eventId) return;

    let isMounted = true;

    const loadResults = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('chronotrack_results')
        .select('*')
        .eq('event_id', eventId)
        .order('place', { ascending: true });

      if (isMounted) {
        setFinishers(data || []);
      }
    };

    const loadSettings = async () => {
      const { data } = await supabase
        .from('event_results_visibility')
        .select('overall_places, age_group_places')
        .eq('event_id', eventId)
        .maybeSingle();

      if (isMounted) {
        setAwardSettings({
          overall_places: data?.overall_places ?? 3,
          age_group_places: data?.age_group_places ?? 3,
        });
      }
    };

    loadResults();
    loadSettings();

    const resultsChannel = supabase
      .channel(`announcer-results-${eventId}`)
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
            const existingIndex = prev.findIndex(
              (r) =>
                r.entry_id === payload.new?.entry_id ||
                r.entry_id === payload.old?.entry_id
            );
            if (payload.eventType === 'DELETE') {
              return prev.filter((r) => r.entry_id !== payload.old.entry_id);
            }
            if (existingIndex >= 0) {
              const updated = [...prev];
              updated[existingIndex] = payload.new;
              return updated;
            }
            return [...prev, payload.new];
          });
        }
      )
      .subscribe();

    const settingsChannel = supabase
      .channel(`announcer-settings-${eventId}`)
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
          if (payload.eventType === 'DELETE') {
            setAwardSettings({ overall_places: 3, age_group_places: 3 });
          }
        }
      )
      .subscribe();

    setLoading(false);

    return () => {
      isMounted = false;
      supabase.removeChannel(resultsChannel);
      supabase.removeChannel(settingsChannel);
    };
  }, [eventId]);

  useEffect(() => {
    const handleScroll = () => setShowBackToTop(window.scrollY > 500);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  const markAnnounced = (entryId) => {
    setAnnounced((prev) => {
      const next = new Set(prev);
      next.has(entryId) ? next.delete(entryId) : next.add(entryId);
      return next;
    });
  };

  const filteredFinishers = selectedRace
    ? selectedRace === 'all'
      ? finishers
      : finishers.filter((r) => r.race_name === selectedRace)
    : [];

  const getDivisions = () => {
    if (!selectedRace) return [];

    const ageGroups = [
      ...new Set(filteredFinishers.map((r) => r.age_group_name).filter(Boolean)),
    ];

    const sortedAgeGroups = ageGroups
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
    divisions.push(...sortedAgeGroups);

    return divisions;
  };

  const divisions = getDivisions();

  const getRunnersInDivision = (div) => {
    const places = div.includes('Overall')
      ? awardSettings.overall_places
      : awardSettings.age_group_places;

    if (div === 'Male Overall') {
      return filteredFinishers
        .filter((r) => r.gender === 'M' && r.gender_place !== null)
        .sort((a, b) => (a.gender_place || Infinity) - (b.gender_place || Infinity))
        .slice(0, places);
    }
    if (div === 'Female Overall') {
      return filteredFinishers
        .filter((r) => r.gender === 'F' && r.gender_place !== null)
        .sort((a, b) => (a.gender_place || Infinity) - (b.gender_place || Infinity))
        .slice(0, places);
    }

    return filteredFinishers
      .filter((r) => r.age_group_name === div)
      .sort((a, b) => (a.age_group_place || Infinity) - (b.age_group_place || Infinity))
      .slice(0, places);
  };

  const onCourseInDivision = (div) => {
    const allInDiv =
      div.includes('Overall')
        ? filteredFinishers.filter((r) =>
            div === 'Male Overall' ? r.gender === 'M' : r.gender === 'F'
          )
        : filteredFinishers.filter((r) => r.age_group_name === div);

    return allInDiv.filter(
      (r) => !r.chip_time || r.chip_time.trim() === ''
    ).length;
  };

  const totalToAnnounce = divisions.reduce(
    (sum, div) => sum + getRunnersInDivision(div).length,
    0
  );
  const announcedCount = divisions.reduce((sum, div) => {
    const runners = getRunnersInDivision(div);
    return sum + runners.filter((r) => announced.has(r.entry_id)).length;
  }, 0);

  const progress =
    totalToAnnounce > 0 ? (announcedCount / totalToAnnounce) * 100 : 0;

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
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-12 text-center">
          <label className="block text-2xl font-bold text-gray-800 mb-6">
            Select Race to Begin Awards
          </label>
          <select
            value={selectedRace}
            onChange={(e) => setSelectedRace(e.target.value)}
            className="px-10 py-6 rounded-2xl border-4 border-primary text-2xl font-bold focus:outline-none focus:ring-8 focus:ring-primary/30"
          >
            <option value="">Choose a race...</option>
            <option value="all">All Races</option>
            {races
              .filter((r) => r !== 'all')
              .map((race) => (
                <option key={race} value={race}>
                  {race}
                </option>
              ))}
          </select>

          {selectedRace && (
            <div className="mt-12">
              <p className="text-3xl font-bold text-gray-800 mb-6">
                Progress: {announcedCount} / {totalToAnnounce} announced
              </p>
              <div className="w-full bg-gray-300 rounded-full h-12 overflow-hidden">
                <div
                  className="bg-primary h-full transition-all duration-700"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-2xl text-gray-600 mt-4">
                {Math.round(progress)}% Complete
              </p>
            </div>
          )}
        </div>

        {selectedRace ? (
          <>
            <div className="flex flex-wrap justify-center gap-4 mb-16">
              {divisions.map((div) => {
                const onCourse = onCourseInDivision(div);
                return (
                  <a
                    key={div}
                    href={`#division-${div.replace(/\s+/g, '-')}`}
                    className="px-8 py-5 bg-primary text-white rounded-full text-xl font-bold hover:bg-primary/90 transition"
                  >
                    {div}
                    {onCourse > 0 && (
                      <span className="ml-3 text-yellow-300">+{onCourse}</span>
                    )}
                  </a>
                );
              })}
            </div>

            {divisions.map((div) => {
              const runners = getRunnersInDivision(div);
              const onCourse = onCourseInDivision(div);

              return (
                <div
                  key={div}
                  id={`division-${div.replace(/\s+/g, '-')}`}
                  className="mb-32 scroll-mt-32"
                >
                  <h2 className="text-5xl md:text-6xl font-black text-center text-gray-800 mb-16">
                    {div}
                    {onCourse > 0 && (
                      <p className="text-2xl md:text-3xl text-orange-600 mt-6">
                        {onCourse} still on course
                      </p>
                    )}
                  </h2>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-16 max-w-6xl mx-auto">
                    {runners.length === 0 ? (
                      <p className="col-span-3 text-center text-3xl text-gray-500">
                        No finishers yet
                      </p>
                    ) : (
                      runners.map((runner) => {
                        const place = div.includes('Overall') ? runner.gender_place : runner.age_group_place;

                        return (
                          <div
                            key={runner.entry_id}
                            className={`bg-white rounded-3xl shadow-2xl p-12 text-center transition-all duration-500 ${
                              announced.has(runner.entry_id)
                                ? 'opacity-40 grayscale'
                                : ''
                            }`}
                          >
                            <p className="text-8xl md:text-9xl font-black text-primary mb-8">
                              #{place || '-'}
                            </p>
                            <h3 className="text-4xl md:text-5xl font-bold text-gray-800 mb-6">
                              {runner.first_name} {runner.last_name}
                            </h3>
                            {runner.race_name && (
                              <p className="text-2xl md:text-3xl text-primary mb-6 font-medium">
                                {runner.race_name}
                              </p>
                            )}
                            <p className="text-4xl md:text-5xl text-gray-700 mb-10">
                              {formatChronoTime(runner.chip_time)}
                            </p>
                            <p className="text-xl md:text-2xl text-gray-600 mb-12">
                              {runner.city && `${runner.city}, `}
                              {runner.state}
                            </p>
                            {/* FIXED: Proper className syntax + smaller mobile text */}
                            <button
                              onClick={() => markAnnounced(runner.entry_id)}
                              className={`w-full max-w-md mx-auto px-12 py-6 rounded-full font-bold transition text-xl md:text-3xl ${
                                announced.has(runner.entry_id)
                                  ? 'bg-gray-500 text-white'
                                  : 'bg-primary text-white hover:bg-primary/90'
                              }`}
                            >
                              {announced.has(runner.entry_id)
                                ? 'Announced ✓'
                                : 'Mark Announced'}
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}

            <footer className="text-center py-16 text-gray-600">
              <p className="text-2xl">Live results by Gemini Timing</p>
            </footer>
          </>
        ) : (
          <div className="text-center py-40">
            <p className="text-4xl font-bold text-gray-600 mb-8">
              Select a race above to begin the awards ceremony
            </p>
            <p className="text-2xl text-gray-500">
              Once selected, the top finishers will appear here.
            </p>
          </div>
        )}
      </div>

      {showBackToTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-10 right-10 bg-primary text-white w-16 h-16 rounded-full shadow-2xl flex items-center justify-center text-4xl hover:bg-primary/90 transition z-50"
          aria-label="Back to top"
        >
          ↑
        </button>
      )}
    </div>
  );
}