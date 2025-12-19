// src/pages/ResultsPage.jsx (FINAL COMPLETE — With Year Selector Dropdown + All Features)
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
    results = [],
    loadingResults,
    uniqueDivisions = [],
    eventLogos = {},
    ads = [],
    setSelectedEvent,
  } = useContext(RaceContext);

  // Load config from localStorage
  const masterGroups = JSON.parse(localStorage.getItem('masterGroups')) || {};
  const editedEvents = JSON.parse(localStorage.getItem('editedEvents')) || {};
  const hiddenMasters = JSON.parse(localStorage.getItem('hiddenMasters')) || [];
  const hiddenRaces = JSON.parse(localStorage.getItem('hiddenRaces')) || {};

  const [pageSize] = useState(10);
  const [currentPages, setCurrentPages] = useState({});
  const raceRefs = useRef({});

  // Slugify helper
  const slugify = (text) => {
    if (!text || typeof text !== 'string') return 'overall';
    return text.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  };

  // Format date from Unix epoch (seconds)
  const formatDate = (epoch) => {
    if (!epoch || isNaN(epoch)) return 'Date TBD';
    const date = new Date(epoch * 1000);
    if (isNaN(date.getTime())) return 'Invalid Date';
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Extract year from start_time
  const getYearFromEvent = (event) => {
    if (!event?.start_time) return null;
    return new Date(event.start_time * 1000).getFullYear().toString();
  };

  // Master/year event selection based on URL params
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

    if (yearEvents.length > 0) {
      const targetEvent = yearEvents[0];
      if (targetEvent.id !== selectedEvent?.id) {
        setSelectedEvent(targetEvent);
      }
    }
  }, [masterKey, year, events, masterGroups, selectedEvent, setSelectedEvent]);

  // === YEAR SELECTOR LOGIC ===
  const currentMasterKey = Object.keys(masterGroups).find(
    (key) => slugify(key) === masterKey || key.toLowerCase() === masterKey.toLowerCase()
  );

  const linkedYears = currentMasterKey
    ? [...new Set(
        events
          .filter(e => masterGroups[currentMasterKey]?.includes(e.id.toString()))
          .map(e => getYearFromEvent(e))
          .filter(Boolean)
      )].sort((a, b) => b - a) // Newest first
    : [];

  const handleYearChange = (newYear) => {
    const basePath = `/results/${masterKey}/${newYear}`;
    navigate(raceSlug ? `${basePath}/${raceSlug}` : basePath);
  };

  // Handle name click → navigate to participant page (if bib in URL)
  const handleNameClick = (participant) => {
    if (participant.bib) {
      const path = `/results/${masterKey}/${year}${raceSlug ? '/' + raceSlug : ''}/bib/${participant.bib}`;
      navigate(path, {
        state: {
          participant,
          selectedEvent,
          results,
          eventLogos,
          ads,
        },
      });
    }
  };

  // No event selected fallback
  if (!selectedEvent) {
    return (
      <div className="min-h-screen bg-gray-50 py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl font-bold text-gemini-dark-gray mb-8">Select a Race</h1>
          <p className="text-xl text-gray-600">Use the search bar in the navigation to find an event.</p>
        </div>
      </div>
    );
  }

  // Races to display (respect hidden races)
  const racesToShow = selectedEvent.races || [];

  const effectiveRaces = racesToShow.length > 0
    ? racesToShow.filter(r => !(hiddenRaces[selectedEvent.id] || []).includes(r.race_id))
    : [{ race_id: 'overall', race_name: selectedEvent.name || 'Overall Results' }];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Event Header */}
        <div className="text-center mb-12">
          {eventLogos[selectedEvent.id] && (
            <img
              src={eventLogos[selectedEvent.id]}
              alt="Event Logo"
              className="mx-auto max-h-32 mb-6 object-contain"
            />
          )}
          <h1 className="text-5xl font-bold text-gemini-dark-gray mb-4">
            {editedEvents[selectedEvent.id]?.name || selectedEvent.name}
          </h1>
          <p className="text-2xl text-gray-600">{formatDate(selectedEvent.start_time)}</p>

          {/* YEAR SELECTOR DROPDOWN */}
          {linkedYears.length > 1 && (
            <div className="mt-10 inline-flex items-center bg-white rounded-2xl shadow-xl px-8 py-6">
              <label className="text-xl font-semibold text-gemini-dark-gray mr-6">
                Select Year:
              </label>
              <select
                value={year || linkedYears[0]}
                onChange={(e) => handleYearChange(e.target.value)}
                className="px-8 py-4 text-xl border-2 border-gemini-blue rounded-xl bg-white shadow-lg hover:shadow-xl transition focus:outline-none focus:border-gemini-blue/70 cursor-pointer"
              >
                {linkedYears.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Loading State */}
        {loadingResults && (
          <div className="text-center py-20">
            <p className="text-2xl text-gray-600">Loading results...</p>
          </div>
        )}

        {/* No Results */}
        {!loadingResults && results.length === 0 && (
          <div className="text-center py-20 bg-white rounded-2xl shadow">
            <p className="text-2xl text-gray-600">No results available yet for this event.</p>
          </div>
        )}

        {/* Results Display */}
        {!loadingResults && results.length > 0 && (
          <>
            {effectiveRaces.map((race) => {
              const raceResults = race.race_id === 'overall'
                ? results
                : results.filter(r => r.race_id === race.race_id);

              const sorted = raceResults.sort((a, b) => (a.place || Infinity) - (b.place || Infinity));

              const page = currentPages[race.race_id] || 1;
              const totalPages = Math.ceil(sorted.length / pageSize);
              const display = sorted.slice((page - 1) * pageSize, page * pageSize);

              return (
                <section key={race.race_id} className="mb-20">
                  <h2 className="text-4xl font-bold text-center text-gemini-blue mb-10">
                    {editedEvents[selectedEvent.id]?.races?.[race.race_id] || race.race_name || 'Overall Results'}
                  </h2>

                  {/* Results Table */}
                  <div className="overflow-x-auto bg-white rounded-2xl shadow-xl">
                    <div className="md:hidden">
                      <ResultsTable data={display} onNameClick={handleNameClick} isMobile={true} />
                    </div>
                    <div className="hidden md:block">
                      <ResultsTable data={display} onNameClick={handleNameClick} isMobile={false} />
                    </div>
                  </div>

                  {/* Pagination */}
                  {sorted.length > pageSize && (
                    <div className="flex flex-col sm:flex-row justify-center items-center gap-6 mt-12 bg-gray-50 py-8 rounded-2xl">
                      <button
                        onClick={() => setCurrentPages(p => ({
                          ...p,
                          [race.race_id]: Math.max(1, (p[race.race_id] || 1) - 1)
                        }))}
                        disabled={page === 1}
                        className="px-10 py-4 bg-gemini-blue text-white rounded-full font-bold disabled:opacity-50 hover:bg-gemini-blue/90 transition shadow-lg"
                      >
                        ← Previous
                      </button>
                      <span className="text-xl font-medium text-gray-700">
                        Page {page} of {totalPages} ({sorted.length} results)
                      </span>
                      <button
                        onClick={() => setCurrentPages(p => ({
                          ...p,
                          [race.race_id]: page + 1
                        }))}
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
                <h3 className="text-4xl font-bold text-center text-gemini-dark-gray mb-12">Our Sponsors</h3>
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