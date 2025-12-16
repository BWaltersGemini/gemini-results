// src/pages/ResultsPage.jsx (Final – Correctly receives and applies division filter)
import { useContext, useState, useRef, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import ResultsTable from '../components/ResultsTable';
import { RaceContext } from '../context/RaceContext';

export default function ResultsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { masterKey, year, raceSlug } = useParams();

  const {
    selectedEvent,
    events = [],
    races = [],
    results = [],
    loadingResults,
    error,
    uniqueDivisions = [],
    eventLogos = {},
    ads,
    setSelectedEvent,
  } = useContext(RaceContext);

  const masterGroups = JSON.parse(localStorage.getItem('masterGroups')) || {};

  const [pageSize] = useState(10);
  const [currentPages, setCurrentPages] = useState({});
  const [raceFilters, setRaceFilters] = useState({});
  const raceRefs = useRef({});

  const [upcomingEvents, setUpcomingEvents] = useState([]);

  const videoRef = useRef(null);

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Date TBD';
    const [year, month, day] = dateStr.split('-');
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const slugify = (text) => {
    if (!text || typeof text !== 'string') return 'overall';
    return text
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  // Handle URL params to select event
  useEffect(() => {
    if (!masterKey || !year || events.length === 0) return;

    const decodedMaster = decodeURIComponent(masterKey).replace(/-/g, ' ');
    const groupEventIds = Object.entries(masterGroups)
      .find(([key]) => slugify(key) === masterKey || key.toLowerCase() === decodedMaster)?.[1] || [];

    let yearEvents = events
      .filter(e => groupEventIds.includes(e.id) && e.date.startsWith(year))
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    if (yearEvents.length === 0) {
      yearEvents = events
        .filter(e => slugify(e.name) === masterKey && e.date.startsWith(year))
        .sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    if (yearEvents.length === 0) return;

    const targetEvent = yearEvents[0];
    if (targetEvent.id !== selectedEvent?.id) {
      setSelectedEvent(targetEvent);
    }
  }, [masterKey, year, events, masterGroups, selectedEvent, setSelectedEvent]);

  // Force video play (landing only)
  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.muted = true;
      video.playsInline = true;
      video.play().catch(() => {});
    }
  }, []);

  // Fetch upcoming events
  useEffect(() => {
    const fetchUpcomingEvents = async () => {
      try {
        const response = await fetch('https://youkeepmoving.com/wp-json/tribe/events/v1/events?per_page=12&status=publish');
        if (!response.ok) throw new Error('Failed to fetch');
        const data = await response.json();
        const futureEvents = (data.events || [])
          .filter(event => new Date(event.start_date) > new Date())
          .sort((a, b) => new Date(a.start_date) - new Date(b.start_date));
        setUpcomingEvents(futureEvents);
      } catch (err) {
        console.error('Failed to fetch upcoming events:', err);
        setUpcomingEvents([]);
      }
    };
    fetchUpcomingEvents();
  }, []);

  // Auto-apply division filter when returning from participant page
  useEffect(() => {
    if (location.state?.autoFilterDivision && selectedEvent) {
      const division = location.state.autoFilterDivision;
      const targetRaceSlug = location.state.autoFilterRaceSlug || raceSlug;

      // Find the race ID for the target race slug
      const targetRace = races.find(r => slugify(r.race_name) === targetRaceSlug);
      if (!targetRace) return;

      setRaceFilters(prev => ({
        ...prev,
        [targetRace.race_id]: {
          ...prev[targetRace.race_id],
          division: division,
        },
      }));

      // Clear state
      navigate(location.pathname, { replace: true, state: {} });

      // Scroll to the race section
      setTimeout(() => {
        const section = raceRefs.current[targetRace.race_id];
        if (section) {
          section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 300);
    }
  }, [location.state, selectedEvent, races, raceSlug, navigate]);

  // —— NO EVENT SELECTED → Landing page with video ——
  if (!selectedEvent) {
    const recentEvents = [...events]
      .filter(e => e.date && new Date(e.date) <= new Date())
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 9);

    const goToRaceResults = (event) => {
      let eventMaster = Object.entries(masterGroups).find(([_, ids]) => ids.includes(event.id))?.[0];
      const eventYear = event.date.split('-')[0];
      if (!eventMaster) eventMaster = event.name;
      if (eventMaster && eventYear) {
        const masterSlug = slugify(eventMaster);
        navigate(`/results/${masterSlug}/${eventYear}`);
      } else {
        setSelectedEvent(event);
      }
    };

    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
        {/* Video Hero – Half height on mobile */}
        <section className="relative h-64 md:h-screen w-full overflow-hidden flex items-center justify-center">
          <video
            ref={videoRef}
            src="/eventvideo.mp4"
            autoPlay
            loop
            muted
            playsInline
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#80ccd6]/70 to-[#80ccd6]/40" />
          <div className="relative z-10 text-center px-6">
            <h1 className="text-4xl md:text-7xl font-black text-white drop-shadow-2xl mb-8">
              Race Results
            </h1>
            <p className="text-xl md:text-3xl text-white/90 font-light">
              Precision timing. Real-time results.
            </p>
          </div>
        </section>

        {/* Recent Races */}
        <div className="max-w-7xl mx-auto px-6 py-16 md:py-24">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold text-gemini-dark-gray mb-4">
              Recent & Live Results
            </h2>
            <div className="w-32 h-1 bg-[#80ccd6] mx-auto"></div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10">
            {recentEvents.map((event) => (
              <button
                key={event.id}
                onClick={() => goToRaceResults(event)}
                className="group bg-white border border-gray-200 rounded-3xl overflow-hidden shadow-lg hover:shadow-2xl hover:border-[#80ccd6] transition-all duration-300 text-left"
              >
                <div className="h-64 bg-gray-50 flex items-center justify-center p-8">
                  {eventLogos[event.id] ? (
                    <img
                      src={eventLogos[event.id]}
                      alt={`${event.name} Logo`}
                      className="max-h-48 max-w-full object-contain"
                    />
                  ) : (
                    <span className="text-8xl text-gray-300">🏁</span>
                  )}
                </div>
                <div className="p-10 text-center">
                  <h3 className="text-2xl font-bold text-gemini-dark-gray mb-4 group-hover:text-[#80ccd6] transition">
                    {event.name}
                  </h3>
                  <p className="text-lg text-gray-600 mb-6">{formatDate(event.date)}</p>
                  <span className="inline-block text-[#80ccd6] font-semibold group-hover:underline">
                    View Results →
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Upcoming Events */}
        <div className="bg-gray-50 py-16 md:py-24 px-6">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-4xl md:text-5xl font-bold text-gemini-dark-gray mb-4">
                Upcoming Events
              </h2>
              <div className="w-32 h-1 bg-[#80ccd6] mx-auto"></div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10">
              {upcomingEvents.length === 0 ? (
                <p className="col-span-full text-center text-gray-600 text-xl py-12">Loading upcoming events...</p>
              ) : (
                upcomingEvents.slice(0, 6).map((event) => (
                  <a
                    key={event.id}
                    href={event.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group bg-white border border-gray-200 rounded-3xl overflow-hidden shadow-lg hover:shadow-2xl hover:border-[#80ccd6] transition-all duration-300"
                  >
                    {event.image?.url ? (
                      <img
                        src={event.image.url}
                        alt={event.title.rendered || event.title}
                        className="w-full h-64 object-cover group-hover:scale-105 transition duration-500"
                      />
                    ) : (
                      <div className="bg-gray-200 h-64 flex items-center justify-center">
                        <span className="text-gray-500 font-medium">No Image</span>
                      </div>
                    )}
                    <div className="p-8 text-center">
                      <h3 className="text-xl font-bold text-gemini-dark-gray mb-3 line-clamp-2 group-hover:text-[#80ccd6] transition">
                        {event.title.rendered || event.title}
                      </h3>
                      <p className="text-gray-600 mb-6">{formatDate(event.start_date.split('T')[0])}</p>
                      <span className="text-[#80ccd6] font-medium group-hover:underline">
                        Learn More →
                      </span>
                    </div>
                  </a>
                ))
              )}
            </div>

            <div className="text-center mt-16">
              <a
                href="https://youkeepmoving.com/events"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block px-12 py-5 bg-[#80ccd6] text-white font-semibold text-xl rounded-full hover:bg-[#80ccd6]/90 transition shadow-lg"
              >
                View Full Calendar →
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // —— FULL RESULTS VIEW (event-specific) ——
  if (!selectedEvent || !selectedEvent.date) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-2xl text-gray-600">Loading race details...</p>
      </div>
    );
  }

  const formattedDate = formatDate(selectedEvent.date);
  const todayStr = new Date().toISOString().split('T')[0];
  const isUpcoming = selectedEvent.date > todayStr;

  if (isUpcoming || results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center">
        <h2 className="text-4xl font-bold text-gemini-dark-gray mb-6">{selectedEvent.name}</h2>
        <p className="text-2xl text-gray-600 mb-4">{formattedDate}</p>
        <p className="text-xl text-gray-500">Results will be available after the race.</p>
      </div>
    );
  }

  let displayedRaces = races;
  if (raceSlug) {
    displayedRaces = races.filter(race => slugify(race.race_name) === raceSlug);
  }

  if (displayedRaces.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-2xl text-gray-600">No matching race found.</p>
      </div>
    );
  }

  const handleNameClick = (participant) => {
    let targetEvent = selectedEvent;
    let eventMaster = masterKey;
    let eventYear = year;

    if (!targetEvent || !eventMaster || !eventYear) {
      const participantEventId = participant.event_id || selectedEvent?.id;
      targetEvent = events.find(e => e.id === participantEventId);
      if (!targetEvent) {
        alert('Could not determine the race for this participant.');
        return;
      }
      eventMaster = Object.entries(masterGroups)
        .find(([_, ids]) => ids.includes(targetEvent.id))?.[0] || targetEvent.name;
      eventYear = targetEvent.date.split('-')[0];
      setSelectedEvent(targetEvent);
    }

    const participantRace = races.find(r => r.race_id === participant.race_id);
    const raceName = participantRace?.race_name || participant.race_name || 'overall';
    const masterSlug = slugify(eventMaster);
    const raceSlugPart = slugify(raceName);

    navigate(`/results/${masterSlug}/${eventYear}/${raceSlugPart}/bib/${participant.bib}`, {
      state: { participant, selectedEvent: targetEvent, results, eventLogos, ads },
      replace: true,
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white pt-24 pb-20">
      <div className="max-w-7xl mx-auto px-6">
        {/* Event Header */}
        <div className="text-center mb-16">
          {eventLogos[selectedEvent?.id] ? (
            <img
              src={eventLogos[selectedEvent.id]}
              alt="Event Logo"
              className="mx-auto max-h-40 mb-8 rounded-2xl shadow-2xl bg-white p-6"
            />
          ) : null}
          <h1 className="text-4xl md:text-6xl font-black text-gray-900 mb-4">
            {selectedEvent.name}
          </h1>
          <p className="text-xl text-gray-600">{formattedDate}</p>
          <div className="w-32 h-1 bg-[#80ccd6] mx-auto mt-8 rounded-full"></div>
        </div>

        {/* Race Tiles with Starters/Finishers */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-20">
          {displayedRaces.map((race) => {
            const raceResults = results.filter(r => r.race_id === race.race_id);
            const starters = raceResults.length;
            const finishers = raceResults.filter(r => r.chip_time && r.chip_time.trim() !== '').length;

            return (
              <button
                key={race.race_id}
                onClick={() => {
                  raceRefs.current[race.race_id]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                className="group bg-white border border-gray-200 rounded-3xl overflow-hidden shadow-lg hover:shadow-2xl hover:border-[#80ccd6] transition-all duration-300"
              >
                <div className="bg-gradient-to-br from-[#80ccd6]/20 to-[#80ccd6]/10 p-10 text-center">
                  <h3 className="text-2xl md:text-3xl font-bold text-gemini-dark-gray mb-6 group-hover:text-[#80ccd6] transition">
                    {race.race_name}
                  </h3>
                  <div className="space-y-3 text-gray-700">
                    <p className="text-lg">
                      <span className="font-bold text-xl">{starters}</span> Starters
                    </p>
                    <p className="text-lg">
                      <span className="font-bold text-xl">{finishers}</span> Finishers
                    </p>
                  </div>
                </div>
                <div className="py-5 text-center bg-gray-50">
                  <span className="text-[#80ccd6] font-semibold group-hover:underline">
                    View Results →
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {loadingResults ? (
          <div className="text-center py-32">
            <div className="inline-block animate-spin rounded-full h-20 w-20 border-t-4 border-[#80ccd6]"></div>
            <p className="mt-8 text-2xl text-gray-700">Loading results...</p>
          </div>
        ) : (
          <>
            {displayedRaces.map((race) => {
              const filters = raceFilters[race.race_id] || { search: '', gender: '', division: '' };
              const searchLower = (filters.search || '').toLowerCase();

              const filtered = results
                .filter(r => r.race_id === race.race_id)
                .filter(r => {
                  const nameLower = ((r.first_name || '') + ' ' + (r.last_name || '')).toLowerCase();
                  const bibStr = r.bib ? r.bib.toString() : '';
                  const matchesSearch = nameLower.includes(searchLower) || bibStr.includes(searchLower);
                  const matchesGender = !filters.gender || r.gender === filters.gender;
                  const matchesDivision = !filters.division || (r.age_group_name || '') === filters.division;
                  return matchesSearch && matchesGender && matchesDivision;
                });

              const sorted = [...filtered].sort((a, b) => (a.place || Infinity) - (b.place || Infinity));
              const page = currentPages[race.race_id] || 1;
              const start = (page - 1) * pageSize;
              const display = sorted.slice(start, start + pageSize);
              const totalPages = Math.ceil(sorted.length / pageSize);

              return (
                <section
                  key={race.race_id}
                  ref={el => (raceRefs.current[race.race_id] = el)}
                  data-race-id={race.race_id}
                  className="mb-32 bg-white rounded-3xl shadow-2xl overflow-hidden border border-[#80ccd6]/30"
                >
                  <div className="bg-gradient-to-r from-[#80ccd6] to-[#80ccd6]/70 py-8 px-10">
                    <h3 className="text-3xl md:text-4xl font-bold text-white text-center">
                      {race.race_name}
                    </h3>
                  </div>

                  {/* Filters */}
                  <div className="p-8 border-b border-gray-200">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <input
                        type="text"
                        placeholder="Search name or bib..."
                        value={filters.search}
                        onChange={e => setRaceFilters(p => ({
                          ...p,
                          [race.race_id]: { ...p[race.race_id], search: e.target.value }
                        }))}
                        className="px-6 py-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#80ccd6] transition"
                      />
                      <select
                        value={filters.gender}
                        onChange={e => setRaceFilters(p => ({
                          ...p,
                          [race.race_id]: { ...p[race.race_id], gender: e.target.value }
                        }))}
                        className="px-6 py-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#80ccd6] transition"
                      >
                        <option value="">All Genders</option>
                        <option value="M">Male</option>
                        <option value="F">Female</option>
                      </select>
                      <select
                        value={filters.division}
                        onChange={e => setRaceFilters(p => ({
                          ...p,
                          [race.race_id]: { ...p[race.race_id], division: e.target.value }
                        }))}
                        className="px-6 py-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#80ccd6] transition"
                      >
                        <option value="">All Divisions</option>
                        {uniqueDivisions.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                    {(filters.search || filters.gender || filters.division) && (
                      <div className="text-center mt-8">
                        <button
                          onClick={() => setRaceFilters(p => ({
                            ...p,
                            [race.race_id]: { search: '', gender: '', division: '' }
                          }))}
                          className="text-[#80ccd6] hover:underline font-medium"
                        >
                          Clear filters
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Results Table */}
                  <div className="overflow-x-auto">
                    <div className="md:hidden">
                      <ResultsTable data={display} onNameClick={handleNameClick} isMobile={true} />
                    </div>
                    <div className="hidden md:block">
                      <ResultsTable data={display} onNameClick={handleNameClick} isMobile={false} />
                    </div>
                  </div>

                  {/* Pagination */}
                  {sorted.length > pageSize && (
                    <div className="flex flex-col sm:flex-row justify-center items-center gap-6 mt-12 p-8 bg-gray-50">
                      <button
                        onClick={() => setCurrentPages(p => ({
                          ...p,
                          [race.race_id]: Math.max(1, (p[race.race_id] || 1) - 1)
                        }))}
                        disabled={page === 1}
                        className="px-10 py-4 bg-[#80ccd6] text-white rounded-full font-bold disabled:opacity-50 hover:bg-[#80ccd6]/90 transition shadow-lg"
                      >
                        ← Previous
                      </button>
                      <span className="text-gray-700 text-lg">
                        Page {page} of {totalPages} • {sorted.length} runners
                      </span>
                      <button
                        onClick={() => setCurrentPages(p => ({
                          ...p,
                          [race.race_id]: page + 1
                        }))}
                        disabled={page >= totalPages}
                        className="px-10 py-4 bg-[#80ccd6] text-white rounded-full font-bold disabled:opacity-50 hover:bg-[#80ccd6]/90 transition shadow-lg"
                      >
                        Next →
                      </button>
                    </div>
                  )}
                </section>
              );
            })}

            {/* Sponsors */}
            {ads.length > 0 && (
              <section className="mt-20">
                <h3 className="text-4xl font-bold text-center mb-12 text-gray-800">
                  Event Sponsors
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                  {ads.map((ad, i) => (
                    <div key={i} className="bg-white rounded-3xl shadow-xl overflow-hidden border border-[#80ccd6]/20 hover:shadow-2xl transition">
                      <img src={ad} alt="Sponsor" className="w-full h-auto" />
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}