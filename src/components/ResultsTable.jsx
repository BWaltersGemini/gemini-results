// src/components/ResultsTable.jsx (FINAL — Clean time display + enhanced UX)
import { useNavigate } from 'react-router-dom';
import { formatChronoTime } from '../utils/timeUtils'; // ← Clean time formatter

export default function ResultsTable({ data = [], onNameClick, isMobile }) {
  const navigate = useNavigate();

  const formatPlace = (place) => {
    if (!place) return '—';
    if (place === 1) return `${place}st`;
    if (place === 2) return `${place}nd`;
    if (place === 3) return `${place}rd`;
    return `${place}th`;
  };

  const handleRowClick = (participant) => {
    if (onNameClick) {
      onNameClick(participant);
    }
  };

  if (data.length === 0) {
    return (
      <div className="text-center py-16 text-gray-500">
        <p className="text-2xl font-medium">No results match your filters</p>
        <p className="text-lg mt-2">Try adjusting your search or filters</p>
      </div>
    );
  }

  if (isMobile) {
    return (
      <div className="space-y-5">
        {data.map((r, i) => (
          <div
            key={i}
            className="bg-white rounded-2xl shadow-lg border border-gray-300 cursor-pointer transition-all duration-200 active:scale-98 active:bg-gemini-blue/5"
            onClick={() => handleRowClick(r)}
          >
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="text-3xl font-black text-gemini-blue">#{r.place || '—'}</div>
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
                  <div className="text-sm text-gray-600">Chip Time</div>
                </div>
                <div className="bg-gray-50 rounded-lg py-3">
                  <div className="text-xl font-bold">{formatPlace(r.gender_place)}</div>
                  <div className="text-sm text-gray-600">Gender</div>
                </div>
                <div className="bg-gray-50 rounded-lg py-3">
                  <div className="text-xl font-bold">
                    {r.age_group_place ? `${formatPlace(r.age_group_place)} ${r.age_group_name || ''}`.trim() : '—'}
                  </div>
                  <div className="text-sm text-gray-600">Division</div>
                </div>
                <div className="bg-gemini-blue/5 rounded-lg py-3">
                  <div className="text-xl font-bold">{r.pace || '—'}</div>
                  <div className="text-sm text-gray-600">Pace</div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Desktop Table
  return (
    <div className="overflow-x-auto -mx-6 px-6">
      <table className="w-full text-left">
        <thead className="bg-gemini-blue/20 text-gemini-dark-gray font-bold uppercase text-sm tracking-wider">
          <tr>
            <th className="px-6 py-5">Place</th>
            <th className="px-6 py-5">Bib</th>
            <th className="px-6 py-5">Name</th>
            <th className="px-6 py-5">Gender Place</th>
            <th className="px-6 py-5">Division Place</th>
            <th className="px-6 py-5">Chip Time</th>
            <th className="px-6 py-5">Pace</th>
            <th className="px-6 py-5">Age</th>
            <th className="px-6 py-5">Location</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {data.map((r, i) => (
            <tr
              key={i}
              className="hover:bg-gemini-blue/5 cursor-pointer transition duration-150"
              onClick={() => handleRowClick(r)}
            >
              <td className="px-6 py-5 font-black text-xl text-gemini-blue">
                {r.place ? formatPlace(r.place) : '—'}
              </td>
              <td className="px-6 py-5 font-semibold text-lg">{r.bib || '—'}</td>
              <td className="px-6 py-5 font-semibold text-gemini-dark-gray">
                {r.first_name} {r.last_name}
              </td>
              <td className="px-6 py-5 font-medium">
                {r.gender_place ? formatPlace(r.gender_place) : '—'}
              </td>
              <td className="px-6 py-5 font-medium whitespace-nowrap">
                {r.age_group_place ? (
                  <span>
                    {formatPlace(r.age_group_place)} {r.age_group_name || ''}
                  </span>
                ) : (
                  '—'
                )}
              </td>
              <td className="px-6 py-5 font-semibold">{formatChronoTime(r.chip_time)}</td>
              <td className="px-6 py-5">{r.pace || '—'}</td>
              <td className="px-6 py-5">{r.age || '—'}</td>
              <td className="px-6 py-5 text-gray-600">
                {r.city && `${r.city}, `}{r.state} {r.country}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}