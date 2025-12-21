// src/components/ResultsTable.jsx (FINAL — Clickable names with subtle hint + Mobile pace fix)
import { useNavigate } from 'react-router-dom';
import { formatChronoTime } from '../utils/timeUtils';

export default function ResultsTable({
  data = [],
  onNameClick,
  isMobile,
  highlightedBib,
  highlightedRowRef,
  currentPage = 1,
  setCurrentPage,
  pageSize = 50,
  setPageSize,
  totalResults = 0
}) {
  const navigate = useNavigate();

  // CORRECT ordinal suffix (1st, 2nd, 3rd, 4th, 11th, etc.)
  const formatPlace = (place) => {
    if (!place || place < 1) return '—';
    const num = Number(place);
    if (isNaN(num)) return '—';
    if (num % 100 >= 11 && num % 100 <= 13) {
      return `${num}th`;
    }
    switch (num % 10) {
      case 1: return `${num}st`;
      case 2: return `${num}nd`;
      case 3: return `${num}rd`;
      default: return `${num}th`;
    }
  };

  const handleRowClick = (participant) => {
    if (onNameClick) {
      onNameClick(participant);
    }
  };

  // Stable unique key
  const getRowKey = (r) => {
    if (r.entry_id) return r.entry_id;
    return `${r.bib || 'unknown'}-${r.race_id || 'overall'}`;
  };

  if (data.length === 0) {
    return (
      <div className="text-center py-20 text-gray-500">
        <p className="text-3xl font-bold">No results match your filters</p>
        <p className="text-xl mt-4">Try adjusting your search or filters</p>
      </div>
    );
  }

  // Safe pagination calculations
  const safeTotalResults = Number(totalResults) || 0;
  const safePageSize = Number(pageSize) || 50;
  const totalPages = safePageSize > 0 ? Math.ceil(safeTotalResults / safePageSize) : 1;
  const safeCurrentPage = Math.max(1, Math.min(currentPage, totalPages));
  const startIdx = (safeCurrentPage - 1) * safePageSize;
  const endIdx = Math.min(startIdx + safePageSize, safeTotalResults);
  const displayedData = data.slice(startIdx, endIdx);

  const pageOptions = [25, 50, 100, 200];

  const goToFirstPage = () => setCurrentPage(1);
  const goToLastPage = () => setCurrentPage(totalPages);
  const handlePageSizeChange = (e) => {
    const newSize = Number(e.target.value);
    setPageSize(newSize);
    setCurrentPage(1);
  };

  // Mobile View
  if (isMobile) {
    return (
      <div className="space-y-6">
        {displayedData.map((r) => {
          const isHighlighted = highlightedBib && String(r.bib) === String(highlightedBib);
          return (
            <div
              key={getRowKey(r)}
              ref={isHighlighted ? highlightedRowRef : null}
              className={`bg-white rounded-3xl shadow-xl border-2 p-6 cursor-pointer transition-all duration-200 active:scale-98 ${
                isHighlighted ? 'border-gemini-blue shadow-2xl ring-4 ring-gemini-blue/20' : 'border-gray-200'
              }`}
              onClick={() => handleRowClick(r)}
            >
              <div className="flex justify-between items-center mb-4">
                <div className="text-4xl font-black text-gemini-blue">
                  {r.place ? formatPlace(r.place) : '—'}
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold">Bib {r.bib || '—'}</div>
                </div>
              </div>

              {/* Name with subtle right arrow hint */}
              <h3 className="text-3xl font-bold text-gemini-dark-gray mb-3 flex items-center gap-2">
                {r.first_name} {r.last_name}
                <span className="text-xl text-gray-400">→</span>
              </h3>

              <div className="grid grid-cols-2 gap-4 text-center">
                <div className="bg-gemini-blue/10 rounded-xl py-4">
                  <div className="text-2xl font-bold text-gemini-blue">{formatChronoTime(r.chip_time)}</div>
                  <div className="text-sm text-gray-700">Time</div>
                </div>
                <div className="bg-gray-100 rounded-xl py-4">
                  <div className="text-2xl font-bold text-gray-900">{r.pace || '—'}</div>
                  <div className="text-sm text-gray-700">Pace</div>
                </div>
              </div>
            </div>
          );
        })}

        {/* Load More Button (Mobile) */}
        {endIdx < safeTotalResults && (
          <div className="text-center mt-10">
            <button
              onClick={() => setCurrentPage(prev => prev + 1)}
              className="px-16 py-6 bg-gemini-blue text-white text-2xl font-bold rounded-full hover:bg-gemini-blue/90 transition shadow-2xl"
            >
              Load More ({endIdx + 1}–{Math.min(endIdx + safePageSize, safeTotalResults)} of {safeTotalResults})
            </button>
          </div>
        )}
      </div>
    );
  }

  // Desktop View
  return (
    <div>
      {/* Top Pagination Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-6 mb-8 px-6">
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={goToFirstPage}
            disabled={safeCurrentPage === 1}
            className="px-5 py-3 bg-gemini-blue text-white rounded-lg font-medium disabled:opacity-50 hover:bg-gemini-blue/90 transition"
          >
            First
          </button>
          <button
            onClick={() => setCurrentPage(Math.max(1, safeCurrentPage - 1))}
            disabled={safeCurrentPage === 1}
            className="px-5 py-3 bg-gemini-blue text-white rounded-lg font-medium disabled:opacity-50 hover:bg-gemini-blue/90 transition"
          >
            ← Prev
          </button>
          <span className="text-gray-700 font-medium">
            Page <strong>{safeCurrentPage}</strong> of <strong>{totalPages}</strong>
          </span>
          <button
            onClick={() => setCurrentPage(Math.min(totalPages, safeCurrentPage + 1))}
            disabled={safeCurrentPage === totalPages}
            className="px-5 py-3 bg-gemini-blue text-white rounded-lg font-medium disabled:opacity-50 hover:bg-gemini-blue/90 transition"
          >
            Next →
          </button>
          <button
            onClick={goToLastPage}
            disabled={safeCurrentPage === totalPages}
            className="px-5 py-3 bg-gemini-blue text-white rounded-lg font-medium disabled:opacity-50 hover:bg-gemini-blue/90 transition"
          >
            Last
          </button>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-gray-700 font-medium">Show:</span>
          <select
            value={safePageSize}
            onChange={handlePageSizeChange}
            className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gemini-blue"
          >
            {pageOptions.map(size => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
          <span className="text-gray-700 font-medium">per page</span>
        </div>
      </div>

      {/* Results Table */}
      <div className="overflow-x-auto -mx-6 px-6">
        <table className="w-full text-left">
          <thead className="bg-gemini-blue/20 text-gemini-dark-gray font-bold uppercase text-sm tracking-wider">
            <tr>
              <th className="px-6 py-5">Place</th>
              <th className="px-6 py-5">Bib</th>
              <th className="px-6 py-5">Name</th>
              <th className="px-6 py-5">Gender Place</th>
              <th className="px-6 py-5">Division Place</th>
              <th className="px-6 py-5">Time</th>
              <th className="px-6 py-5">Pace</th>
              <th className="px-6 py-5">Age</th>
              <th className="px-6 py-5">Location</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {displayedData.map((r) => {
              const isHighlighted = highlightedBib && String(r.bib) === String(highlightedBib);
              return (
                <tr
                  key={getRowKey(r)}
                  ref={isHighlighted ? highlightedRowRef : null}
                  className={`hover:bg-gemini-blue/5 cursor-pointer transition duration-200 group ${
                    isHighlighted ? 'bg-gemini-blue/10 font-bold ring-2 ring-gemini-blue/30' : ''
                  }`}
                  onClick={() => handleRowClick(r)}
                >
                  <td className="px-6 py-5 font-black text-xl text-gemini-blue">
                    {r.place ? formatPlace(r.place) : '—'}
                  </td>
                  <td className="px-6 py-5 font-semibold text-lg text-gray-900">{r.bib || '—'}</td>
                  <td className="px-6 py-5 font-semibold text-gemini-dark-gray group-hover:text-gemini-blue group-hover:underline transition">
                    <span className="flex items-center gap-2">
                      {r.first_name} {r.last_name}
                      <span className="text-gray-400 text-sm opacity-0 group-hover:opacity-100 transition">→</span>
                    </span>
                  </td>
                  <td className="px-6 py-5 font-medium text-gray-900">
                    {r.gender_place ? formatPlace(r.gender_place) : '—'}
                  </td>
                  <td className="px-6 py-5 font-medium text-gray-900 whitespace-nowrap">
                    {r.age_group_place ? (
                      <span>
                        {formatPlace(r.age_group_place)} {r.age_group_name || ''}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-6 py-5 font-semibold text-gray-900">{formatChronoTime(r.chip_time)}</td>
                  <td className="px-6 py-5 text-gray-900">{r.pace || '—'}</td>
                  <td className="px-6 py-5 text-gray-900">{r.age || '—'}</td>
                  <td className="px-6 py-5 text-gray-600">
                    {r.city && `${r.city}, `}{r.state} {r.country}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Bottom Pagination Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-6 mt-12 px-6">
        <div className="text-lg text-gray-700">
          Showing {startIdx + 1}–{endIdx} of {safeTotalResults} results
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={goToFirstPage}
            disabled={safeCurrentPage === 1}
            className="px-5 py-3 bg-gemini-blue text-white rounded-lg font-medium disabled:opacity-50 hover:bg-gemini-blue/90 transition"
          >
            First
          </button>
          <button
            onClick={() => setCurrentPage(Math.max(1, safeCurrentPage - 1))}
            disabled={safeCurrentPage === 1}
            className="px-5 py-3 bg-gemini-blue text-white rounded-lg font-medium disabled:opacity-50 hover:bg-gemini-blue/90 transition"
          >
            ← Prev
          </button>
          <span className="text-gray-700 font-medium">
            Page <strong>{safeCurrentPage}</strong> of <strong>{totalPages}</strong>
          </span>
          <button
            onClick={() => setCurrentPage(Math.min(totalPages, safeCurrentPage + 1))}
            disabled={safeCurrentPage === totalPages}
            className="px-5 py-3 bg-gemini-blue text-white rounded-lg font-medium disabled:opacity-50 hover:bg-gemini-blue/90 transition"
          >
            Next →
          </button>
          <button
            onClick={goToLastPage}
            disabled={safeCurrentPage === totalPages}
            className="px-5 py-3 bg-gemini-blue text-white rounded-lg font-medium disabled:opacity-50 hover:bg-gemini-blue/90 transition"
          >
            Last
          </button>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-gray-700 font-medium">Show:</span>
          <select
            value={safePageSize}
            onChange={handlePageSizeChange}
            className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gemini-blue"
          >
            {pageOptions.map(size => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
          <span className="text-gray-700 font-medium">per page</span>
        </div>
      </div>
    </div>
  );
}