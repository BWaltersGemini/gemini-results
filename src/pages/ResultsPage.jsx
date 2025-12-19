// src/pages/ResultsPage.jsx (FINAL — With blue Back to Top arrow)
import { useContext, useState, useRef, useEffect } from 'react';
import { useNavigate, useParams, useLocation, Link } from 'react-router-dom';
import ResultsTable from '../components/ResultsTable';
import { RaceContext } from '../context/RaceContext';
import { formatChronoTime } from '../utils/timeUtils';

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
  const [showFiltersForRace, setShowFiltersForRace] = useState({});

  // Sticky Bib/Name search
  const [searchQuery, setSearchQuery] = useState('');
  const prevMasterKeyRef = useRef(masterKey);

  useEffect(() => {
    if (masterKey && masterKey !== prevMasterKeyRef.current) {
      setSearchQuery('');
      prevMasterKeyRef.current = masterKey;
    }
  }, [masterKey]);

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

  // Event selection logic
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

  // Auto-scroll from participant page
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

  // Available years
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
    if (newYear === year) return;
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

  // Global filtered results
  const globalFilteredResults = searchQuery
    ? results.filter(r =>
        r.bib?.toString().includes(searchQuery) ||
        `${r.first_name || ''} ${r.last_name || ''}`.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : results;

  // Races with finishers
  const embeddedRaces = selectedEvent?.races || [];
  const racesWithFinishers = embeddedRaces.filter((race) =>
    globalFilteredResults.some((r) => r.race_id === race.race_id && r.chip_time && r.chip_time.trim() !== '')
  );

  let displayedRaces = racesWithFinishers;
  if (raceSlug) {
    displayedRaces = racesWithFinishers.filter((race) => slugify(race.race_name) === raceSlug);
  }

  // Master logo
  const currentMasterKey = Object.keys(masterGroups).find(key =>
    masterGroups[key]?.includes(selectedEvent?.id?.toString())
  );
  const masterLogo = currentMasterKey ? eventLogos[currentMasterKey] : null;
  const fallbackLogo = selectedEvent ? eventLogos[selectedEvent.id] : null;
  const displayLogo = masterLogo || fallbackLogo;

  // MASTER LANDING PAGE
  if (!selectedEvent) {
    // unchanged
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white pt-32 pb-20 relative">
      <div className="max-w-7xl mx-auto px-6">
        {/* Full Header — Hidden when searching */}
        {!searchQuery && (
          <div className="text-center mb-16">
            {displayLogo ? (
              <div className="mx-auto max-w-md mb-10">
                <img
                  src={displayLogo}
                  alt="Event Series Logo"
                  className="w-full h-auto max-h-64 object-contain drop-shadow-2xl"
                />
              </div>
            ) : (
              <div className="h-32 mb-10" />
            )}

            <h1 className="text-4xl md:text-6xl font-black text-gray-900 mb-4">
              {editedEvents[selectedEvent.id]?.name || selectedEvent.name}
            </h1>
            <p className="text-xl text-gray-600 mb-12">{formatDate(selectedEvent.start_time)}</p>

            {/* Year Buttons */}
            {availableYears.length > 0 && (
              <div className="flex flex-wrap justify-center gap-3 mb-12">
                <span className="text-xl font-bold text-gray-700 self-center mr-4">Year:</span>
                {availableYears.map((y) => (
                  <button
                    key={y}
                    onClick={() => handleYearChange(y)}
                    className={`px-6 py-3 rounded-full font-bold text-lg transition ${
                      y === year
                        ? 'bg-gemini-blue text-white shadow-lg'
                        : 'bg-white text-gray-700 border-2 border-gray-300 hover:border-gemini-blue hover:text-gemini-blue'
                    }`}
                  >
                    {y}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Search Bar */}
        <div className={`w-full max-w-2xl mx-auto mb-12 transition-all duration-500 ${searchQuery ? 'fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-white shadow-2xl rounded-full px-6 py-4 max-w-full w-11/12' : ''}`}>
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Bib or Name..."
              className="w-full px-6 py-4 text-lg text-gray-900 placeholder-gray-500 border-2 border-gray-300 rounded-full focus:outline-none focus:ring-4 focus:ring-gemini-blue/50 focus:border-gemini-blue shadow-inner"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-14 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            )}
          </div>
          {searchQuery && (
            <p className="text-center mt-4 text-gray-700 font-medium">
              {globalFilteredResults.length} result{globalFilteredResults.length !== 1 ? 's' : ''} found
            </p>
          )}
        </div>

        {/* Race Tiles — Hidden when searching */}
        {!searchQuery && displayedRaces.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-20">
            {displayedRaces.map((race) => {
              const raceResults = globalFilteredResults.filter((r) => r.race_id === race.race_id);
              const finishers = raceResults.filter((r) => r.chip_time && r.chip_time.trim() !== '').length;
              return (
                <button
                  key={race.race_id}
                  onClick={() => raceRefs.current[race.race_id]?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                  className="group bg-white rounded-2xl shadow-lg hover:shadow-2xl hover:scale-105 transition-all duration-300 border border-gray-200"
                >
                  <div className="p-6 md:p-8 text-center">
                    <h3 className="text-xl md:text-2xl font-bold text-gemini-dark-gray mb-4 group-hover:text-gemini-blue transition">
                      {editedEvents[selectedEvent.id]?.races?.[race.race_id] || race.race_name}
                    </h3>
                    <p className="text-base text-gray-700">
                      <span className="font-bold text-lg text-gemini-blue">{finishers}</span> Finishers
                    </p>
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
              const raceResults = globalFilteredResults.filter((r) => r.race_id === raceId);
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

                  {/* Mobile Filters Toggle */}
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
                    <div className="flex flex-col sm:flex-row justify-center items-center gap-6 mt-12 p-8 bg-gray-50 rounded-b-3xl">
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

                  {/* Back to Top */}
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

      {/* Blue Back to Top Arrow — Fixed bottom right */}
      <button
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className="fixed bottom-8 right-8 bg-gemini-blue text-white w-14 h-14 rounded-full shadow-2xl flex items-center justify-center text-3xl hover:bg-gemini-blue/90 transition z-40"
        aria-label="Back to top"
      >
        ↑
      </button>
    </div>
  );
}