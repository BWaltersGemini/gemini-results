// src/pages/ResultsPage.jsx (OPTIMIZED FOR MOBILE: Virtualized table + better UX)

import { useContext, useState, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { FixedSizeList as List } from 'react-window';
import { RaceContext } from '../context/RaceContext';

const PAGE_SIZE = 25; // Increased from 10 — much better on mobile

function ResultsRow({ index, style, data }) {
  const { row, onNameClick } = data;
  const r = row;

  return (
    <div style={style} className="border-b border-gray-200 hover:bg-gemini-light-gray transition">
      <div className="grid grid-cols-12 gap-2 px-4 py-3 text-sm">
        <div className="col-span-2 font-bold text-gemini-blue text-center">{r.place || '-'}</div>
        <div className="col-span-5">
          <button
            onClick={() => onNameClick(r)}
            className="font-medium text-gemini-dark-gray hover:text-gemini-blue hover:underline"
          >
            {r.first_name} {r.last_name}
          </button>
          {r.bib && <div className="text-xs text-gray-500">Bib: {r.bib}</div>}
        </div>
        <div className="col-span-2 text-center">{r.gender || '-'}</div>
        <div className="col-span-1 text-center">{r.age || '-'}</div>
        <div className="col-span-2 text-right font-medium">{r.chip_time || 'N/A'}</div>
      </div>
    </div>
  );
}

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

  const [currentPages, setCurrentPages] = useState({});
  const [raceFilters, setRaceFilters] = useState({});
  const raceRefs = useRef({});

  const formatDate = (dateStr) => {
    const [year, month, day] = dateStr.split('-');
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  // Landing page when no event selected
  if (!selectedEvent) {
    const recentEvents = [...events]
      .filter(e => new Date(e.date) <= new Date())
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 6);

    return (
      <div className="min-h-screen bg-gradient-to-b from-gemini-light-gray to-white pt-40 py-20">
        <div className="w-full px-4">
          <div className="text-center mb-16">
            <h1 className="text-4xl md:text-6xl font-black text-gemini-dark-gray mb-4">Race Results</h1>
            <p className="text-lg md:text-xl text-gray-700 max-w-2xl mx-auto">
              Select a race to view live results and leaderboards
            </p>
          </div>

          {recentEvents.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
              {recentEvents.map((event, i) => (
                <button
                  key={event.id}
                  onClick={() => setSelectedEvent(event)}
                  className="bg-white rounded-2xl shadow-xl overflow-hidden hover:shadow-2xl hover:scale-105 transition-all"
                >
                  <div className="h-40 bg-gradient-to-br from-gemini-blue to-gemini-dark-gray flex items-center justify-center">
                    {eventLogos[event.id] ? (
                      <img src={eventLogos[event.id]} alt={event.name} className="h-32 object-contain" />
                    ) : (
                      <span className="text-white text-6xl">🏁</span>
                    )}
                  </div>
                  <div className="p-6 text-center">
                    <h3 className="text-xl font-bold text-gemini-dark-gray mb-2">{event.name}</h3>
                    <p className="text-gray-600">{formatDate(event.date)}</p>
                    <span className="mt-4 inline-block bg-gemini-red text-white px-6 py-2 rounded-full text-sm font-bold">
                      View Results →
                    </span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-20">
              <p className="text-xl text-gray-600">No recent races available</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // === FULL RESULTS VIEW ===
  const formattedDate = formatDate(selectedEvent.date);

  // Deduplicate + group
  const processedResults = useMemo(() => {
    const seen = new Set();
    const unique = [];
    results.forEach(r => {
      const key = `${r.bib || ''}|${r.first_name?.toLowerCase() || ''}|${r.last_name?.toLowerCase() || ''}|${r.chip_time || r.clock_time || ''}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(r);
      }
    });
    return unique;
  }, [results]);

  const grouped = useMemo(() => {
    const g = {};
    processedResults.forEach(r => {
      const id = r.race_id || 'overall';
      if (!g[id]) g[id] = [];
      g[id].push(r);
    });
    return g;
  }, [processedResults]);

  const racesToShow = races.length > 0
    ? races
    : Object.keys(grouped).map(id => ({
        race_id: id,
        race_name: id === 'overall' ? 'Overall Results' : `Race ${id}`
      }));

  const scrollToRace = (raceId) => {
    raceRefs.current[raceId]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  const handleNameClick = (participant) => {
    navigate('/participant', { state: { participant, selectedEvent, results: processedResults, eventLogos, ads } });
  };

  return (
    <div className="min-h-screen bg-gemini-light-gray pt-40 pb-20">
      <div className="w-full px-4">
        {error && <p className="text-center text-red-600 text-lg font-bold mb-6">{error}</p>}

        {/* Header */}
        <div className="text-center mb-10">
          <img src={eventLogos[selectedEvent.id] || '/GRR.png'} alt="Logo" className="mx-auto max-h-32 mb-4" />
          <h1 className="text-3xl md:text-4xl font-bold text-gemini-dark-gray">{selectedEvent.name}</h1>
          <p className="text-lg text-gray-600 mt-2">{formattedDate}</p>
        </div>

        {loadingResults ? (
          <div className="text-center py-20">
            <div className="text-6xl animate-spin inline-block mb-4">🏃</div>
            <p className="text-xl">Loading {results.length > 0 ? 'more ' : ''}results...</p>
          </div>
        ) : processedResults.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-2xl text-gray-600">No results available yet</p>
          </div>
        ) : (
          <>
            {/* Jump to Race */}
            {racesToShow.length > 1 && (
              <div className="mb-8 overflow-x-auto pb-2">
                <div className="flex gap-3 justify-center">
                  {racesToShow.map(r => (
                    <button
                      key={r.race_id}
                      onClick={() => scrollToRace(r.race_id)}
                      className="px-5 py-2 bg-gemini-blue text-white rounded-full text-sm whitespace-nowrap"
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

              const filteredAndSorted = useMemo(() => {
                return raceResults
                  .filter(r => {
                    if (filters.search) {
                      const search = filters.search.toLowerCase();
                      return (
                        `${r.first_name} ${r.last_name}`.toLowerCase().includes(search) ||
                        (r.bib && r.bib.toString().includes(search))
                      );
                    }
                    if (filters.gender && r.gender !== filters.gender) return false;
                    if (filters.division && r.age_group_name !== filters.division) return false;
                    return true;
                  })
                  .sort((a, b) => (a.place || Infinity) - (b.place || Infinity));
              }, [raceResults, filters]);

              const page = currentPages[race.race_id] || 1;
              const totalPages = Math.ceil(filteredAndSorted.length / PAGE_SIZE);

              const topM = filteredAndSorted.filter(r => r.gender === 'M').slice(0, 3);
              const topF = filteredAndSorted.filter(r => r.gender === 'F').slice(0, 3);

              return (
                <div key={race.race_id} ref={el => (raceRefs.current[race.race_id] = el)} className="mb-16">
                  <h3 className="text-2xl font-bold text-center mb-6">{race.race_name}</h3>

                  {/* Leaderboard */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    <div className="bg-white rounded-xl shadow p-5">
                      <h4 className="text-xl font-bold mb-4 text-center">Top Males</h4>
                      {topM.map((w, i) => (
                        <div key={i} className="flex justify-between py-2 border-b last:border-0">
                          <span className="font-bold">{i + 1}. {w.first_name} {w.last_name}</span>
                          <span>{w.chip_time}</span>
                        </div>
                      ))}
                    </div>
                    <div className="bg-white rounded-xl shadow p-5">
                      <h4 className="text-xl font-bold mb-4 text-center">Top Females</h4>
                      {topF.map((w, i) => (
                        <div key={i} className="flex justify-between py-2 border-b last:border-0">
                          <span className="font-bold">{i + 1}. {w.first_name} {w.last_name}</span>
                          <span>{w.chip_time}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Filters */}
                  <div className="bg-white rounded-xl shadow p-4 mb-6">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <input
                        type="text"
                        placeholder="Search name or bib..."
                        value={filters.search}
                        onChange={e => setRaceFilters(p => ({
                          ...p,
                          [race.race_id]: { ...p[race.race_id], search: e.target.value }
                        }))}
                        className="px-4 py-2 border rounded-lg"
                      />
                      <select
                        value={filters.gender}
                        onChange={e => setRaceFilters(p => ({
                          ...p,
                          [race.race_id]: { ...p[race.race_id], gender: e.target.value }
                        }))}
                        className="px-4 py-2 border rounded-lg"
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
                        className="px-4 py-2 border rounded-lg"
                      >
                        <option value="">All Divisions</option>
                        {uniqueDivisions.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Virtualized Table */}
                  <div className="bg-white rounded-xl shadow overflow-hidden">
                    <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-gemini-blue text-white font-bold text-sm">
                      <div className="col-span-2 text-center">Place</div>
                      <div className="col-span-5">Name</div>
                      <div className="col-span-2 text-center">Gender</div>
                      <div className="col-span-1 text-center">Age</div>
                      <div className="col-span-2 text-right">Time</div>
                    </div>

                    {filteredAndSorted.length === 0 ? (
                      <p className="text-center py-8 text-gray-500">No results match filters</p>
                    ) : (
                      <List
                        height={Math.min(filteredAndSorted.length * 60, 800)} // Max ~13 rows visible
                        itemCount={filteredAndSorted.length}
                        itemSize={60}
                        itemData={{ rows: filteredAndSorted, onNameClick: handleNameClick }}
                      >
                        {({ index, style, data }) => (
                          <ResultsRow index={index} style={style} data={{ row: data.rows[index], onNameClick: data.onNameClick }} />
                        )}
                      </List>
                    )}
                  </div>

                  {/* Pagination */}
                  {filteredAndSorted.length > PAGE_SIZE && (
                    <div className="flex justify-center gap-4 mt-6">
                      <button
                        onClick={() => setCurrentPages(p => ({ ...p, [race.race_id]: Math.max(1, page - 1) }))}
                        disabled={page === 1}
                        className="px-6 py-3 bg-gemini-blue text-white rounded-lg disabled:opacity-50"
                      >
                        Previous
                      </button>
                      <span className="py-3 px-6">
                        Page {page} of {totalPages} ({filteredAndSorted.length} total)
                      </span>
                      <button
                        onClick={() => setCurrentPages(p => ({ ...p, [race.race_id]: page + 1 }))}
                        disabled={page >= totalPages}
                        className="px-6 py-3 bg-gemini-blue text-white rounded-lg disabled:opacity-50"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Ads */}
            {ads.length > 0 && (
              <div className="mt-12">
                <h3 className="text-2xl font-bold text-center mb-6">Our Sponsors</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {ads.map((ad, i) => (
                    <img key={i} src={ad} alt="Sponsor" className="w-full rounded-lg shadow" />
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