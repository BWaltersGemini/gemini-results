// src/pages/ResultsPage.jsx (FINAL — Auto-expand on pagination + clean UX)
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
    eventLogos = {},
    ads = [],
    setSelectedEvent,
    masterGroups = {},
    editedEvents = {},
    hiddenMasters = [],
    isLiveRace,
  } = useContext(RaceContext);

  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [loadingUpcoming, setLoadingUpcoming] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [liveToast, setLiveToast] = useState(null);

  // Highlight bib when navigating from ParticipantPage
  const highlightBibFromState = location.state?.highlightBib;
  const [highlightedBib, setHighlightedBib] = useState(highlightBibFromState || null);

  // Per-race toggle: Top 5 vs View All
  const [expandedRaces, setExpandedRaces] = useState({});

  // Per-race pagination state (currentPage & pageSize)
  const [racePagination, setRacePagination] = useState({});

  // Refs
  const resultsSectionRef = useRef(null);
  const backToTopRef = useRef(null);

  // Live results toast
  useEffect(() => {
    const handler = (e) => {
      const count = e.detail?.count || 1;
      setLiveToast({
        message: count === 1 ? '1 new finisher!' : `${count} new finishers!`,
      });
    };
    window.addEventListener('liveResultsUpdate', handler);
    return () => window.removeEventListener('liveResultsUpdate', handler);
  }, []);

  useEffect(() => {
    if (liveToast) {
      const timer = setTimeout(() => setLiveToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [liveToast]);

  // Reset state when switching master series
  const prevMasterKeyRef = useRef(masterKey);
  useEffect(() => {
    if (masterKey && masterKey !== prevMasterKeyRef.current) {
      setSearchQuery('');
      setHighlightedBib(null);
      setExpandedRaces({});
      setRacePagination({});
      prevMasterKeyRef.current = masterKey;
    }
  }, [masterKey]);

  // Reset pagination on search change
  useEffect(() => {
    setExpandedRaces({});
    setRacePagination({});
  }, [searchQuery]);

  // Scroll to results section after search
  useEffect(() => {
    if (searchQuery && resultsSectionRef.current) {
      resultsSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [searchQuery]);

  // Back-to-top button visibility
  useEffect(() => {
    const handleScroll = () => {
      if (backToTopRef.current) {
        const scrolled = window.scrollY || document.documentElement.scrollTop;
        backToTopRef.current.style.opacity = scrolled > 600 ? '1' : '0';
        backToTopRef.current.style.visibility = scrolled > 600 ? 'visible' : 'hidden';
        backToTopRef.current.style.pointerEvents = scrolled > 600 ? 'auto' : 'none';
      }
    };
    window.addEventListener('scroll', handleScroll);
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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

  // Fetch upcoming events from WordPress
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

  // Select event based on URL params
  useEffect(() => {
    if (!masterKey || !year || events.length === 0 || Object.keys(masterGroups).length === 0) return;

    const urlSlug = slugify(decodeURIComponent(masterKey));
    const storedMasterKey = Object.keys(masterGroups).find((key) => slugify(key) === urlSlug);
    if (!storedMasterKey) return;

    const groupEventIds = (masterGroups[storedMasterKey] || []).map(String);
    const yearEvents = events
      .filter((e) => e && e.id && groupEventIds.includes(String(e.id)) && getYearFromEvent(e) === year)
      .sort((a, b) => (b.start_time || 0) - (a.start_time || 0));

    if (yearEvents.length > 0 && yearEvents[0].id !== selectedEvent?.id) {
      setSelectedEvent(yearEvents[0]);
    }
  }, [masterKey, year, events, masterGroups, selectedEvent, setSelectedEvent]);

  // Global search filtering
  const globalFilteredResults = searchQuery
    ? results.filter(r =>
        r.bib?.toString().includes(searchQuery) ||
        `${r.first_name || ''} ${r.last_name || ''}`.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : results;

  // Determine which races to show
  const embeddedRaces = selectedEvent?.races || [];
  const racesWithAnyResults = embeddedRaces.filter((race) =>
    results.some((r) => r.race_id === race.race_id)
  );
  const racesWithFilteredResults = embeddedRaces.filter((race) =>
    globalFilteredResults.some((r) => r.race_id === race.race_id)
  );

  let displayedRaces = searchQuery ? racesWithFilteredResults : racesWithAnyResults;
  if (raceSlug) {
    displayedRaces = displayedRaces.filter((race) => slugify(race.race_name) === raceSlug);
  }

  // Logo logic
  const currentMasterKey = Object.keys(masterGroups).find(key => masterGroups[key]?.includes(String(selectedEvent?.id)));
  const masterLogo = currentMasterKey ? eventLogos[currentMasterKey] : null;
  const fallbackLogo = selectedEvent ? eventLogos[selectedEvent.id] : null;
  const displayLogo = masterLogo || fallbackLogo;

  // Finisher stats
  const finishers = results.filter(r => r.chip_time && r.chip_time.trim() !== '');
  const totalFinishers = finishers.length;
  const maleFinishers = finishers.filter(r => r.gender === 'M').length;
  const femaleFinishers = finishers.filter(r => r.gender === 'F').length;

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNameClick = (participant) => {
    if (!participant || !selectedEvent) return;

    let masterSlug = 'overall';
    const foundMaster = Object.entries(masterGroups).find(([_, ids]) => ids.includes(String(selectedEvent.id)));
    if (foundMaster) masterSlug = slugify(foundMaster[0]);

    const eventYear = getYearFromEvent(selectedEvent);
    const participantRace = selectedEvent.races?.find(r => r.race_id === participant.race_id);
    const raceName = participantRace?.race_name || participant.race_name || 'overall';
    const raceSlugPart = slugify(raceName);

    navigate(`/results/${masterSlug}/${eventYear}/${raceSlugPart}/bib/${participant.bib}`, {
      state: { participant, selectedEvent, results },
    });
  };

  // Available years for year selector
  let availableYears = [];
  if (currentMasterKey) {
    const linkedEventIds = (masterGroups[currentMasterKey] || []).map(String);
    const linkedEvents = events.filter(e => e && e.id && linkedEventIds.includes(String(e.id)));
    availableYears = [...new Set(linkedEvents.map(getYearFromEvent))].filter(Boolean).sort((a, b) => b - a);
  }

  const handleYearChange = (newYear) => {
    if (newYear === year) return;
    navigate(`/results/${masterKey}/${newYear}${raceSlug ? '/' + raceSlug : ''}`);
  };

  // MASTER SERIES LANDING PAGE (no specific event selected)
  if (!selectedEvent) {
    const visibleMasters = Object.keys(masterGroups).filter(key => !hiddenMasters.includes(key));

    const masterEventTiles = visibleMasters
      .map((storedKey) => {
        const displayName = editedEvents[storedKey]?.name || storedKey;
        const eventIds = (masterGroups[storedKey] || []).map(String);
        const masterEvents = events.filter(e => e && e.id && eventIds.includes(String(e.id)));
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
      <div className="min-h-screen bg-gradient-to-b from-brand-light to-white pt-32 pb-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h1 className="text-5xl md:text-6xl font-black text-brand-dark mb-4">Race Results</h1>
            <p className="text-xl text-gray-600">Recent race series</p>
          </div>

          {masterEventTiles.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20">
              {masterEventTiles.map((master) => (
                <Link
                  key={master.storedKey}
                  to={`/results/${master.masterSlug}/${master.latestYear}`}
                  className="group bg-white rounded-3xl shadow-xl overflow-hidden hover:shadow-2xl hover:scale-105 transition-all duration-300"
                >
                  <div className="h-64 bg-brand-light flex items-center justify-center p-6">
                    {master.logo ? (
                      <img src={master.logo} alt={master.displayName} className="max-h-52 max-w-full object-contain" />
                    ) : (
                      <span className="text-8xl text-gray-300 group-hover:text-primary transition">🏁</span>
                    )}
                  </div>
                  <div className="p-8 text-center">
                    <h3 className="text-2xl md:text-3xl font-bold text-brand-dark mb-4 group-hover:text-primary transition">
                      {master.displayName}
                    </h3>
                    <p className="text-lg text-gray-600 mb-6">Latest: {formatDate(master.dateEpoch)}</p>
                    <span className="text-primary font-bold text-lg group-hover:underline">View Results →</span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-600 text-xl mb-20">No recent race series available.</p>
          )}

          {/* Upcoming Events Section */}
          <div className="mt-20">
            <h2 className="text-4xl font-bold text-center text-brand-dark mb-12">Upcoming Events</h2>
            {loadingUpcoming ? (
              <p className="text-center text-gray-600 text-xl">Loading...</p>
            ) : upcomingEvents.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {upcomingEvents.map((event) => (
                  <a
                    key={event.id}
                    href={event.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group bg-white rounded-3xl shadow-xl overflow-hidden hover:shadow-2xl hover:scale-105 transition-all"
                  >
                    {event.image?.url ? (
                      <img src={event.image.url} alt={event.title.rendered || event.title} className="w-full h-60 object-cover" />
                    ) : (
                      <div className="h-60 bg-brand-light flex items-center justify-center">
                        <span className="text-gray-500 font-medium">No Image</span>
                      </div>
                    )}
                    <div className="p-6">
                      <h3 className="text-xl font-bold text-brand-dark mb-2 line-clamp-2">
                        {event.title.rendered || event.title}
                      </h3>
                      <p className="text-gray-600 mb-4">
                        {new Date(event.start_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                      </p>
                      <span className="text-accent font-bold group-hover:underline">Register →</span>
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

  // EVENT-SPECIFIC RESULTS PAGE
  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-light to-white">
      {/* Live Toast */}
      {liveToast && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white px-8 py-4 rounded-full shadow-2xl animate-pulse text-xl font-bold">
          {liveToast.message}
        </div>
      )}

      <div className="max-w-7xl mx-auto px-6 py-12 pt-32">
        {/* Sticky Search Bar */}
        <div className={`sticky top-32 z-40 bg-white shadow-lg rounded-full px-6 py-4 mb-12 transition-all ${searchQuery ? 'ring-4 ring-primary/30' : ''}`}>
          <div className="relative max-w-3xl mx-auto">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by bib or name..."
              className="w-full px-6 py-4 text-xl placeholder-gray-500 border-0 focus:outline-none text-brand-dark"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-6 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 text-3xl"
              >
                ×
              </button>
            )}
          </div>
          {searchQuery && (
            <p className="text-center mt-3 text-gray-700 font-medium">
              {globalFilteredResults.length} result{globalFilteredResults.length !== 1 ? 's' : ''} found
            </p>
          )}
        </div>

        {/* Event Header */}
        <div className="text-center mb-16">
          {displayLogo && (
            <img src={displayLogo} alt="Event logo" className="mx-auto max-h-48 mb-8 object-contain" />
          )}
          <h1 className="text-5xl md:text-6xl font-black text-brand-dark mb-4">
            {selectedEvent.name}
          </h1>
          <p className="text-2xl text-gray-600">{formatDate(selectedEvent.start_time)}</p>

          {availableYears.length > 1 && (
            <div className="mt-8">
              <select
                value={year}
                onChange={(e) => handleYearChange(e.target.value)}
                className="px-6 py-3 text-lg border border-gray-300 rounded-full focus:outline-none focus:ring-4 focus:ring-primary/30"
              >
                {availableYears.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Finisher Stats */}
        {totalFinishers > 0 && (
          <div className="grid grid-cols-3 gap-8 max-w-3xl mx-auto mb-16 text-center">
            <div className="bg-white rounded-2xl shadow-lg py-6">
              <div className="text-4xl font-bold text-primary">{totalFinishers}</div>
              <div className="text-gray-600">Total Finishers</div>
            </div>
            <div className="bg-white rounded-2xl shadow-lg py-6">
              <div className="text-4xl font-bold text-primary">{maleFinishers}</div>
              <div className="text-gray-600">Male</div>
            </div>
            <div className="bg-white rounded-2xl shadow-lg py-6">
              <div className="text-4xl font-bold text-primary">{femaleFinishers}</div>
              <div className="text-gray-600">Female</div>
            </div>
          </div>
        )}

        {/* Race Jump Links */}
        {displayedRaces.length > 1 && (
          <div className="flex flex-wrap justify-center gap-4 mb-12">
            {displayedRaces.map((race) => (
              <a
                key={race.race_id}
                href={`#race-${race.race_id}`}
                className="px-6 py-3 bg-gray-100 rounded-full hover:bg-primary hover:text-white transition font-medium"
              >
                {editedEvents[selectedEvent.id]?.races?.[race.race_id] || race.race_name}
              </a>
            ))}
          </div>
        )}

        {/* Results Sections */}
        <div ref={resultsSectionRef}>
          {displayedRaces.length === 0 ? (
            <div className="text-center py-32">
              <div className="text-6xl mb-8">🏁</div>
              {searchQuery ? (
                <>
                  <h2 className="text-4xl font-bold text-brand-dark mb-4">
                    No participants found matching "{searchQuery}"
                  </h2>
                  <p className="text-2xl text-gray-600">Try a different bib number or name.</p>
                </>
              ) : (
                <>
                  <h2 className="text-4xl font-bold text-brand-dark mb-4">No Results Yet</h2>
                  <p className="text-2xl text-gray-600 mb-8">
                    {isLiveRace ? 'The race is live — finishers will appear here soon!' : 'Timing has not started yet.'}
                  </p>
                  {isLiveRace && (
                    <div className="flex items-center justify-center gap-4 text-2xl text-green-600 font-bold">
                      <div className="w-4 h-4 bg-green-600 rounded-full animate-ping"></div>
                      Live Updates Active
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            displayedRaces.map((race) => {
              const raceResults = globalFilteredResults.filter(r => r.race_id === race.race_id);
              const sorted = [...raceResults].sort((a, b) => (a.place || Infinity) - (b.place || Infinity));

              const isExpanded = expandedRaces[race.race_id];
              const tableData = isExpanded ? sorted : sorted.slice(0, 5);

              // Safely update page — auto-expand if going beyond top 5
              const updatePage = (newPage) => {
                if (newPage > 1 && !isExpanded) {
                  setExpandedRaces(prev => ({ ...prev, [race.race_id]: true }));
                }
                setRacePagination(prev => ({
                  ...prev,
                  [race.race_id]: { ...prev[race.race_id], currentPage: newPage }
                }));
              };

              // Safely update page size — auto-expand if needed
              const updatePageSize = (newSize) => {
                const currentPag = racePagination[race.race_id] || { currentPage: 1 };
                const newFirstIndex = (currentPag.currentPage - 1) * newSize;
                if (newFirstIndex >= 5) {
                  setExpandedRaces(prev => ({ ...prev, [race.race_id]: true }));
                }
                setRacePagination(prev => ({
                  ...prev,
                  [race.race_id]: { ...prev[race.race_id], pageSize: newSize, currentPage: 1 }
                }));
              };

              return (
                <section key={race.race_id} id={`race-${race.race_id}`} className="mb-24">
                  <div className="flex justify-between items-center mb-8">
                    <h2 className="text-4xl font-bold text-brand-dark">
                      {editedEvents[selectedEvent.id]?.races?.[race.race_id] || race.race_name}
                    </h2>

                    {sorted.length > 5 && (
                      <button
                        onClick={() => {
                          setExpandedRaces(prev => ({
                            ...prev,
                            [race.race_id]: !prev[race.race_id]
                          }));
                          // Reset pagination when collapsing to top 5
                          if (isExpanded) {
                            setRacePagination(prev => ({
                              ...prev,
                              [race.race_id]: { currentPage: 1, pageSize: 50 }
                            }));
                          }
                        }}
                        className="px-8 py-4 bg-primary text-white font-bold rounded-full hover:bg-primary/90 transition shadow-xl"
                      >
                        {isExpanded ? 'Show Top 5' : `View All (${sorted.length})`}
                      </button>
                    )}
                  </div>

                  {sorted.length === 0 ? (
                    <div className="text-center py-16 text-gray-500">
                      <p className="text-2xl font-medium">No results in this race</p>
                    </div>
                  ) : (
                    <ResultsTable
                      data={tableData}
                      totalResults={sorted.length}
                      currentPage={racePagination[race.race_id]?.currentPage || 1}
                      setCurrentPage={updatePage}
                      pageSize={racePagination[race.race_id]?.pageSize || 50}
                      setPageSize={updatePageSize}
                      onNameClick={handleNameClick}
                      isMobile={window.innerWidth < 768}
                      highlightedBib={highlightedBib}
                    />
                  )}
                </section>
              );
            })
          )}
        </div>

        {/* Sponsors */}
        {ads.length > 0 && (
          <section className="mt-20">
            <h3 className="text-4xl font-bold text-center text-brand-dark mb-12">Our Sponsors</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
              {ads.map((ad, i) => (
                <div
                  key={i}
                  className="bg-white rounded-3xl shadow-xl overflow-hidden border border-primary/20 hover:shadow-2xl transition"
                >
                  <img src={ad} alt="Sponsor" className="w-full h-auto" />
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Back to Top Button */}
      <button
        ref={backToTopRef}
        onClick={scrollToTop}
        className="fixed bottom-8 right-8 z-50 w-14 h-14 bg-primary text-white rounded-full shadow-2xl flex items-center justify-center text-4xl hover:scale-110 hover:bg-primary/90 transition-all duration-300 opacity-0 invisible pointer-events-none"
        aria-label="Back to top"
      >
        ↑
      </button>
    </div>
  );
}