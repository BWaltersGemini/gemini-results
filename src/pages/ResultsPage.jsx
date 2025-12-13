// src/pages/ResultsPage.jsx (Final: Safe dates + full width + logos on tiles + mobile-friendly enhancements)
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
  // Safe date formatting (no timezone shift)
  const formatDate = (dateStr) => {
    const [year, month, day] = dateStr.split('-');
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };
  // If no event selected — show enticing landing with recent races + logos
  if (!selectedEvent) {
    const recentEvents = [...events]
      .filter(e => new Date(e.date) <= new Date())
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 6);
    const goToRaceResults = (event) => {
      setSelectedEvent(event);
    };
    return (
      <div className="min-h-screen bg-gradient-to-b from-gemini-light-gray to-white pt-40 py-20">
        <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12">
          <div className="text-center mb-20">
            <h1 className="text-4xl sm:text-5xl md:text-7xl font-black text-gemini-dark-gray mb-6">
              Race Results
            </h1>
            <p className="text-xl sm:text-2xl md:text-3xl text-gray-700 max-w-4xl mx-auto">
              Select a race below to view live results, leaderboards, and participant details
            </p>
          </div>
          {recentEvents.length > 0 ? (
            <>
              <h2 className="text-3xl sm:text-4xl font-bold text-center text-gemini-dark-gray mb-12">
                Recent Races
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 sm:gap-10 max-w-7xl mx-auto">
                {recentEvents.map((event, index) => (
                  <button
                    key={event.id}
                    onClick={() => goToRaceResults(event)}
                    className="group block bg-white rounded-3xl shadow-2xl overflow-hidden transform hover:scale-105 hover:shadow-3xl transition-all duration-300"
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    {/* Race Logo */}
                    {eventLogos[event.id] ? (
                      <img
                        src={eventLogos[event.id]}
                        alt={`${event.name} Logo`}
                        className="w-full h-40 sm:h-48 object-contain bg-gray-50 p-4 sm:p-6"
                      />
                    ) : (
                      <div className="h-40 sm:h-48 bg-gradient-to-br from-gemini-blue to-gemini-dark-gray flex items-center justify-center">
                        <div className="text-white text-5xl sm:text-6xl opacity-30 group-hover:opacity-50 transition">
                          🏁
                        </div>
                      </div>
                    )}
                    <div className="p-6 sm:p-8 text-center">
                      <h3 className="text-xl sm:text-2xl font-bold text-gemini-dark-gray mb-3 group-hover:text-gemini-blue transition">
                        {event.name}
                      </h3>
                      <p className="text-base sm:text-lg text-gray-600 mb-4">
                        {formatDate(event.date)}
                      </p>
                      <span className="inline-block bg-gemini-red text-white px-4 py-2 sm:px-6 sm:py-3 rounded-full font-bold text-xs sm:text-sm tracking-wider group-hover:bg-gemini-red/90 transition">
                        View Results →
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-20">
              <p className="text-xl sm:text-2xl text-gray-600 mb-8">No recent races available</p>
              <p className="text-base sm:text-lg text-gray-500">Check back soon for live results!</p>
            </div>
          )}
          <div className="text-center mt-20">
            <p className="text-lg sm:text-xl text-gray-600 mb-8">
              Or use the search bar at the top to find any race
            </p>
            <div className="text-6xl sm:text-8xl">🔍</div>
          </div>
        </div>
      </div>
    );
  }
  // === FULL RESULTS VIEW ===
  const eventDate = new Date(selectedEvent.date + 'T12:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isToday = eventDate.toDateString() === today.toDateString();
  const isTomorrow = eventDate.toDateString() === tomorrow.toDateString();
  const isUpcoming = eventDate > today;
  const formattedDate = formatDate(selectedEvent.date);
  // Deduplication
  const uniqueResults = results.reduce((acc, current) => {
    const key = [
      (current.bib || '').toString().trim(),
      (current.first_name || '').trim().toLowerCase(),
      (current.last_name || '').trim().toLowerCase(),
      (current.chip_time || current.clock_time || '').trim(),
      (current.place || '').toString().trim(),
      (current.age || '').toString().trim(),
      (current.gender || '').trim().toUpperCase(),
    ].join('|');
    if (!acc.seen.has(key)) {
      acc.seen.add(key);
      acc.results.push(current);
    }
    return acc;
  }, { seen: new Set(), results: [] }).results;
  // Group by race_id
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
    <div className="min-h-screen bg-gemini-light-gray pt-40 py-12">
      <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12">
        {error && <p className="text-center text-red-600 text-lg sm:text-xl font-bold mb-8">{error}</p>}
        {/* Event Header */}
        <div className="text-center mb-12">
          <img
            src={eventLogos[selectedEvent.id] || '/GRR.png'}
            alt="Event Logo"
            className="mx-auto max-h-32 sm:max-h-40 mb-6"
          />
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gemini-dark-gray">{selectedEvent.name}</h1>
          <p className="text-lg sm:text-xl md:text-2xl text-gray-600 mt-2">{formattedDate}</p>
        </div>
        {loadingResults ? (
          <div className="text-center py-20">
            <div className="text-6xl sm:text-8xl animate-spin inline-block">🏃</div>
            <p className="text-xl sm:text-2xl mt-6">Loading results...</p>
          </div>
        ) : uniqueResults.length === 0 && isUpcoming ? (
          <div className="text-center py-20">
            <p className="text-2xl sm:text-3xl font-bold text-gemini-dark-gray mb-4">
              Results will be available once the race begins!
            </p>
            <p className="text-lg sm:text-xl text-gray-600 mb-8">
              {isToday
                ? 'This race is happening today — check back soon for live results!'
                : isTomorrow
                  ? 'This race is tomorrow — results will appear after the start!'
                  : `This race is scheduled for ${formattedDate} — results will appear after finishers cross the line.`}
            </p>
            <div className="text-6xl sm:text-8xl">⏱️</div>
          </div>
        ) : uniqueResults.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-xl sm:text-2xl text-gray-600">No results available yet.</p>
          </div>
        ) : (
          <>
            {/* Jump Links */}
            <div className="text-center mb-12">
              <p className="text-base sm:text-lg font-semibold text-gray-700 mb-4">Jump to Race:</p>
              <div className="flex flex-wrap justify-center gap-3 sm:gap-4">
                {racesToShow.map(r => (
                  <button
                    key={r.race_id}
                    onClick={() => scrollToRace(r.race_id)}
                    className="px-4 py-2 sm:px-6 sm:py-3 bg-gemini-blue text-white rounded-full hover:bg-gemini-blue/80 font-medium text-sm sm:text-base transition"
                  >
                    {r.race_name}
                  </button>
                ))}
              </div>
            </div>
            {/* Race Sections */}
            {racesToShow.map(race => {
              const raceResults = grouped[race.race_id] || [];
              const filters = raceFilters[race.race_id] || { search: '', gender: '', division: '' };
              const filtered = raceResults.filter(r => {
                const nameMatch = !filters.search ||
                  `${r.first_name} ${r.last_name}`.toLowerCase().includes(filters.search.toLowerCase());
                const bibMatch = !filters.search ||
                  (r.bib && r.bib.toString().includes(filters.search));
                const genderMatch = !filters.gender || r.gender === filters.gender;
                const divMatch = !filters.division || r.age_group_name === filters.division;
                return (nameMatch || bibMatch) && genderMatch && divMatch;
              });
              const sorted = [...filtered].sort((a, b) =>
                (a.place || Infinity) - (b.place || Infinity)
              );
              const page = currentPages[race.race_id] || 1;
              const start = (page - 1) * pageSize;
              const display = sorted.slice(start, start + pageSize);
              const totalPages = Math.ceil(sorted.length / pageSize);
              const topM = sorted.filter(r => r.gender === 'M').slice(0, 3);
              const topF = sorted.filter(r => r.gender === 'F').slice(0, 3);
              return (
                <div
                  key={race.race_id}
                  ref={el => (raceRefs.current[race.race_id] = el)}
                  className="mb-20 scroll-mt-32"
                >
                  <h3 className="text-2xl sm:text-3xl font-bold text-center mb-8">{race.race_name}</h3>
                  {/* Leaderboard */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 mb-12 max-w-5xl mx-auto">
                    <div>
                      <h4 className="text-xl sm:text-2xl font-bold mb-4">Top Males</h4>
                      {topM.length === 0 ? (
                        <p className="text-gray-500">No male finishers</p>
                      ) : (
                        topM.map((w, i) => (
                          <div key={i} className="mb-4 p-4 bg-white rounded-lg shadow">
                            <p className="font-bold text-base sm:text-lg">{i + 1}. {w.first_name} {w.last_name}</p>
                            <p className="text-sm sm:text-base">Time: {w.chip_time || 'N/A'}</p>
                            <p className="text-sm sm:text-base">Age: {w.age || 'N/A'}</p>
                          </div>
                        ))
                      )}
                    </div>
                    <div>
                      <h4 className="text-xl sm:text-2xl font-bold mb-4">Top Females</h4>
                      {topF.length === 0 ? (
                        <p className="text-gray-500">No female finishers</p>
                      ) : (
                        topF.map((w, i) => (
                          <div key={i} className="mb-4 p-4 bg-white rounded-lg shadow">
                            <p className="font-bold text-base sm:text-lg">{i + 1}. {w.first_name} {w.last_name}</p>
                            <p className="text-sm sm:text-base">Time: {w.chip_time || 'N/A'}</p>
                            <p className="text-sm sm:text-base">Age: {w.age || 'N/A'}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                  {/* Per-Race Filters */}
                  <div className="max-w-4xl mx-auto mb-8 bg-white p-4 sm:p-6 rounded-lg shadow-md">
                    <div className="grid grid-cols-1 gap-4">
                      <input
                        type="text"
                        placeholder="Search Bib or Name..."
                        value={filters.search}
                        onChange={e => setRaceFilters(p => ({
                          ...p,
                          [race.race_id]: { ...p[race.race_id], search: e.target.value }
                        }))}
                        className="p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gemini-blue"
                      />
                      <select
                        value={filters.gender}
                        onChange={e => setRaceFilters(p => ({
                          ...p,
                          [race.race_id]: { ...p[race.race_id], gender: e.target.value }
                        }))}
                        className="p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gemini-blue"
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
                        className="p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gemini-blue"
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
                        className="mt-4 text-gemini-red hover:underline text-sm"
                      >
                        Clear filters
                      </button>
                    )}
                  </div>
                  {/* Table with horizontal scroll on mobile */}
                  <div className="overflow-x-auto max-w-4xl mx-auto">
                    <ResultsTable data={display} onNameClick={handleNameClick} />
                  </div>
                  {/* Pagination */}
                  {sorted.length > pageSize && (
                    <div className="text-center mt-8">
                      <div className="flex flex-col sm:flex-row justify-center items-center gap-4 sm:gap-6">
                        <button
                          onClick={() => setCurrentPages(p => ({ ...p, [race.race_id]: Math.max(1, (p[race.race_id] || 1) - 1) }))}
                          disabled={(currentPages[race.race_id] || 1) === 1}
                          className="w-full sm:w-auto px-6 py-3 bg-gemini-blue text-white rounded-lg disabled:bg-gray-400 hover:bg-gemini-blue/90 transition"
                        >
                          ← Previous
                        </button>
                        <span className="text-base sm:text-lg font-medium">
                          Page {currentPages[race.race_id] || 1} of {totalPages}
                          <span className="text-gray-600 ml-2">({sorted.length} total)</span>
                        </span>
                        <button
                          onClick={() => setCurrentPages(p => ({ ...p, [race.race_id]: (p[race.race_id] || 1) + 1 }))}
                          disabled={(currentPages[race.race_id] || 1) >= totalPages}
                          className="w-full sm:w-auto px-6 py-3 bg-gemini-blue text-white rounded-lg disabled:bg-gray-400 hover:bg-gemini-blue/90 transition"
                        >
                          Next →
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {/* Ads */}
            {ads.length > 0 && (
              <div className="mt-16">
                <h3 className="text-2xl sm:text-3xl font-bold text-center mb-8">Our Sponsors</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
                  {ads.map((ad, i) => (
                    <img key={i} src={ad} alt="Sponsor" className="w-full rounded-lg shadow-lg" />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}