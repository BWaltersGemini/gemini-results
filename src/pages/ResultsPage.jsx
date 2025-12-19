// src/pages/ResultsPage.jsx (FINAL COMPLETE — Rich UX + Year Dropdown Always Visible)
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
  } = useContext(RaceContext);

  const masterGroups = JSON.parse(localStorage.getItem('masterGroups')) || {};
  const editedEvents = JSON.parse(localStorage.getItem('editedEvents')) || {};
  const hiddenMasters = JSON.parse(localStorage.getItem('hiddenMasters')) || [];

  const [pageSize] = useState(10);
  const [currentPages, setCurrentPages] = useState({});
  const [raceFilters, setRaceFilters] = useState({});
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

  // Event selection logic
  useEffect(() => {
    if (!masterKey || !year || events.length === 0 || Object.keys(masterGroups).length === 0) return;

    const normalizedUrlKey = decodeURIComponent(masterKey).toLowerCase();
    const storedMasterKey = Object.keys(masterGroups).find(
      (key) => key.toLowerCase() === normalizedUrlKey || slugify(key) === masterKey.toLowerCase()
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
      navigate(location.pathname, { replace: true, state: {} });
      setTimeout(() => {
        raceRefs.current[autoFilterRaceId]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);
    }
  }, [location.state, selectedEvent, navigate]);

  // === YEAR SELECTOR LOGIC — ALWAYS SHOW ===
  let availableYears = [];
  if (masterKey && Object.keys(masterGroups).length > 0) {
    const normalizedUrlKey = decodeURIComponent(masterKey).toLowerCase();
    const storedMasterKey = Object.keys(masterGroups).find(
      (key) => key.toLowerCase() === normalizedUrlKey || slugify(key) === masterKey.toLowerCase()
    );
    if (storedMasterKey) {
      const ids = masterGroups[storedMasterKey] || [];
      const masterEvents = ids.map((id) => events.find((e) => e.id.toString() === id)).filter(Boolean);
      availableYears = [...new Set(masterEvents.map(getYearFromEvent))].filter(Boolean).sort((a, b) => b - a);
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

  // MASTER LANDING PAGE
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
      .filter(Boolean);

    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white pt-32 pb-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h1 className="text-5xl md:text-6xl font-black text-gemini-dark-gray mb-4">Race Results</h1>
            <p className="text-xl text-gray-600">Select a race series to view results</p>
          </div>
          {masterEventTiles.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
              {masterEventTiles.map((master) => (
                <Link
                  key={master.storedKey}
                  to={`/results/${master.masterSlug}/${master.latestYear}`}
                  className="group bg-white rounded-3xl shadow-xl overflow-hidden hover:shadow-2xl hover:scale-105 transition-all duration-300"
                >
                  <div className="h-72 bg-gray-50 flex items-center justify-center p-8">
                    {master.logo ? (
                      <img src={master.logo} alt={master.displayName} className="max-h-56 max-w-full object-contain" />
                    ) : (
                      <span className="text-9xl text-gray-300 group-hover:text-gemini-blue transition">🏁</span>
                    )}
                  </div>
                  <div className="p-10 text-center">
                    <h3 className="text-2xl md:text-3xl font-bold text-gemini-dark-gray mb-4 group-hover:text-gemini-blue transition">
                      {master.displayName}
                    </h3>
                    <p className="text-lg text-gray-600 mb-6">Latest: {formatDate(master.dateEpoch)}</p>
                    <span className="text-gemini-blue font-bold group-hover:underline">View Results →</span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-600 text-xl mt-20">No race series configured yet.</p>
          )}
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

          {/* YEAR DROPDOWN — ALWAYS VISIBLE */}
          {availableYears.length > 0 && (
            <div className="inline-flex flex-col items-center gap-6 bg-white rounded-2xl shadow-2xl p-8">
              <span className="text-2xl font-bold text-gemini-dark-gray">Select Year</span>
              <select
                value={year || availableYears[0]}
                onChange={(e) => handleYearChange(e.target.value)}
                className="px-12 py-5 text-2xl font-bold rounded-xl border-4 border-gemini-blue bg-white shadow-xl hover:shadow-2xl transition focus:outline-none cursor-pointer"
              >
                {availableYears.map((y) => (
                  <option key={y} value={y} className="text-xl">
                    {y}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Race Tiles */}
        {displayedRaces.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-20">
            {displayedRaces.map((race) => {
              const raceResults = results.filter((r) => r.race_id === race.race_id);
              const starters = raceResults.length;
              const finishers = raceResults.filter((r) => r.chip_time && r.chip_time.trim() !== '').length;

              return (
                <button
                  key={race.race_id}
                  onClick={() => raceRefs.current[race.race_id]?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                  className="group bg-white border border-gray-200 rounded-3xl overflow-hidden shadow-lg hover:shadow-2xl hover:border-gemini-blue transition-all duration-300"
                >
                  <div className="bg-gradient-to-br from-gemini-blue/20 to-gemini-blue/10 p-10 text-center">
                    <h3 className="text-2xl md:text-3xl font-bold text-gemini-dark-gray mb-6 group-hover:text-gemini-blue transition">
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
                    <span className="text-gemini-blue font-semibold group-hover:underline">View Results →</span>
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
              const filters = raceFilters[race.race_id] || { search: '', gender: '', division: '' };
              const searchLower = (filters.search || '').toLowerCase();
              const raceResults = results.filter((r) => r.race_id === race.race_id);
              const filtered = raceResults.filter((r) => {
                const nameLower = ((r.first_name || '') + ' ' + (r.last_name || '')).toLowerCase();
                const bibStr = r.bib ? r.bib.toString() : '';
                const matchesSearch = nameLower.includes(searchLower) || bibStr.includes(searchLower);
                const matchesGender = !filters.gender || r.gender === filters.gender;
                const matchesDivision = !filters.division || r.age_group_name === filters.division;
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
                  ref={(el) => (raceRefs.current[race.race_id] = el)}
                  className="mb-32 bg-white rounded-3xl shadow-2xl overflow-hidden border border-gemini-blue/30"
                >
                  <div className="bg-gradient-to-r from-gemini-blue to-gemini-blue/70 py-8 px-10">
                    <h3 className="text-3xl md:text-4xl font-bold text-white text-center">
                      {editedEvents[selectedEvent.id]?.races?.[race.race_id] || race.race_name}
                    </h3>
                  </div>

                  {/* Filters */}
                  <div className="p-8 border-b border-gray-200">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <input
                        type="text"
                        placeholder="Search by name or bib..."
                        value={filters.search}
                        onChange={(e) =>
                          setRaceFilters((p) => ({
                            ...p,
                            [race.race_id]: { ...p[race.race_id], search: e.target.value },
                          }))
                        }
                        className="px-6 py-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-gemini-blue transition"
                      />
                      <select
                        value={filters.gender}
                        onChange={(e) =>
                          setRaceFilters((p) => ({
                            ...p,
                            [race.race_id]: { ...p[race.race_id], gender: e.target.value },
                          }))
                        }
                        className="px-6 py-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-gemini-blue transition"
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
                            [race.race_id]: { ...p[race.race_id], division: e.target.value },
                          }))
                        }
                        className="px-6 py-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-gemini-blue transition"
                      >
                        <option value="">All Divisions</option>
                        {uniqueDivisions.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </div>
                    {(filters.search || filters.gender || filters.division) && (
                      <div className="text-center mt-8">
                        <button
                          onClick={() =>
                            setRaceFilters((p) => ({
                              ...p,
                              [race.race_id]: { search: '', gender: '', division: '' },
                            }))
                          }
                          className="text-gemini-blue hover:underline font-medium"
                        >
                          Clear all filters
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
                        onClick={() =>
                          setCurrentPages((p) => ({
                            ...p,
                            [race.race_id]: Math.max(1, (p[race.race_id] || 1) - 1),
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
                            [race.race_id]: page + 1,
                          }))
                        }
                        disabled={page >= totalPages}
                        className="px-10 py-4 bg-gemini-blue text-white rounded-full font-bold disabled:opacity-50 hover:bg-gemini-blue/90 transition shadow-lg"
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