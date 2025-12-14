// src/pages/ResultsPage.jsx (CLEANED UP UI: Mobile-first, better contrast, spacing, and readability)
import { useContext, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import ResultsTable from '../components/ResultsTable';
import { RaceContext } from '../context/RaceContext';

export default function ResultsPage() {
  const navigate = useNavigate();
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

  const [pageSize] = useState(10);
  const [currentPages, setCurrentPages] = useState({});
  const [raceFilters, setRaceFilters] = useState({});
  const raceRefs = useRef({});

  const formatDate = (dateStr) => {
    const [year, month, day] = dateStr.split('-');
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // === NO EVENT SELECTED: Landing with recent races ===
  if (!selectedEvent) {
    const recentEvents = [...events]
      .filter(e => new Date(e.date) <= new Date())
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 6);

    const goToRaceResults = (event) => {
      setSelectedEvent(event);
    };

    return (
      <div className="min-h-screen bg-gradient-to-b from-gemini-light-gray to-white pt-32 pb-20 px-4">
        <div className="max-w-7xl mx-auto">
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
                {recentEvents.map((event, index) => (
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

  // === FULL RESULTS VIEW ===
  const formattedDate = formatDate(selectedEvent.date);
  const eventDate = new Date(selectedEvent.date + 'T12:00:00');
  const today = new Date(); today.setHours(0,0,0,0);
  const isToday = eventDate.toDateString() === today.toDateString();
  const isUpcoming = eventDate > today;

  // Deduplicate results
  const uniqueResults = results.reduce((acc, current) => {
    const key = [
      (current.bib || '').toString().trim(),
      (current.first_name || '').trim().toLowerCase(),
      (current.last_name || '').trim().toLowerCase(),
      (current.chip_time || current.clock_time || '').trim(),
      (current.place || '').toString().trim(),
    ].join('|');
    if (!acc.seen.has(key)) {
      acc.seen.add(key);
      acc.results.push(current);
    }
    return acc;
  }, { seen: new Set(), results: [] }).results;

  // Group by race
  const grouped = {};
  uniqueResults.forEach(r => {
    const id = r.race_id || 'overall';
    if (!grouped[id]) grouped[id] = [];
    grouped[id].push(r);
  });

  const racesToShow = races.length > 0 ? races : Object.keys(grouped).map(id => ({
    race_id: id,
    race_name: id === 'overall' ? 'Overall Results' : `Race ${id}`
  }));

  const scrollToRace = (raceId) => {
    raceRefs.current[raceId]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleNameClick = (participant) => {
    navigate('/participant', {
      state: { participant, selectedEvent, results: uniqueResults, eventLogos, ads },
    });
  };

  return (
    <div className="min-h-screen bg-gemini-light-gray pt-32 pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {error && (
          <p className="text-center text-red-600 text-xl font-bold mb-8 bg-red-50 py-4 rounded-lg">
            {error}
          </p>
        )}

        {/* Event Header */}
        <div className="text-center mb-12">
          <img
            src={eventLogos[selectedEvent.id] || '/GRR.png'}
            alt="Event Logo"
            className="mx-auto max-h-40 mb-8"
          />
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gemini-dark-gray leading-tight">
            {selectedEvent.name}
          </h1>
          <p className="text-xl sm:text-2xl text-gray-600 mt-4">{formattedDate}</p>
        </div>

        {/* Loading / No Results / Upcoming */}
        {loadingResults ? (
          <div className="text-center py-24">
            <div className="text-7xl animate-spin inline-block mb-6">🏃</div>
            <p className="text-2xl text-gray-700">Loading results...</p>
          </div>
        ) : uniqueResults.length === 0 && isUpcoming ? (
          <div className="text-center py-24">
            <p className="text-3xl font-bold text-gemini-dark-gray mb-6">
              Results will be available once the race begins!
            </p>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              {isToday
                ? 'This race is happening today — check back soon for live results!'
                : `This race is scheduled for ${formattedDate}. Results will appear after finishers cross the line.`}
            </p>
            <div className="text-7xl mt-8">⏱️</div>
          </div>
        ) : uniqueResults.length === 0 ? (
          <div className="text-center py-24">
            <p className="text-2xl text-gray-600">No results available yet.</p>
          </div>
        ) : (
          <>
            {/* Jump to Race Buttons */}
            {racesToShow.length > 1 && (
              <div className="text-center mb-12">
                <p className="text-lg font-semibold text-gray-700 mb-4">Jump to Race:</p>
                <div className="flex flex-wrap justify-center gap-3">
                  {racesToShow.map(r => (
                    <button
                      key={r.race_id}
                      onClick={() => scrollToRace(r.race_id)}
                      className="px-5 py-3 bg-gemini-blue text-white rounded-full font-medium hover:bg-gemini-blue/90 transition"
                    >
                      {r.race_name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Race Sections */}
            {racesToShow.map(race => {
              const raceResults = grouped[race.race_id] || [];
              const filters = raceFilters[race.race_id] || { search: '', gender: '', division: '' };
              const filtered = raceResults.filter(r => {
                const matchesSearch = !filters.search || 
                  `${r.first_name} ${r.last_name}`.toLowerCase().includes(filters.search.toLowerCase()) ||
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
              const topM = sorted.filter(r => r.gender === 'M').slice(0, 3);
              const topF = sorted.filter(r => r.gender === 'F').slice(0, 3);

              return (
                <section
                  key={race.race_id}
                  ref={el => (raceRefs.current[race.race_id] = el)}
                  className="mb-20 scroll-mt-32"
                >
                  <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center text-gemini-dark-gray mb-10">
                    {race.race_name}
                  </h3>

                  {/* Leaderboard */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12 max-w-5xl mx-auto">
                    <div className="bg-white rounded-2xl shadow-lg p-6">
                      <h4 className="text-2xl font-bold text-gemini-blue mb-6">Top Males</h4>
                      {topM.length === 0 ? (
                        <p className="text-gray-500 text-center py-8">No male finishers yet</p>
                      ) : (
                        topM.map((w, i) => (
                          <div key={i} className="mb-5 p-4 bg-gray-50 rounded-xl">
                            <p className="font-bold text-lg">{i + 1}. {w.first_name} {w.last_name}</p>
                            <p className="text-gray-700">Time: {w.chip_time || 'N/A'}</p>
                            <p className="text-gray-600 text-sm">Age: {w.age || 'N/A'}</p>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="bg-white rounded-2xl shadow-lg p-6">
                      <h4 className="text-2xl font-bold text-gemini-red mb-6">Top Females</h4>
                      {topF.length === 0 ? (
                        <p className="text-gray-500 text-center py-8">No female finishers yet</p>
                      ) : (
                        topF.map((w, i) => (
                          <div key={i} className="mb-5 p-4 bg-gray-50 rounded-xl">
                            <p className="font-bold text-lg">{i + 1}. {w.first_name} {w.last_name}</p>
                            <p className="text-gray-700">Time: {w.chip_time || 'N/A'}</p>
                            <p className="text-gray-600 text-sm">Age: {w.age || 'N/A'}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Filters */}
                  <div className="bg-white rounded-2xl shadow-lg p-6 max-w-4xl mx-auto mb-10">
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

                  {/* Results Table */}
                  <div className="max-w-5xl mx-auto">
                    <div className="overflow-x-auto rounded-2xl shadow-lg bg-white">
                      <ResultsTable data={display} onNameClick={handleNameClick} />
                    </div>
                    <p className="text-center text-sm text-gray-500 mt-3">← Scroll horizontally on mobile →</p>
                  </div>

                  {/* Pagination */}
                  {sorted.length > pageSize && (
                    <div className="text-center mt-12">
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
              <section className="mt-20">
                <h3 className="text-3xl font-bold text-center text-gemini-dark-gray mb-10">
                  Our Sponsors
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
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