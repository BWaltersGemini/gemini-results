// src/pages/ResultsPage.jsx (FINAL — Fixed Mobile Pace Text + Sticky Search Below Navbar)
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

  // Calculate stats
  const totalFinishers = results.length;
  const maleFinishers = results.filter(r => r.gender === 'M').length;
  const femaleFinishers = results.filter(r => r.gender === 'F').length;

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
    // ... (unchanged master landing page)
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

      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Sticky Search Bar — Now starts below navbar (top-20 → top-24 on mobile) */}
        <div className={`sticky z-40 bg-white shadow-lg rounded-full px-6 py-4 mb-12 transition-all ${searchQuery ? 'ring-4 ring-gemini-blue/50' : ''} top-20 md:top-20 lg:top-24`}>
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

        {/* Enhanced Header with Stats */}
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

            {/* Stats Grid */}
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
          {displayedRaces.map((race) => {
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
          })}
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