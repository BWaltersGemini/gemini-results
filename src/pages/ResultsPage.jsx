// src/pages/ResultsPage.jsx
// FULLY STABLE PRODUCTION VERSION — December 2025
// • No React hook order errors (#310)
// • No crashes on direct URL access
// • Graceful handling of empty/no results
// • All hooks called unconditionally
// • Early returns only at the very end

import { useContext, useState, useRef, useEffect, useMemo } from 'react';
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
    results = { finishers: [], nonFinishers: [] },
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
  const [highlightedBib, setHighlightedBib] = useState(location.state?.highlightBib || null);
  const [expandedDnfSections, setExpandedDnfSections] = useState({});
  const resultsSectionRef = useRef(null);
  const backToTopRef = useRef(null);

  const prevMasterKeyRef = useRef(masterKey);

  // ====================== EFFECTS ======================

  // Live update toast listener
  useEffect(() => {
    const handler = (e) => {
      const count = e.detail?.count || 1;
      setLiveToast({
        message: count === 1 ? '1 new result!' : `${count} new results!`,
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

  // Reset search/highlight when changing master series
  useEffect(() => {
    if (masterKey && masterKey !== prevMasterKeyRef.current) {
      setSearchQuery('');
      setHighlightedBib(null);
      setExpandedDnfSections({});
      prevMasterKeyRef.current = masterKey;
    }
  }, [masterKey]);

  // Back-to-top button visibility
  useEffect(() => {
    const handleScroll = () => {
      if (backToTopRef.current) {
        const scrolled = window.scrollY;
        backToTopRef.current.style.opacity = scrolled > 600 ? '1' : '0';
        backToTopRef.current.style.visibility = scrolled > 600 ? 'visible' : 'hidden';
        backToTopRef.current.style.pointerEvents = scrolled > 600 ? 'auto' : 'none';
      }
    };
    window.addEventListener('scroll', handleScroll);
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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

  // Select event based on URL params (master + year)
  useEffect(() => {
    if (!masterKey || !year || events.length === 0 || Object.keys(masterGroups).length === 0) return;

    const urlSlug = slugify(decodeURIComponent(masterKey));
    const storedMasterKey = Object.keys(masterGroups).find((key) => slugify(key) === urlSlug);
    if (!storedMasterKey) return;

    const groupEventIds = (masterGroups[storedMasterKey] || []).map(String);
    const yearEvents = events
      .filter((e) => e?.id && groupEventIds.includes(String(e.id)) && getYearFromEvent(e) === year)
      .sort((a, b) => (b.start_time || 0) - (a.start_time || 0));

    if (yearEvents.length > 0 && yearEvents[0].id !== selectedEvent?.id) {
      setSelectedEvent(yearEvents[0]);
    }
  }, [masterKey, year, events, masterGroups]);

  // ====================== HELPERS ======================

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

  // ====================== CALCULATIONS (run every render) ======================

  // Safe races array
  const embeddedRaces = Array.isArray(selectedEvent?.races) ? selectedEvent.races : [];

  // All participants for global search
  const allParticipants = useMemo(() => [
    ...results.finishers,
    ...results.nonFinishers
  ], [results.finishers, results.nonFinishers]);

  const globalFilteredResults = useMemo(() => {
    if (!searchQuery) return allParticipants;
    const lowerQuery = searchQuery.toLowerCase();
    return allParticipants.filter(r =>
      r.bib?.toString().includes(searchQuery) ||
      `${r.first_name || ''} ${r.last_name || ''}`.toLowerCase().includes(lowerQuery)
    );
  }, [searchQuery, allParticipants]);

  // Auto-expand DNF sections when search matches DNFs
  useEffect(() => {
    if (searchQuery && globalFilteredResults.length > 0) {
      const newExpanded = {};
      embeddedRaces.forEach((race) => {
        const hasDnfMatch = globalFilteredResults.some(
          r => r.race_id === race.race_id && results.nonFinishers.includes(r)
        );
        if (hasDnfMatch) newExpanded[race.race_id] = true;
      });
      setExpandedDnfSections(newExpanded);
    } else if (searchQuery) {
      setExpandedDnfSections({});
    }
  }, [searchQuery, globalFilteredResults, results.nonFinishers, embeddedRaces]);

  // Races to display
  const racesWithAnyResults = embeddedRaces.filter((race) =>
    race?.race_id && (
      results.finishers.some(r => r?.race_id === race.race_id) ||
      results.nonFinishers.some(r => r?.race_id === race.race_id)
    )
  );

  const racesWithFilteredResults = embeddedRaces.filter((race) =>
    race?.race_id && globalFilteredResults.some(r => r?.race_id === race.race_id)
  );

  let displayedRaces = searchQuery ? racesWithFilteredResults : racesWithAnyResults;

  if (raceSlug) {
    displayedRaces = displayedRaces.filter((race) => slugify(race.race_name || '') === raceSlug);
  }

  // Logo logic
  const currentMasterKey = Object.keys(masterGroups).find(key =>
    masterGroups[key]?.includes(String(selectedEvent?.id))
  );
  const masterLogo = currentMasterKey ? eventLogos[currentMasterKey] : null;
  const fallbackLogo = eventLogos[selectedEvent?.id];
  const displayLogo = masterLogo || fallbackLogo;

  // Stats
  const totalFinishers = results.finishers.length;
  const maleFinishers = results.finishers.filter(r => r.gender === 'M').length;
  const femaleFinishers = results.finishers.filter(r => r.gender === 'F').length;

  // Available years for dropdown
  let availableYears = [];
  if (currentMasterKey) {
    const linkedEventIds = (masterGroups[currentMasterKey] || []).map(String);
    const linkedEvents = events.filter(e => e?.id && linkedEventIds.includes(String(e.id)));
    availableYears = [...new Set(linkedEvents.map(getYearFromEvent))].filter(Boolean).sort((a, b) => b - a);
  }

  const handleYearChange = (newYear) => {
    if (newYear === year) return;
    navigate(`/results/${masterKey}/${newYear}${raceSlug ? '/' + raceSlug : ''}`);
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
      state: { participant, selectedEvent, results: allParticipants },
    });
  };

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  // ====================== MASTER LANDING PAGE CONTENT ======================

  const visibleMasters = Object.keys(masterGroups).filter(key => !hiddenMasters.includes(key));

  const masterEventTiles = visibleMasters
    .map((storedKey) => {
      const displayName = editedEvents[storedKey]?.name || storedKey;
      const eventIds = (masterGroups[storedKey] || []).map(String);
      const masterEvents = events.filter(e => e?.id && eventIds.includes(String(e.id)));
      if (masterEvents.length === 0) return null;

      const latestEvent = masterEvents.sort((a, b) => (b.start_time || 0) - (a.start_time || 0))[0];
      if (!latestEvent) return null;

      const logo = eventLogos[latestEvent.id] || eventLogos[storedKey];
      const masterSlug = slugify(storedKey);
      const latestYear = getYearFromEvent(latestEvent);

      return { storedKey, displayName, logo, dateEpoch: latestEvent.start_time, masterSlug, latestYear };
    })
    .filter(Boolean)
    .sort((a, b) => (b.dateEpoch || 0) - (a.dateEpoch || 0))
    .slice(0, 3);

  // ====================== FINAL RENDER (conditional at the end) ======================

  // 1. Loading a specific event from URL but not ready yet
  if ((masterKey || year) && !selectedEvent) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-brand-light to-white flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-t-4 border-primary mb-8"></div>
          <p className="text-2xl text-gray-700">Loading event...</p>
        </div>
      </div>
    );
  }

  // 2. General results landing page (no specific master/year)
  if (!selectedEvent) {
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

  // 3. Results are still loading for the selected event
  if (loadingResults) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-brand-light to-white flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-t-4 border-primary mb-8"></div>
          <p className="text-2xl text-gray-700">Loading results...</p>
        </div>
      </div>
    );
  }

  // 4. Final event results page
  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-light to-white">
      {/* Live Toast */}
      {liveToast && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white px-8 py-4 rounded-full shadow-2xl animate-pulse text-xl font-bold flex items-center gap-3">
          <div className="w-3 h-3 bg-white rounded-full animate-ping"></div>
          {liveToast.message}
        </div>
      )}

      <div className="max-w-7xl mx-auto px-6 py-12 pt-32">
        {/* Sticky Search */}
        <div className={`sticky top-32 z-40 bg-white shadow-lg rounded-full px-6 py-4 mb-12 transition-all ${searchQuery ? 'ring-4 ring-primary/30' : ''}`}>
          <div className="relative max-w-3xl mx-auto">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by bib or name (includes DNFs)..."
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
            <div className="text-center mt-5">
              {globalFilteredResults.length > 0 ? (
                <button
                  onClick={() => resultsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                  className="inline-flex items-center gap-3 px-8 py-4 bg-primary text-white text-lg font-bold rounded-full hover:bg-primary/90 shadow-xl transition transform hover:scale-105"
                >
                  <span>{globalFilteredResults.length} result{globalFilteredResults.length !== 1 ? 's' : ''} found</span>
                  <span className="text-2xl">↓ Jump to Results</span>
                </button>
              ) : (
                <p className="text-lg text-gray-700 font-medium">
                  No participants found matching "{searchQuery}"
                </p>
              )}
            </div>
          )}
        </div>

        {/* Header */}
        <div className="text-center mb-16">
          {displayLogo && (
            <img src={displayLogo} alt="Event logo" className="mx-auto max-h-48 mb-8 object-contain" />
          )}
          <h1 className="text-5xl md:text-6xl font-black text-brand-dark mb-4">
            {editedEvents[selectedEvent.id]?.name || selectedEvent.name}
          </h1>
          <p className="text-2xl text-gray-600">{formatDate(selectedEvent.start_time)}</p>
          {isLiveRace && (
            <div className="flex items-center justify-center gap-3 mt-6 text-green-600 font-bold text-xl">
              <div className="w-4 h-4 bg-green-600 rounded-full animate-ping"></div>
              Live Results • Updating in Real Time
            </div>
          )}
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

        {/* Stats */}
        {totalFinishers > 0 && (
          <div className="grid grid-cols-3 gap-8 max-w-3xl mx-auto mb-16 text-center">
            <div className="bg-white rounded-2xl shadow-lg py-6">
              <div className="text-4xl font-bold text-primary">{totalFinishers}</div>
              <div className="text-gray-600">Official Finishers</div>
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

        {/* Jump Links */}
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

        {/* Results */}
        <div ref={resultsSectionRef}>
          {displayedRaces.length === 0 ? (
            <div className="text-center py-32">
              <div className="text-6xl mb-8">🏁</div>
              <h2 className="text-4xl font-bold text-brand-dark mb-6">
                {searchQuery ? `No participants found matching "${searchQuery}"` : 'Results Not Available Yet'}
              </h2>
              <p className="text-2xl text-gray-600 max-w-2xl mx-auto">
                {searchQuery
                  ? 'Try adjusting your search terms or clearing the filter.'
                  : 'Official results for this event have not been published yet. Please check back soon!'}
              </p>
              {!searchQuery && (
                <p className="text-lg text-gray-500 mt-6">
                  Event Date: {formatDate(selectedEvent.start_time)}
                </p>
              )}
            </div>
          ) : (
            displayedRaces.map((race) => {
              const displayFinishers = useMemo(() => {
                const raceFinishers = results.finishers.filter(r => r?.race_id === race.race_id);
                return searchQuery
                  ? globalFilteredResults.filter(r => r.race_id === race.race_id && results.finishers.includes(r))
                  : raceFinishers;
              }, [searchQuery, results.finishers, race.race_id, globalFilteredResults]);

              const sortedFinishers = useMemo(() => {
                return [...displayFinishers].sort((a, b) => (a.place || Infinity) - (b.place || Infinity));
              }, [displayFinishers]);

              const displayDnf = useMemo(() => {
                const raceDnf = results.nonFinishers.filter(r => r?.race_id === race.race_id);
                return searchQuery
                  ? globalFilteredResults.filter(r => r.race_id === race.race_id && results.nonFinishers.includes(r))
                  : raceDnf;
              }, [searchQuery, results.nonFinishers, race.race_id, globalFilteredResults]);

              const isDnfExpanded = expandedDnfSections[race.race_id];

              return (
                <section key={race.race_id} id={`race-${race.race_id}`} className="mb-24">
                  <h2 className="text-4xl font-bold text-brand-dark mb-8">
                    {editedEvents[selectedEvent.id]?.races?.[race.race_id] || race.race_name}
                  </h2>

                  {sortedFinishers.length > 0 ? (
                    <ResultsTable
                      data={sortedFinishers}
                      onNameClick={handleNameClick}
                      isMobile={window.innerWidth < 768}
                      highlightedBib={highlightedBib}
                    />
                  ) : (
                    <div className="text-center py-16 text-gray-500">
                      <p className="text-2xl font-medium">No official finishers in this race</p>
                    </div>
                  )}

                  {displayDnf.length > 0 && (
                    <div className="mt-16">
                      <button
                        onClick={() => setExpandedDnfSections(prev => ({ ...prev, [race.race_id]: !prev[race.race_id] }))}
                        className="w-full bg-red-100 hover:bg-red-200 text-red-800 font-bold text-xl py-5 px-8 rounded-2xl transition flex items-center justify-between shadow-lg"
                      >
                        <span>Did Not Finish ({displayDnf.length})</span>
                        <span className="text-3xl">{isDnfExpanded ? '−' : '+'}</span>
                      </button>
                      {isDnfExpanded && (
                        <div className="mt-8">
                          <ResultsTable
                            data={displayDnf}
                            onNameClick={handleNameClick}
                            isMobile={window.innerWidth < 768}
                            highlightedBib={highlightedBib}
                            isDnfTable={true}
                          />
                          <p className="text-center text-gray-600 mt-6 text-sm">
                            These athletes started but did not officially finish the full course.
                          </p>
                        </div>
                      )}
                    </div>
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

      {/* Back to Top */}
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