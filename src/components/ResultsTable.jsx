// src/components/ResultsTable.jsx (FINAL — Fixed ordinal places + Pagination controls + No empty rows)
import { useNavigate } from 'react-router-dom';
import { formatChronoTime } from '../utils/timeUtils';

export default function ResultsTable({ 
  data = [], 
  onNameClick, 
  isMobile, 
  highlightedBib, 
  highlightedRowRef,
  currentPage,
  setCurrentPage,
  pageSize,
  setPageSize,
  totalResults 
}) {
  const navigate = useNavigate();

  // CORRECT ordinal suffix (1st, 2nd, 3rd, 4th, ..., 21st, 22nd, 23rd, etc.)
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

  // No results message
  if (data.length === 0) {
    return (
      <div className="text-center py-16 text-gray-500">
        <p className="text-2xl font-medium">No results match your filters</p>
        <p className="text-lg mt-2">Try adjusting your search or filters</p>
      </div>
    );
  }

  // Calculate pagination
  const totalPages = Math.ceil(totalResults / pageSize);
  const pageOptions = [10, 25, 50, 100];

  const goToFirstPage = () => setCurrentPage(1);
  const goToLastPage = () => setCurrentPage(totalPages);

  // Mobile view
  if (isMobile) {
    return (
      <div className="space-y-5">
        {data.map((r) => {
          const isHighlighted = highlightedBib && String(r.bib) === String(highlightedBib);
          return (
            <div
              key={getRowKey(r)}
              ref={isHighlighted ? highlightedRowRef : null}
              className={`bg-white rounded-2xl shadow-lg border ${
                isHighlighted ? 'border-gemini-blue border-4 shadow-2xl' : 'border-gray-300'
              } cursor-pointer transition-all duration-200 active:scale-98 active:bg-gemini-blue/5`}
              onClick={() => handleRowClick(r)}
            >
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="text-3xl font-black text-gemini-blue">
                    {r.place ? formatPlace(r.place) : '—'}
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold text-gemini-dark-gray">{r.bib || '—'}</div>
                    <div className="text-sm text-gray-500">Bib</div>
                  </div>
                </div>
                <div className="mb-5">
                  <div className="text-2xl font-bold text-gemini-dark-gray truncate">
                    {r.first_name} {r.last_name}
                  </div>
                  <div className="text-base text-gray-600 mt-1 truncate">
                    {r.city && `${r.city}, `}{r.state} {r.country}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div className="bg-gemini-blue/5 rounded-lg py-3">
                    <div className="text-xl font-bold text-gemini-blue">{formatChronoTime(r.chip_time)}</div>
                    <div className="text-sm text-gray-700 font-medium">Time</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg py-3">
                    <div className="text-xl font-bold text-gray-900">{formatPlace(r.gender_place)}</div>
                    <div className="text-sm text-gray-700 font-medium">Gender</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg py-3">
                    <div className="text-xl font-bold text-gray-900">
                      {r.age_group_place ? `${formatPlace(r.age_group_place)} ${r.age_group_name || ''}`.trim() : '—'}
                    </div>
                    <div className="text-sm text-gray-700 font-medium">Division</div>
                  </div>
                  <div className="bg-gemini-blue/5 rounded-lg py-3">
                    <div className="text-xl font-bold text-gray-900">{r.pace || '—'}</div>
                    <div className="text-sm text-gray-700 font-medium">Pace</div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // Desktop Table
  return (
    <div>
      {/* Pagination Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6 px-6">
        <div className="flex items-center gap-3">
          <button
            onClick={goToFirstPage}
            disabled={currentPage === 1}
            className="px-5 py-2 bg-gemini-blue text-white rounded-lg font-medium disabled:opacity-50 hover:bg-gemini-blue/90 transition"
          >
            First
          </button>
          <button
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="px-5 py-2 bg-gemini-blue text-white rounded-lg font-medium disabled:opacity-50 hover:bg-gemini-blue/90 transition"
          >
            ← Prev
          </button>
          <span className="text-gray-700 font-medium">
            Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong> ({totalResults} results)
          </span>
          <button
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            className="px-5 py-2 bg-gemini-blue text-white rounded-lg font-medium disabled:opacity-50 hover:bg-gemini-blue/90 transition"
          >
            Next →
          </button>
          <button
            onClick={goToLastPage}
            disabled={currentPage === totalPages}
            className="px-5 py-2 bg-gemini-blue text-white rounded-lg font-medium disabled:opacity-50 hover:bg-gemini-blue/90 transition"
          >
            Last
          </button>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-gray-700 font-medium">Show:</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gemini-blue"
          >
            {pageOptions.map(size => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
          <span className="text-gray-700 font-medium">per page</span>
        </div>
      </div>

      {/* Table */}
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
            {data.map((r) => {
              const isHighlighted = highlightedBib && String(r.bib) === String(highlightedBib);
              return (
                <tr
                  key={getRowKey(r)}
                  ref={isHighlighted ? highlightedRowRef : null}
                  className={`hover:bg-gemini-blue/5 cursor-pointer transition duration-150 ${
                    isHighlighted ? 'bg-gemini-blue/10 font-bold' : ''
                  }`}
                  onClick={() => handleRowClick(r)}
                >
                  <td className="px-6 py-5 font-black text-xl text-gemini-blue">
                    {r.place ? formatPlace(r.place) : '—'}
                  </td>
                  <td className="px-6 py-5 font-semibold text-lg text-gray-900">{r.bib || '—'}</td>
                  <td className="px-6 py-5 font-semibold text-gemini-dark-gray">
                    {r.first_name} {r.last_name}
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

      {/* Bottom Pagination (mirrors top) */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mt-6 px-6">
        <div className="flex items-center gap-3">
          <button
            onClick={goToFirstPage}
            disabled={currentPage === 1}
            className="px-5 py-2 bg-gemini-blue text-white rounded-lg font-medium disabled:opacity-50 hover:bg-gemini-blue/90 transition"
          >
            First
          </button>
          <button
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="px-5 py-2 bg-gemini-blue text-white rounded-lg font-medium disabled:opacity-50 hover:bg-gemini-blue/90 transition"
          >
            ← Prev
          </button>
          <span className="text-gray-700 font-medium">
            Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong>
          </span>
          <button
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            className="px-5 py-2 bg-gemini-blue text-white rounded-lg font-medium disabled:opacity-50 hover:bg-gemini-blue/90 transition"
          >
            Next →
          </button>
          <button
            onClick={goToLastPage}
            disabled={currentPage === totalPages}
            className="px-5 py-2 bg-gemini-blue text-white rounded-lg font-medium disabled:opacity-50 hover:bg-gemini-blue/90 transition"
          >
            Last
          </button>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-gray-700 font-medium">Show:</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gemini-blue"
          >
            {pageOptions.map(size => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}