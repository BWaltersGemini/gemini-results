// src/components/ResultsTable.jsx
// COMPLETE & FIXED VERSION — Works perfectly with ResultsPage
// • Full pagination (desktop) + "Load More" (mobile)
// • Page size selector
// • DNF table styling
// • Highlighting
// • Mobile cards with full info
// • Safe defaults when pagination props are missing

import { useNavigate } from 'react-router-dom';

export default function ResultsTable({
  data = [],
  totalResults,           // Optional — if not provided, use data.length
  currentPage = 1,
  setCurrentPage,
  pageSize = 50,
  setPageSize,
  onNameClick,
  isMobile = false,
  highlightedBib = null,
  isDnfTable = false,     // True for "Did Not Finish" section
}) {
  const formatPlace = (place) => {
    if (!place || place < 1) return '—';
    const num = Number(place);
    if (isNaN(num)) return '—';
    if (num % 100 >= 11 && num % 100 <= 13) return `${num}th`;
    switch (num % 10) {
      case 1: return `${num}st`;
      case 2: return `${num}nd`;
      case 3: return `${num}rd`;
      default: return `${num}th`;
    }
  };

  const handleRowClick = (participant) => {
    if (onNameClick) onNameClick(participant);
  };

  const getRowKey = (r) => (r.entry_id ? r.entry_id : `${r.bib || 'unknown'}-${r.race_id || 'overall'}`);

  // Use provided totalResults or fall back to data.length
  const safeTotalResults = totalResults !== undefined ? Number(totalResults) : data.length;
  const safePageSize = Number(pageSize) || 50;

  if (data.length === 0) {
    return (
      <div className="text-center py-20 text-gray-500">
        <p className="text-3xl font-bold text-brand-dark">
          {isDnfTable ? 'No DNF/DQ participants in this race' : 'No results to display'}
        </p>
        <p className="text-xl mt-4">
          {isDnfTable ? '' : 'This may be due to filters or results not yet published.'}
        </p>
      </div>
    );
  }

  // Pagination logic — only active if setCurrentPage and setPageSize are provided
  const hasPagination = typeof setCurrentPage === 'function' && typeof setPageSize === 'function';
  const totalPages = hasPagination && safePageSize > 0 ? Math.ceil(safeTotalResults / safePageSize) : 1;
  const safeCurrentPage = hasPagination ? Math.max(1, Math.min(currentPage, totalPages)) : 1;

  const startIdx = hasPagination ? (safeCurrentPage - 1) * safePageSize : 0;
  const endIdx = hasPagination ? Math.min(startIdx + safePageSize, safeTotalResults) : safeTotalResults;

  const displayedData = hasPagination ? data.slice(startIdx, endIdx) : data;

  const pageOptions = [25, 50, 100, 200];

  // ====================== MOBILE VIEW ======================
  if (isMobile) {
    return (
      <div className="space-y-6">
        {displayedData.map((r) => {
          const isHighlighted = highlightedBib && String(r.bib) === String(highlightedBib);
          return (
            <div
              key={getRowKey(r)}
              className={`bg-white rounded-3xl shadow-xl border-2 p-6 cursor-pointer transition-all duration-200 active:scale-98 ${
                isHighlighted ? 'border-primary shadow-2xl ring-4 ring-primary/20' : 'border-gray-200'
              } ${isDnfTable ? 'bg-red-50 border-red-300' : ''}`}
              onClick={() => handleRowClick(r)}
            >
              <div className="flex justify-between items-center mb-4">
                <div className="text-4xl font-black text-primary">
                  {isDnfTable ? 'DNF' : (r.place ? formatPlace(r.place) : '—')}
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-brand-dark">Bib {r.bib || '—'}</div>
                </div>
              </div>

              <h3 className="text-3xl font-bold text-brand-dark mb-3 flex items-center gap-2">
                {r.first_name} {r.last_name}
                <span className="text-xl text-gray-400">→</span>
              </h3>

              {isDnfTable ? (
                <div className="text-center py-4">
                  <p className="text-2xl font-bold text-red-600">Did Not Finish</p>
                  <p className="text-lg text-gray-600 mt-2">
                    Last recorded time: {r.chip_time || '—'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div className="bg-primary/10 rounded-xl py-4">
                    <div className="text-2xl font-bold text-primary">{r.chip_time || '—'}</div>
                    <div className="text-sm text-gray-700">Chip Time</div>
                  </div>
                  <div className="bg-brand-light rounded-xl py-4">
                    <div className="text-2xl font-bold text-brand-dark">{r.pace || '—'}</div>
                    <div className="text-sm text-gray-700">Pace</div>
                  </div>
                  <div className="bg-gray-100 rounded-xl py-4">
                    <div className="text-2xl font-bold text-brand-dark">{r.age || '—'}</div>
                    <div className="text-sm text-gray-700">Age</div>
                  </div>
                  <div className="bg-gray-50 rounded-xl py-4">
                    <div className="text-xl font-medium text-brand-dark line-clamp-2">
                      {r.city && `${r.city}, `}{r.state || ''} {r.country || ''}
                    </div>
                    <div className="text-sm text-gray-700">Location</div>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Mobile Load More */}
        {hasPagination && endIdx < safeTotalResults && (
          <div className="text-center mt-10">
            <button
              onClick={() => setCurrentPage(prev => prev + 1)}
              className="px-16 py-6 bg-primary text-white text-2xl font-bold rounded-full hover:bg-primary/90 transition shadow-2xl"
            >
              Load More ({endIdx + 1}–{Math.min(endIdx + safePageSize, safeTotalResults)} of {safeTotalResults})
            </button>
          </div>
        )}
      </div>
    );
  }

  // ====================== DESKTOP VIEW ======================
  return (
    <div>
      {/* Top Pagination Controls */}
      {hasPagination && (
        <div className="flex flex-col sm:flex-row justify-between items-center gap-6 mb-8 px-6">
          <div className="flex items-center gap-3 flex-wrap">
            <button onClick={() => setCurrentPage(1)} disabled={safeCurrentPage === 1} className="px-5 py-3 bg-primary text-white rounded-lg font-medium disabled:opacity-50 hover:bg-primary/90 transition shadow-md">
              First
            </button>
            <button onClick={() => setCurrentPage(Math.max(1, safeCurrentPage - 1))} disabled={safeCurrentPage === 1} className="px-5 py-3 bg-primary text-white rounded-lg font-medium disabled:opacity-50 hover:bg-primary/90 transition shadow-md">
              ← Prev
            </button>
            <span className="text-brand-dark font-medium">
              Page <strong>{safeCurrentPage}</strong> of <strong>{totalPages}</strong>
            </span>
            <button onClick={() => setCurrentPage(Math.min(totalPages, safeCurrentPage + 1))} disabled={safeCurrentPage === totalPages} className="px-5 py-3 bg-primary text-white rounded-lg font-medium disabled:opacity-50 hover:bg-primary/90 transition shadow-md">
              Next →
            </button>
            <button onClick={() => setCurrentPage(totalPages)} disabled={safeCurrentPage === totalPages} className="px-5 py-3 bg-primary text-white rounded-lg font-medium disabled:opacity-50 hover:bg-primary/90 transition shadow-md">
              Last
            </button>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-brand-dark font-medium">Show:</span>
            <select
              value={safePageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-4 focus:ring-primary/30"
            >
              {pageOptions.map(size => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
            <span className="text-brand-dark font-medium">per page</span>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto -mx-6 px-6">
        <table className="w-full text-left">
          <thead className={`font-bold uppercase text-sm tracking-wider ${isDnfTable ? 'bg-red-100 text-red-800' : 'bg-primary/10 text-brand-dark'}`}>
            <tr>
              <th className="px-6 py-5">Place</th>
              <th className="px-6 py-5">Bib</th>
              <th className="px-6 py-5">Name</th>
              {!isDnfTable && (
                <>
                  <th className="px-6 py-5">Gender Place</th>
                  <th className="px-6 py-5">Division Place</th>
                </>
              )}
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
                  className={`hover:bg-primary/5 cursor-pointer transition duration-200 group ${
                    isHighlighted ? 'bg-primary/10 font-bold ring-2 ring-primary/30' : ''
                  } ${isDnfTable ? 'bg-red-50' : ''}`}
                  onClick={() => handleRowClick(r)}
                >
                  <td className="px-6 py-5 font-black text-xl text-primary">
                    {isDnfTable ? 'DNF' : (r.place ? formatPlace(r.place) : '—')}
                  </td>
                  <td className="px-6 py-5 font-semibold text-lg text-brand-dark">{r.bib || '—'}</td>
                  <td className="px-6 py-5 font-semibold text-brand-dark group-hover:text-primary group-hover:underline transition">
                    <span className="flex items-center gap-2">
                      {r.first_name} {r.last_name}
                      <span className="text-gray-400 text-sm opacity-0 group-hover:opacity-100 transition">→</span>
                    </span>
                  </td>
                  {!isDnfTable && (
                    <>
                      <td className="px-6 py-5 font-medium text-brand-dark">
                        {r.gender_place ? formatPlace(r.gender_place) : '—'}
                      </td>
                      <td className="px-6 py-5 font-medium text-brand-dark whitespace-nowrap">
                        {r.age_group_place ? (
                          <span>
                            {formatPlace(r.age_group_place)} {r.age_group_name || ''}
                          </span>
                        ) : '—'}
                      </td>
                    </>
                  )}
                  <td className="px-6 py-5 font-semibold text-brand-dark">{r.chip_time || '—'}</td>
                  <td className="px-6 py-5 text-brand-dark">{r.pace || '—'}</td>
                  <td className="px-6 py-5 text-brand-dark">{r.age || '—'}</td>
                  <td className="px-6 py-5 text-gray-600">
                    {r.city && `${r.city}, `}{r.state} {r.country}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Bottom Pagination Info */}
      {hasPagination && (
        <div className="flex flex-col sm:flex-row justify-between items-center gap-6 mt-12 px-6">
          <div className="text-lg text-brand-dark">
            Showing {startIdx + 1}–{endIdx} of {safeTotalResults} results
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setCurrentPage(1)} disabled={safeCurrentPage === 1} className="px-5 py-3 bg-primary text-white rounded-lg font-medium disabled:opacity-50 hover:bg-primary/90 transition shadow-md">
              First
            </button>
            <button onClick={() => setCurrentPage(Math.max(1, safeCurrentPage - 1))} disabled={safeCurrentPage === 1} className="px-5 py-3 bg-primary text-white rounded-lg font-medium disabled:opacity-50 hover:bg-primary/90 transition shadow-md">
              ← Prev
            </button>
            <span className="text-brand-dark font-medium">
              Page <strong>{safeCurrentPage}</strong> of <strong>{totalPages}</strong>
            </span>
            <button onClick={() => setCurrentPage(Math.min(totalPages, safeCurrentPage + 1))} disabled={safeCurrentPage === totalPages} className="px-5 py-3 bg-primary text-white rounded-lg font-medium disabled:opacity-50 hover:bg-primary/90 transition shadow-md">
              Next →
            </button>
            <button onClick={() => setCurrentPage(totalPages)} disabled={safeCurrentPage === totalPages} className="px-5 py-3 bg-primary text-white rounded-lg font-medium disabled:opacity-50 hover:bg-primary/90 transition shadow-md">
              Last
            </button>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-brand-dark font-medium">Show:</span>
            <select
              value={safePageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-4 focus:ring-primary/30"
            >
              {pageOptions.map(size => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
            <span className="text-brand-dark font-medium">per page</span>
          </div>
        </div>
      )}
    </div>
  );
}