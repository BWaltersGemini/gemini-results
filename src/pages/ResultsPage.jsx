// src/pages/ResultsPage.jsx (FINAL — Mobile Improvements + 3 Recent Masters + Upcoming Events)
import { useContext, useState, useRef, useEffect } from 'react';
import { useNavigate, useParams, useLocation, Link } from 'react-router-dom';
import ResultsTable from '../components/ResultsTable';
import { RaceContext } from '../context/RaceContext';

export default function ResultsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { masterKey, year, raceSlug } = useParams();

  const {
    selectedEvent,
    events = [],
    results = [],
    loadingResults,
    uniqueDivisions = [],
    eventLogos = {},
    ads = [],
    setSelectedEvent,
    masterGroups = {},
    editedEvents = {},
    hiddenMasters = [],
  } = useContext(RaceContext);

  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [loadingUpcoming, setLoadingUpcoming] = useState(true);

  const [pageSize] = useState(10);
  const [currentPages, setCurrentPages] = useState({});
  const [raceFilters, setRaceFilters] = useState({});
  const [showFiltersForRace, setShowFiltersForRace] = useState({}); // per-race toggle
  const raceRefs = useRef({});

  const slugify = (text) => {
    if (!text || typeof text !== 'string') return 'overall';
    return text.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  };

  const formatDate = (epoch) => {
    if (!epoch || isNaN(epoch)) return 'Date TBD';
    const date = new Date(epoch * 1000);
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  const getYearFromEvent = (event) => {
    if (!event?.start_time) return null;
    return new Date(event.start_time * 1000).getFullYear().toString();
  };

  // Fetch upcoming events
  useEffect(() => {
    const fetchUpcoming = async () => {
      try {
        setLoadingUpcoming(true);
        const response = await fetch('https://youkeepmoving.com/wp-json/tribe/events/v1/events?per_page=6&status=publish');
        if (!response.ok) throw new Error('Failed');
        const data = await response.json();
        const futureEvents = (data.events || [])
          .filter(event => new Date(event.start_date) > new Date())
          .sort((a, b) => new Date(a.start_date) - new Date(b.start_date));
        setUpcomingEvents(futureEvents);
      } catch (err) {
        console.error('Failed to load upcoming events:', err);
        setUpcomingEvents([]);
      } finally {
        setLoadingUpcoming(false);
      }
    };
    fetchUpcoming();
  }, []);

  // Event selection
  useEffect(() => {
    if (!masterKey || !year || events.length === 0 || Object.keys(masterGroups).length === 0) return;

    const urlSlug = slugify(decodeURIComponent(masterKey));
    const storedMasterKey = Object.keys(masterGroups).find(
      (key) => slugify(key) === urlSlug
    );

    if (!storedMasterKey) return;

    const groupEventIds = masterGroups[storedMasterKey] || [];
    const yearEvents = events
      .filter((e) => groupEventIds.includes(e.id.toString()) && getYearFromEvent(e) === year)
      .sort((a, b) => (b.start_time || 0) - (a.start_time || 0));

    if (yearEvents.length > 0 && yearEvents[0].id !== selectedEvent?.id) {
      setSelectedEvent(yearEvents[0]);
    }
  }, [masterKey, year, events, masterGroups, selectedEvent, setSelectedEvent]);

  // Auto-scroll from participant
  useEffect(() => {
    if (location.state?.autoFilterDivision && location.state?.autoFilterRaceId && selectedEvent) {
      const { autoFilterDivision, autoFilterRaceId } = location.state;
      setRaceFilters((prev) => ({
        ...prev,
        [autoFilterRaceId]: { division: autoFilterDivision, gender: '', search: '' },
      }));
      setShowFiltersForRace((prev) => ({ ...prev, [autoFilterRaceId]: true }));
      navigate(location.pathname, { replace: true, state: {} });
      setTimeout(() => {
        raceRefs.current[autoFilterRaceId]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);
    }
  }, [location.state, selectedEvent, navigate]);

  // Year selector
  let availableYears = [];
  if (masterKey && Object.keys(masterGroups).length > 0) {
    const urlSlug = slugify(decodeURIComponent(masterKey));
    const storedMasterKey = Object.keys(masterGroups).find(
      (key) => slugify(key) === urlSlug
    );

    if (storedMasterKey) {
      const linkedEventIds = masterGroups[storedMasterKey] || [];
      const linkedEvents = events.filter(e => linkedEventIds.includes(e.id.toString()));
      availableYears = [...new Set(linkedEvents.map(getYearFromEvent))].filter(Boolean).sort((a, b) => b - a);
    }
  }

  const handleYearChange = (newYear) => {
    navigate(`/results/${masterKey}/${newYear}${raceSlug ? '/' + raceSlug : ''}`);
  };

  const handleNameClick = (participant) => {
    let targetEvent = selectedEvent;
    let eventMaster = masterKey;
    let eventYear = year;

    if (!targetEvent || !eventMaster || !eventYear) {
      const participantEventId = participant.event_id || selectedEvent?.id;
      targetEvent = events.find((e) => e.id === participantEventId);
      if (!targetEvent) return;
      eventMaster = Object.entries(masterGroups).find(([_, ids]) => ids.includes(targetEvent.id.toString()))?.[0] || targetEvent.name;
      eventYear = getYearFromEvent(targetEvent);
      setSelectedEvent(targetEvent);
    }

    const participantRace = selectedEvent.races?.find((r) => r.race_id === participant.race_id);
    const raceName = participantRace?.race_name || participant.race_name || 'overall';
    const masterSlug = slugify(eventMaster);
    const raceSlugPart = slugify(raceName);

    navigate(`/results/${masterSlug}/${eventYear}/${raceSlugPart}/bib/${participant.bib}`, {
      state: { participant, selectedEvent: targetEvent, results, eventLogos, ads },
      replace: true,
    });
  };

  // MASTER LANDING PAGE — 3 Most Recent + Upcoming Events
  if (!selectedEvent) {
    const visibleMasters = Object.keys(masterGroups).filter((key) => !hiddenMasters.includes(key));

    const masterEventTiles = visibleMasters
      .map((storedKey) => {
        const displayName = editedEvents[storedKey]?.name || storedKey;
        const eventIds = masterGroups[storedKey] || [];
        const masterEvents = events.filter((e) => eventIds.includes(e.id.toString()));
        if (masterEvents.length === 0) return null;
        const latestEvent = masterEvents.sort((a, b) => (b.start_time || 0) - (a.start_time || 0))[0];
        const logo = eventLogos[latestEvent.id] || eventLogos[storedKey];
        const masterSlug = slugify(storedKey);
        const latestYear = getYearFromEvent(latestEvent);
        return { storedKey, displayName, logo, dateEpoch: latestEvent.start_time, masterSlug, latestYear };
      })
      .filter(Boolean)
      .sort((a, b) => (b.dateEpoch || 0) - (a.dateEpoch || 0))
      .slice(0, 3);

    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white pt-32 pb-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h1 className="text-5xl md:text-6xl font-black text-gemini-dark-gray mb-4">Race Results</h1>
            <p className="text-xl text-gray-600">Recent race series</p>
          </div>

          {/* 3 Most Recent Masters */}
          {masterEventTiles.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20">
              {masterEventTiles.map((master) => (
                <Link
                  key={master.storedKey}
                  to={`/results/${master.masterSlug}/${master.latestYear}`}
                  className="group bg-white rounded-3xl shadow-xl overflow-hidden hover:shadow-2xl hover:scale-105 transition-all duration-300"
                >
                  <div className="h-64 bg-gray-50 flex items-center justify-center p-6">
                    {master.logo ? (
                      <img src={master.logo} alt={master.displayName} className="max-h-52 max-w-full object-contain" />
                    ) : (
                      <span className="text-8xl text-gray-300 group-hover:text-gemini-blue transition">🏁</span>
                    )}
                  </div>
                  <div className="p-8 text-center">
                    <h3 className="text-2xl md:text-3xl font-bold text-gemini-dark-gray mb-4 group-hover:text-gemini-blue transition">
                      {master.displayName}
                    </h3>
                    <p className="text-lg text-gray-600 mb-6">Latest: {formatDate(master.dateEpoch)}</p>
                    <span className="text-gemini-blue font-bold text-lg group-hover:underline">View Results →</span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-600 text-xl mb-20">No recent race series available.</p>
          )}

          {/* Upcoming Events */}
          <div className="mt-20">
            <h2 className="text-4xl font-bold text-center text-gemini-dark-gray mb-12">Upcoming Events</h2>
            {loadingUpcoming ? (
              <p className="text-center text-gray-600 text-xl">Loading upcoming events...</p>
            ) : upcomingEvents.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {upcomingEvents.map((event) => (
                  <a
                    key={event.id}
                    href={event.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group bg-white rounded-3xl shadow-xl overflow-hidden hover:shadow-2xl hover:scale-105 transition-all duration-300"
                  >
                    {event.image?.url ? (
                      <img
                        src={event.image.url}
                        alt={event.title.rendered || event.title}
                        className="w-full h-60 object-cover"
                      />
                    ) : (
                      <div className="h-60 bg-gray-200 flex items-center justify-center">
                        <span className="text-gray-500 font-medium">No Image</span>
                      </div>
                    )}
                    <div className="p-6">
                      <h3 className="text-xl font-bold text-gemini-dark-gray mb-2 line-clamp-2">
                        {event.title.rendered || event.title}
                      </h3>
                      <p className="text-gray-600 mb-4">
                        {new Date(event.start_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                      </p>
                      <span className="text-gemini-blue font-bold group-hover:underline">Register →</span>
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <p className="text-center text-gray-600 text-xl">No upcoming events at this time.</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Event Results Page
  const embeddedRaces = selectedEvent?.races || [];
  const racesWithFinishers = embeddedRaces.filter((race) =>
    results.some((r) => r.race_id === race.race_id && r.chip_time && r.chip_time.trim() !== '')
  );

  let displayedRaces = racesWithFinishers;
  if (raceSlug) {
    displayedRaces = racesWithFinishers.filter((race) => slugify(race.race_name) === raceSlug);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white pt-32 pb-20">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          {eventLogos[selectedEvent.id] && (
            <img
              src={eventLogos[selectedEvent.id]}
              alt="Event Logo"
              className="mx-auto max-h-40 mb-8 rounded-2xl shadow-2xl bg-white p-6"
            />
          )}
          <h1 className="text-4xl md:text-6xl font-black text-gray-900 mb-4">
            {editedEvents[selectedEvent.id]?.name || selectedEvent.name}
          </h1>
          <p className="text-xl text-gray-600 mb-12">{formatDate(selectedEvent.start_time)}</p>

          {/* YEAR DROPDOWN */}
          {availableYears.length > 0 && (
            <div className="inline-flex flex-col items-center gap-6 bg-white rounded-2xl shadow-2xl p-8">
              <span className="text-2xl font-bold text-gemini-dark-gray">Select Year</span>
              <select
                value={year || availableYears[0]}
                onChange={(e) => handleYearChange(e.target.value)}
                className="w-full md:w-auto px-8 py-4 text-xl font-bold rounded-xl border-4 border-gemini-blue bg-white shadow-xl hover:shadow-2xl transition focus:outline-none cursor-pointer"
              >
                {availableYears.map((y) => (
                  <option key={y} value={y} className="text-lg">
                    {y}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Race Tiles — Mobile Optimized */}
        {displayedRaces.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-20">
            {displayedRaces.map((race) => {
              const raceResults = results.filter((r) => r.race_id === race.race_id);
              const starters = raceResults.length;
              const finishers = raceResults.filter((r) => r.chip_time && r.chip_time.trim() !== '').length;

              return (
                <button
                  key={race.race_id}
                  onClick={() => raceRefs.current[race.race_id]?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                  className="group bg-white rounded-2xl shadow-lg hover:shadow-2xl hover:scale-105 transition-all duration-300 border border-gray-200"
                >
                  <div className="p-6 md:p-8 text-center">
                    <h3 className="text-xl md:text-2xl font-bold text-gemini-dark-gray mb-4 group-hover:text-gemini-blue transition">
                      {race.race_name}
                    </h3>
                    <div className="space-y-2 text-gray-700">
                      <p className="text-base">
                        <span className="font-bold text-lg">{starters}</span> Starters
                      </p>
                      <p className="text-base">
                        <span className="font-bold text-lg">{finishers}</span> Finishers
                      </p>
                    </div>
                  </div>
                  <div className="py-4 bg-gemini-blue/10 rounded-b-2xl">
                    <span className="text-gemini-blue font-bold text-lg">View Results →</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Loading / No Results */}
        {loadingResults ? (
          <div className="text-center py-32">
            <div className="inline-block animate-spin rounded-full h-20 w-20 border-t-4 border-gemini-blue"></div>
            <p className="mt-8 text-2xl text-gray-700">Loading results...</p>
          </div>
        ) : displayedRaces.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-2xl text-gray-600">No results available yet for this event.</p>
            <p className="text-lg text-gray-500 mt-4">Check back later when timing begins!</p>
          </div>
        ) : (
          <>
            {displayedRaces.map((race) => {
              const raceId = race.race_id;
              const filters = raceFilters[raceId] || { search: '', gender: '', division: '' };
              const showFilters = showFiltersForRace[raceId] || false;

              const raceResults = results.filter((r) => r.race_id === raceId);
              const filtered = raceResults.filter((r) => {
                const nameLower = ((r.first_name || '') + ' ' + (r.last_name || '')).toLowerCase();
                const bibStr = r.bib ? r.bib.toString() : '';
                const searchLower = filters.search.toLowerCase();
                const matchesSearch = nameLower.includes(searchLower) || bibStr.includes(searchLower);
                const matchesGender = !filters.gender || r.gender === filters.gender;
                const matchesDivision = !filters.division || r.age_group_name === filters.division;
                return matchesSearch && matchesGender && matchesDivision;
              });
              const sorted = [...filtered].sort((a, b) => (a.place || Infinity) - (b.place || Infinity));
              const page = currentPages[raceId] || 1;
              const start = (page - 1) * pageSize;
              const display = sorted.slice(start, start + pageSize);
              const totalPages = Math.ceil(sorted.length / pageSize);

              return (
                <section
                  key={raceId}
                  ref={(el) => (raceRefs.current[raceId] = el)}
                  className="mb-20 bg-white rounded-3xl shadow-2xl overflow-hidden border border-gemini-blue/30"
                >
                  <div className="bg-gradient-to-r from-gemini-blue to-gemini-blue/70 py-6 px-8">
                    <h3 className="text-2xl md:text-3xl font-bold text-white text-center">
                      {editedEvents[selectedEvent.id]?.races?.[raceId] || race.race_name}
                    </h3>
                  </div>

                  {/* Mobile: Collapsible Filters */}
                  <div className="p-6 border-b border-gray-200">
                    <button
                      onClick={() => setShowFiltersForRace(prev => ({ ...prev, [raceId]: !prev[raceId] }))}
                      className="w-full text-left flex justify-between items-center py-3 text-lg font-semibold text-gemini-blue"
                    >
                      <span>{showFilters ? 'Hide' : 'Show'} Filters</span>
                      <span className="text-2xl">{showFilters ? '−' : '+'}</span>
                    </button>

                    {showFilters && (
                      <div className="mt-4 space-y-4">
                        <input
                          type="text"
                          placeholder="Search by name or bib..."
                          value={filters.search}
                          onChange={(e) =>
                            setRaceFilters((p) => ({
                              ...p,
                              [raceId]: { ...p[raceId], search: e.target.value },
                            }))
                          }
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-gemini-blue"
                        />
                        <select
                          value={filters.gender}
                          onChange={(e) =>
                            setRaceFilters((p) => ({
                              ...p,
                              [raceId]: { ...p[raceId], gender: e.target.value },
                            }))
                          }
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-gemini-blue"
                        >
                          <option value="">All Genders</option>
                          <option value="M">Male</option>
                          <option value="F">Female</option>
                        </select>
                        <select
                          value={filters.division}
                          onChange={(e) =>
                            setRaceFilters((p) => ({
                              ...p,
                              [raceId]: { ...p[raceId], division: e.target.value },
                            }))
                          }
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-gemini-blue"
                        >
                          <option value="">All Divisions</option>
                          {uniqueDivisions.map((d) => (
                            <option key={d} value={d}>{d}</option>
                          ))}
                        </select>
                        {(filters.search || filters.gender || filters.division) && (
                          <button
                            onClick={() =>
                              setRaceFilters((p) => ({
                                ...p,
                                [raceId]: { search: '', gender: '', division: '' },
                              }))
                            }
                            className="w-full py-2 text-gemini-blue font-medium hover:underline"
                          >
                            Clear filters
                          </button>
                        )}
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
                        onClick={() =>
                          setCurrentPages((p) => ({
                            ...p,
                            [raceId]: Math.max(1, (p[raceId] || 1) - 1),
                          }))
                        }
                        disabled={page === 1}
                        className="px-10 py-4 bg-gemini-blue text-white rounded-full font-bold disabled:opacity-50 hover:bg-gemini-blue/90 transition shadow-lg"
                      >
                        ← Previous
                      </button>
                      <span className="text-gray-700 text-lg">
                        Page {page} of {totalPages} ({sorted.length} results)
                      </span>
                      <button
                        onClick={() =>
                          setCurrentPages((p) => ({
                            ...p,
                            [raceId]: page + 1,
                          }))
                        }
                        disabled={page >= totalPages}
                        className="px-10 py-4 bg-gemini-blue text-white rounded-full font-bold disabled:opacity-50 hover:bg-gemini-blue/90 transition shadow-lg"
                      >
                        Next →
                      </button>
                    </div>
                  )}

                  {/* Back to Top Button */}
                  {sorted.length > 30 && (
                    <div className="text-center py-8">
                      <button
                        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                        className="px-8 py-3 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition font-medium"
                      >
                        ↑ Back to Top
                      </button>
                    </div>
                  )}
                </section>
              );
            })}

            {/* Sponsors */}
            {ads.length > 0 && (
              <section className="mt-20">
                <h3 className="text-4xl font-bold text-center text-gray-800 mb-12">Our Sponsors</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                  {ads.map((ad, i) => (
                    <div
                      key={i}
                      className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gemini-blue/20 hover:shadow-2xl transition"
                    >
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