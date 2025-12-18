// src/components/ResultsTable.jsx (FINAL — Complete, unified division + gender place display)
import { useNavigate } from 'react-router-dom';

export default function ResultsTable({ data = [], onNameClick, isMobile }) {
  const navigate = useNavigate();

  const formatTime = (timeStr) => {
    if (!timeStr || timeStr.trim() === '') return '—';
    return timeStr.trim();
  };

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
      <div className="text-center py-12 text-gray-500">
        <p className="text-xl">No results match your filters.</p>
      </div>
    );
  }

  if (isMobile) {
    return (
      <div className="space-y-4">
        {data.map((r, i) => (
          <div
            key={i}
            className="bg-white rounded-xl shadow-md p-6 border border-gray-200 cursor-pointer hover:shadow-lg transition"
            onClick={() => handleRowClick(r)}
          >
            <div className="flex justify-between items-start mb-3">
              <div className="text-2xl font-bold text-gemini-blue">#{r.place || '—'}</div>
              <div className="text-right">
                <div className="text-lg font-bold">{r.bib || '—'}</div>
                <div className="text-sm text-gray-500">Bib</div>
              </div>
            </div>

            <div className="mb-4">
              <div className="text-xl font-bold text-gemini-dark-gray">
                {r.first_name} {r.last_name}
              </div>
              <div className="text-sm text-gray-600">
                {r.city && `${r.city}, `}{r.state} {r.country}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <div className="text-lg font-bold text-gemini-blue">{formatTime(r.chip_time)}</div>
                <div className="text-xs text-gray-500">Chip Time</div>
              </div>
              <div>
                <div className="text-lg font-bold">{formatPlace(r.gender_place)}</div>
                <div className="text-xs text-gray-500">Gender</div>
              </div>
              <div>
                <div className="text-lg font-bold">{formatPlace(r.age_group_place)}</div>
                <div className="text-xs text-gray-500">{r.age_group_name || 'Division'}</div>
              </div>
              <div>
                <div className="text-lg font-bold">{r.pace || '—'}</div>
                <div className="text-xs text-gray-500">Pace</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Desktop table
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead className="bg-gemini-blue/10 text-gemini-dark-gray font-bold uppercase text-sm">
          <tr>
            <th className="px-6 py-4">Place</th>
            <th className="px-6 py-4">Bib</th>
            <th className="px-6 py-4">Name</th>
            <th className="px-6 py-4">Gender Place</th>
            <th className="px-6 py-4">Division Place</th>
            <th className="px-6 py-4">Chip Time</th>
            <th className="px-6 py-4">Pace</th>
            <th className="px-6 py-4">Age</th>
            <th className="px-6 py-4">Location</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {data.map((r, i) => (
            <tr
              key={i}
              className="hover:bg-gemini-blue/5 cursor-pointer transition"
              onClick={() => handleRowClick(r)}
            >
              <td className="px-6 py-4 font-bold text-lg text-gemini-blue">
                {r.place ? formatPlace(r.place) : '—'}
              </td>
              <td className="px-6 py-4 font-medium">{r.bib || '—'}</td>
              <td className="px-6 py-4 font-medium text-gemini-dark-gray">
                {r.first_name} {r.last_name}
              </td>
              <td className="px-6 py-4">
                {r.gender_place ? formatPlace(r.gender_place) : '—'}
              </td>
              <td className="px-6 py-4">
                {r.age_group_place ? (
                  <span>
                    {formatPlace(r.age_group_place)} {r.age_group_name}
                  </span>
                ) : (
                  '—'
                )}
              </td>
              <td className="px-6 py-4 font-medium">{formatTime(r.chip_time)}</td>
              <td className="px-6 py-4">{r.pace || '—'}</td>
              <td className="px-6 py-4">{r.age || '—'}</td>
              <td className="px-6 py-4 text-sm text-gray-600">
                {r.city && `${r.city}, `}{r.state} {r.country}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}