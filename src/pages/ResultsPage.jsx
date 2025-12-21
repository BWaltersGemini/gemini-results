// src/pages/ResultsPage.jsx (FINAL — Fixed Empty Results Display + No Table When No Results)
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
    isLiveRace,
  } = useContext(RaceContext);

  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [loadingUpcoming, setLoadingUpcoming] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [liveToast, setLiveToast] = useState(null);
  const prevMasterKeyRef = useRef(masterKey);

  // Division filter & highlight from ParticipantPage
  const divisionFilterFromState = location.state?.divisionFilter;
  const highlightBibFromState = location.state?.highlightBib;
  const [activeDivisionFilter, setActiveDivisionFilter] = useState(divisionFilterFromState || '');
  const [highlightedBib, setHighlightedBib] = useState(highlightBibFromState || null);

  // Refs
  const resultsSectionRef = useRef(null);
  const backToTopRef = useRef(null);

  // Listen for live update toast
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

  // Auto-hide toast
  useEffect(() => {
    if (liveToast) {
      const timer = setTimeout(() => setLiveToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [liveToast]);

  // Reset filters on master change
  useEffect(() => {
    if (masterKey && masterKey !== prevMasterKeyRef.current) {
      setSearchQuery('');
      setActiveDivisionFilter('');
      setHighlightedBib(null);
      prevMasterKeyRef.current = masterKey;
    }
  }, [masterKey]);

  // Scroll to results on search
  useEffect(() => {
    if (searchQuery && resultsSectionRef.current) {
      resultsSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [searchQuery]);

  // Show/hide back-to-top button
  useEffect(() => {
    const handleScroll = () => {
      if (backToTopRef.current) {
        if (window.scrollY > 600) {
          backToTopRef.current.style.opacity = '1';
          backToTopRef.current.style.visibility = 'visible';
        } else {
          backToTopRef.current.style.opacity = '0';
          backToTopRef.current.style.visibility = 'hidden';
        }
      }
    };
    window.addEventListener('scroll', handleScroll);
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

  // Event selection from URL
  useEffect(() => {
    if (!masterKey || !year || events.length === 0 || Object.keys(masterGroups).length === 0) return;

    const urlSlug = slugify(decodeURIComponent(masterKey));
    const storedMasterKey = Object.keys(masterGroups).find(
      (key) => slugify(key) === urlSlug
    );
    if (!storedMasterKey) return;

    const groupEventIds = (masterGroups[storedMasterKey] || []).map(String);

    const yearEvents = events
      .filter((e) => e && e.id && groupEventIds.includes(String(e.id)) && getYearFromEvent(e) === year)
      .sort((a, b) => (b.start_time || 0) - (a.start_time || 0));

    if (yearEvents.length > 0 && yearEvents[0].id !== selectedEvent?.id) {
      setSelectedEvent(yearEvents[0]);
    }
  }, [masterKey, year, events, masterGroups, selectedEvent, setSelectedEvent]);

  // Build races
  const embeddedRaces = selectedEvent?.races || [];
  const racesWithFinishers = embeddedRaces.filter((race) =>
    results.some((r) => r.race_id === race.race_id && r.chip_time && r.chip_time.trim() !== '')
  );

  let displayedRaces = racesWithFinishers;
  if (raceSlug) {
    displayedRaces = racesWithFinishers.filter((race) => slugify(race.race_name) === raceSlug);
  }

  // Global filtered results
  const globalFilteredResults = searchQuery
    ? results.filter(r =>
        r.bib?.toString().includes(searchQuery) ||
        `${r.first_name || ''} ${r.last_name || ''}`.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : results;

  const currentMasterKey = Object.keys(masterGroups).find(key =>
    masterGroups[key]?.includes(String(selectedEvent?.id))
  );
  const masterLogo = currentMasterKey ? eventLogos[currentMasterKey] : null;
  const fallbackLogo = selectedEvent ? eventLogos[selectedEvent.id] : null;
  const displayLogo = masterLogo || fallbackLogo;

  // Calculate stats — only from finishers with chip_time
  const finishers = results.filter(r => r.chip_time && r.chip_time.trim() !== '');
  const totalFinishers = finishers.length;
  const maleFinishers = finishers.filter(r => r.gender === 'M').length;
  const femaleFinishers = finishers.filter(r => r.gender === 'F').length;

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Participant navigation
  const handleNameClick = (participant) => {
    if (!participant || !selectedEvent) return;

    const allMasterGroups = masterGroups;
    let masterSlug = 'overall';
    const foundMaster = Object.entries(allMasterGroups).find(([_, ids]) =>
      ids.includes(String(selectedEvent.id))
    );
    if (foundMaster) {
      masterSlug = slugify(foundMaster[0]);
    }
    const eventYear = getYearFromEvent(selectedEvent);
    const participantRace = selectedEvent.races?.find(r => r.race_id === participant.race_id);
    const raceName = participantRace?.race_name || participant.race_name || 'overall';
    const raceSlugPart = slugify(raceName);

    navigate(`/results/${masterSlug}/${eventYear}/${raceSlugPart}/bib/${participant.bib}`, {
      state: { participant, selectedEvent, results },
    });
  };

  // Available years for this master event
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

  // MASTER LANDING PAGE
  if (!selectedEvent) {
    const visibleMasters = Object.keys(masterGroups).filter((key) => !hiddenMasters.includes(key));
    const masterEventTiles = visibleMasters
      .map((storedKey) => {
        const displayName = editedEvents[storedKey]?.name || storedKey;
        const eventIds = (masterGroups[storedKey] || []).map(String);
        const masterEvents = events.filter((e) => e && e.id && eventIds.includes(String(e.id)));
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

  // EVENT RESULTS PAGE
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Live Toast */}
      {liveToast && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white px-8 py-4 rounded-full shadow-2xl flex items-center gap-4 animate-pulse text-xl font-bold">
          <span>🎉</span>
          <span>{liveToast.message}</span>
        </div>
      )}

      {/* Live Badge */}
      {isLiveRace && (
        <div className="fixed top-20 right-4 md:right-8 z-50">
          <div className="bg-green-600 text-white px-5 py-3 rounded-full shadow-2xl flex items-center gap-3 animate-pulse">
            <div className="w-3 h-3 bg-white rounded-full animate-ping" />
            <span className="font-bold text-sm md:text-base">Live Results Updating</span>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-6 py-12 pt-32">
        {/* Sticky Search Bar */}
        <div className={`sticky top-24 z-40 bg-white shadow-lg rounded-full px-6 py-4 mb-12 transition-all ${searchQuery ? 'ring-4 ring-gemini-blue/50' : ''}`}>
          <div className="relative max-w-3xl mx-auto">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by bib or name..."
              className="w-full px-6 py-4 text-xl placeholder-gray-500 border-0 focus:outline-none text-gray-900"
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

        {/* Enhanced Header with Stats — Only finishers with chip_time */}
        {!searchQuery && (
          <div className="text-center mb-16">
            {displayLogo && (
              <img src={displayLogo} alt="Logo" className="mx-auto max-h-64 mb-8 object-contain drop-shadow-2xl" />
            )}
            <h1 className="text-5xl md:text-6xl font-black text-gemini-dark-gray mb-4">
              {editedEvents[selectedEvent.id]?.name || selectedEvent.name}
            </h1>
            <p className="text-2xl text-gray-600 mb-8">{formatDate(selectedEvent.start_time)}</p>

            {/* Year Selector */}
            {availableYears.length > 1 && (
              <div className="flex flex-wrap justify-center gap-4 mb-12">
                <span className="text-2xl font-bold text-gray-700 self-center mr-4">Year:</span>
                {availableYears.map((y) => (
                  <button
                    key={y}
                    onClick={() => handleYearChange(y)}
                    className={`px-8 py-4 rounded-full font-bold text-xl transition ${
                      y === year
                        ? 'bg-gemini-blue text-white shadow-xl'
                        : 'bg-white text-gray-700 border-2 border-gray-300 hover:border-gemini-blue hover:text-gemini-blue'
                    }`}
                  >
                    {y}
                  </button>
                ))}
              </div>
            )}

            {/* Stats Grid — Only actual finishers */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto mb-12">
              <div className="bg-gradient-to-br from-gemini-blue/10 to-gemini-blue/5 rounded-2xl p-8 shadow-xl text-center">
                <p className="text-lg uppercase text-gray-600 tracking-wider mb-4">Total Finishers</p>
                <p className="text-6xl font-black text-gemini-blue">{totalFinishers.toLocaleString()}</p>
              </div>
              <div className="bg-gradient-to-br from-blue-100 to-blue-200 rounded-2xl p-8 shadow-xl text-center">
                <p className="text-lg uppercase text-gray-600 tracking-wider mb-4">Male</p>
                <p className="text-6xl font-black text-blue-700">{maleFinishers.toLocaleString()}</p>
              </div>
              <div className="bg-gradient-to-br from-pink-100 to-pink-200 rounded-2xl p-8 shadow-xl text-center">
                <p className="text-lg uppercase text-gray-600 tracking-wider mb-4">Female</p>
                <p className="text-6xl font-black text-pink-700">{femaleFinishers.toLocaleString()}</p>
              </div>
            </div>
          </div>
        )}

        {/* Race Jump Links */}
        {!searchQuery && displayedRaces.length > 1 && (
          <div className="flex flex-wrap justify-center gap-4 mb-12">
            {displayedRaces.map((race) => (
              <button
                key={race.race_id}
                onClick={() => document.getElementById(`race-${race.race_id}`)?.scrollIntoView({ behavior: 'smooth' })}
                className="px-8 py-4 bg-gemini-blue/10 text-gemini-blue font-bold rounded-full hover:bg-gemini-blue/20 transition"
              >
                {editedEvents[selectedEvent.id]?.races?.[race.race_id] || race.race_name}
              </button>
            ))}
          </div>
        )}

        {/* Results Section */}
        <div ref={resultsSectionRef}>
          {displayedRaces.length === 0 ? (
            <div className="text-center py-32">
              <div className="text-6xl mb-8">🏁</div>
              <h2 className="text-4xl font-bold text-gemini-dark-gray mb-4">No Results Yet</h2>
              <p className="text-2xl text-gray-600 mb-8">
                {isLiveRace ? 'The race is live — finishers will appear here soon!' : 'Timing has not started yet.'}
              </p>
              {isLiveRace && (
                <div className="flex items-center justify-center gap-4 text-2xl text-green-600 font-bold">
                  <div className="w-4 h-4 bg-green-600 rounded-full animate-ping"></div>
                  Live Updates Active
                </div>
              )}
            </div>
          ) : (
            displayedRaces.map((race) => {
              const raceResults = globalFilteredResults.filter(r => r.race_id === race.race_id);
              const sorted = [...raceResults].sort((a, b) => (a.place || Infinity) - (b.place || Infinity));

              return (
                <section key={race.race_id} id={`race-${race.race_id}`} className="mb-24">
                  <h2 className="text-4xl font-bold text-center text-gemini-dark-gray mb-12">
                    {editedEvents[selectedEvent.id]?.races?.[race.race_id] || race.race_name}
                  </h2>
                  <ResultsTable
                    data={sorted}
                    totalResults={sorted.length}
                    onNameClick={handleNameClick}
                    isMobile={window.innerWidth < 768}
                    highlightedBib={highlightedBib}
                    highlightedRowRef={null}
                  />
                </section>
              );
            })
          )}
        </div>

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
      </div>

      {/* Back to Top Button */}
      <button
        ref={backToTopRef}
        onClick={scrollToTop}
        className="fixed bottom-8 right-8 bg-gemini-blue text-white w-14 h-14 rounded-full shadow-2xl flex items-center justify-center text-4xl hover:scale-110 hover:bg-gemini-blue/90 transition-all duration-300 z-50 opacity-0 invisible"
        aria-label="Back to top"
      >
        ↑
      </button>
    </div>
  );
}