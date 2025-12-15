// src/pages/ResultsPage.jsx (UPDATED — Handles URL params for master/year/race, sets event/race)
import { useContext, useState, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ResultsTable from '../components/ResultsTable';
import { RaceContext } from '../context/RaceContext';

export default function ResultsPage() {
  const navigate = useNavigate();
  const { masterKey, year, raceSlug } = useParams(); // Removed bib, as participant route handles it

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

  // Load masterGroups from localStorage
  const masterGroups = JSON.parse(localStorage.getItem('masterGroups')) || {};

  const [pageSize] = useState(10);
  const [currentPages, setCurrentPages] = useState({});
  const [raceFilters, setRaceFilters] = useState({});
  const raceRefs = useRef({});

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

    // Decode and un-slugify for comparison
    const decodedMaster = decodeURIComponent(masterKey).replace(/-/g, ' ');

    const groupEventIds = Object.entries(masterGroups)
      .find(([key]) => slugify(key) === masterKey || key.toLowerCase() === decodedMaster)?.[1] || [];

    const yearEvents = events
      .filter(e => groupEventIds.includes(e.id) && e.date.startsWith(year))
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    if (yearEvents.length === 0) return;

    const targetEvent = yearEvents[0];
    if (targetEvent.id !== selectedEvent?.id) {
      setSelectedEvent(targetEvent);
    }
  }, [masterKey, year, events, masterGroups, selectedEvent, setSelectedEvent]);

  // —— NO EVENT SELECTED → Recent races landing ——
  if (!selectedEvent) {
    const recentEvents = [...events]
      .filter(e => e.date && new Date(e.date) <= new Date())
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 6);

    const goToRaceResults = (event) => {
      const eventMaster = Object.entries(masterGroups).find(([_, ids]) => ids.includes(event.id))?.[0];
      const eventYear = event.date.split('-')[0];
      if (eventMaster && eventYear) {
        const masterSlug = slugify(eventMaster);
        navigate(`/results/${masterSlug}/${eventYear}`);
      } else {
        setSelectedEvent(event); // Fallback, no URL change if no master
      }
    };

    return (
      <div className="min-h-screen bg-gradient-to-b from-gemini-light-gray to-white pt-32 pb-20 px-4">
        <div className="w-full max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black text-gemini-dark-gray leading-tight">
              Race Results
            </h1>
            <p className="mt-6 text-lg sm:text-xl md:text-2xl text-gray-700 max-w-3xl mx-auto">
              Select a race below to view live results, leaderboards, and participant details
            </p>
          </div>

          {recentEvents.length > 0 ? (
            <>
              <h2 className="text-3xl sm:text-4xl font-bold text-center text-gemini-dark-gray mb-12">
                Recent Races
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                {recentEvents.map((event) => (
                  <button
                    key={event.id}
                    onClick={() => goToRaceResults(event)}
                    className="group bg-white rounded-3xl shadow-xl overflow-hidden hover:shadow-2xl hover:scale-105 transition-all duration-300"
                  >
                    <div className="h-48 bg-gray-50 p-6 flex items-center justify-center">
                      {eventLogos[event.id] ? (
                        <img
                          src={eventLogos[event.id]}
                          alt={`${event.name} Logo`}
                          className="max-h-36 max-w-full object-contain"
                          loading="eager"
                        />
                      ) : (
                        <div className="text-6xl opacity-30 group-hover:opacity-50">🏁</div>
                      )}
                    </div>
                    <div className="p-8 text-center">
                      <h3 className="text-xl sm:text-2xl font-bold text-gemini-dark-gray mb-3 group-hover:text-gemini-blue transition">
                        {event.name}
                      </h3>
                      <p className="text-base sm:text-lg text-gray-600 mb-6">
                        {formatDate(event.date)}
                      </p>
                      <span className="inline-block bg-gemini-blue text-white px-6 py-3 rounded-full font-semibold text-sm sm:text-base hover:bg-gemini-blue/90 transition">
                        View Results →
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-20">
              <p className="text-2xl text-gray-600 mb-4">No recent races available</p>
              <p className="text-lg text-gray-500">Check back soon for live results!</p>
            </div>
          )}

          <div className="text-center mt-20">
            <p className="text-lg text-gray-600 mb-6">Or use the search bar above to find any race</p>
            <div className="text-6xl">🔍</div>
          </div>
        </div>
      </div>
    );
  }

  // —— FULL RESULTS VIEW ——
  if (!selectedEvent || !selectedEvent.date) {
    return (
      <div className="text-center py-24">
        <p className="text-2xl text-gray-600">Loading race details...</p>
      </div>
    );
  }

  const formattedDate = formatDate(selectedEvent.date);

  // Filter races if raceSlug is provided
  let displayedRaces = races;
  if (raceSlug) {
    displayedRaces = races.filter(race => slugify(race.race_name) === raceSlug);
  }

  if (displayedRaces.length === 0) {
    return (
      <div className="text-center py-24">
        <p className="text-2xl text-gray-600">No matching race found.</p>
      </div>
    );
  }

  const handleNameClick = (participant) => {
    let targetEvent = selectedEvent;
    let eventMaster = masterKey;
    let eventYear = year;

    if (!targetEvent || !eventMaster || !eventYear) {
      // Find event from results or events list
      const participantEventId = participant.event_id || selectedEvent?.id;
      targetEvent = events.find(e => e.id === participantEventId);

      if (!targetEvent) {
        alert('Could not determine the race for this participant.');
        return;
      }

      eventMaster = Object.entries(masterGroups)
        .find(([_, ids]) => ids.includes(targetEvent.id))?.[0];

      eventYear = targetEvent.date.split('-')[0];

      if (!eventMaster || !eventYear) {
        alert('This race is not assigned to a master event yet.');
        return;
      }

      setSelectedEvent(targetEvent);
    }

    // Find the correct race name using race_id from participant
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
    <div className="min-h-screen bg-gradient-to-b from-gemini-light-gray to-white pt-32 pb-20 px-4">
      <div className="w-full max-w-7xl mx-auto">
        {error && <p className="text-center text-2xl text-gemini-red mb-8">{error}</p>}
        {loadingResults ? (
          <div className="text-center py-20">
            <p className="text-3xl text-gemini-dark-gray mb-4">Loading Results...</p>
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-gemini-blue mx-auto"></div>
          </div>
        ) : (
          <>
            <div className="text-center mb-16">
              <img
                src={eventLogos[selectedEvent.id] || '/GRR.png'}
                alt="Event Logo"
                className="mx-auto max-h-40 mb-6 rounded-lg shadow-md"
              />
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-gemini-dark-gray mb-4">
                {selectedEvent.name}
              </h1>
              <p className="text-xl sm:text-2xl text-gray-700">{formattedDate}</p>
            </div>

            {displayedRaces.map((race) => {
              const filters = raceFilters[race.race_id] || { search: '', gender: '', division: '' };
              const filtered = results.filter(r => r.race_id === race.race_id).filter(r => {
                const matchesSearch = (r.first_name + ' ' + r.last_name).toLowerCase().includes(filters.search.toLowerCase()) ||
                  (r.bib && r.bib.toString().includes(filters.search));
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
                <section key={race.race_id} ref={el => (raceRefs.current[race.race_id] = el)} className="mb-20 scroll-mt-32">
                  <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center text-gemini-dark-gray mb-8 md:mb-10">
                    {race.race_name}
                  </h3>

                  {/* Filters */}
                  <div className="w-full bg-white rounded-2xl shadow-lg p-6 mb-8 md:mb-10">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <input
                        type="text"
                        placeholder="Search by name or bib..."
                        value={filters.search}
                        onChange={e => setRaceFilters(p => ({
                          ...p,
                          [race.race_id]: { ...p[race.race_id], search: e.target.value }
                        }))}
                        className="p-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-gemini-blue"
                      />
                      <select
                        value={filters.gender}
                        onChange={e => setRaceFilters(p => ({
                          ...p,
                          [race.race_id]: { ...p[race.race_id], gender: e.target.value }
                        }))}
                        className="p-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-gemini-blue"
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
                        className="p-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-gemini-blue"
                      >
                        <option value="">All Divisions</option>
                        {uniqueDivisions.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                    {(filters.search || filters.gender || filters.division) && (
                      <button
                        onClick={() => setRaceFilters(p => ({
                          ...p,
                          [race.race_id]: { search: '', gender: '', division: '' }
                        }))}
                        className="mt-4 text-gemini-red hover:underline font-medium"
                      >
                        Clear all filters
                      </button>
                    )}
                  </div>

                  {/* Results Table — Responsive */}
                  <div className="w-full">
                    <div className="md:hidden">
                      <ResultsTable data={display} onNameClick={handleNameClick} isMobile={true} />
                    </div>
                    <div className="hidden md:block">
                      <ResultsTable data={display} onNameClick={handleNameClick} isMobile={false} />
                    </div>
                  </div>

                  {/* Pagination */}
                  {sorted.length > pageSize && (
                    <div className="text-center mt-10 md:mt-12">
                      <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
                        <button
                          onClick={() => setCurrentPages(p => ({
                            ...p,
                            [race.race_id]: Math.max(1, (p[race.race_id] || 1) - 1)
                          }))}
                          disabled={page === 1}
                          className="px-8 py-4 bg-gemini-blue text-white rounded-xl font-semibold disabled:bg-gray-300 hover:bg-gemini-blue/90 transition"
                        >
                          ← Previous
                        </button>
                        <span className="text-lg font-medium">
                          Page {page} of {totalPages} ({sorted.length} results)
                        </span>
                        <button
                          onClick={() => setCurrentPages(p => ({
                            ...p,
                            [race.race_id]: page + 1
                          }))}
                          disabled={page >= totalPages}
                          className="px-8 py-4 bg-gemini-blue text-white rounded-xl font-semibold disabled:bg-gray-300 hover:bg-gemini-blue/90 transition"
                        >
                          Next →
                        </button>
                      </div>
                    </div>
                  )}
                </section>
              );
            })}

            {/* Sponsors */}
            {ads.length > 0 && (
              <section className="mt-20 w-full">
                <h3 className="text-3xl font-bold text-center text-gemini-dark-gray mb-10">
                  Our Sponsors
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {ads.map((ad, i) => (
                    <div key={i} className="bg-white rounded-2xl shadow-xl overflow-hidden">
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