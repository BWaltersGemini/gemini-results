// src/components/ResultsTable.jsx (MOBILE CARD LAYOUT: Vertical cards on mobile, full table on desktop)
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
} from '@tanstack/react-table';

export default function ResultsTable({ data, onNameClick, isMobile = false }) {
  // Desktop columns (full table)
  const desktopColumns = [
    {
      accessorFn: row => `${row.first_name || ''} ${row.last_name || ''}`.trim(),
      id: 'name',
      header: 'Name',
      cell: info => (
        <span
          className="font-semibold text-gemini-blue cursor-pointer hover:underline"
          onClick={() => onNameClick(info.row.original)}
        >
          {info.getValue() || '—'}
        </span>
      ),
    },
    { accessorKey: 'bib', header: 'Bib' },
    { accessorKey: 'chip_time', header: 'Chip Time' },
    { accessorKey: 'clock_time', header: 'Gun Time' },
    { accessorKey: 'place', header: 'Overall' },
    { accessorKey: 'gender_place', header: 'Gen Place' },
    { accessorKey: 'age_group_name', header: 'Division' },
    { accessorKey: 'age_group_place', header: 'Div Place' },
    { accessorKey: 'pace', header: 'Pace' },
    { accessorKey: 'age', header: 'Age' },
    { accessorKey: 'gender', header: 'Gender' },
  ];

  const table = useReactTable({
    data,
    columns: desktopColumns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  // Mobile: Card layout (no table)
  if (isMobile) {
    if (data.length === 0) {
      return (
        <div className="text-center py-12 text-gray-500 text-lg">
          No participants match current filters.
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {data.map((row, index) => (
          <div
            key={row.id || index}
            className="bg-white rounded-xl shadow-md p-5 hover:shadow-lg transition"
          >
            <div
              className="font-bold text-xl text-gemini-blue cursor-pointer hover:underline mb-2"
              onClick={() => onNameClick(row)}
            >
              {row.first_name || ''} {row.last_name || ''}
            </div>
            <div className="flex justify-between items-baseline mb-3">
              <span className="text-2xl font-bold text-gemini-dark-gray">
                {row.place || '—'}
              </span>
              <span className="text-xl font-semibold text-gemini-dark-gray">
                {row.chip_time || '—'}
              </span>
            </div>
            <div className="text-sm text-gray-600 flex gap-4 flex-wrap">
              <span>Bib: <span className="font-medium">{row.bib || '—'}</span></span>
              <span>Age: <span className="font-medium">{row.age || '—'}</span></span>
              <span>Sex: <span className="font-medium">{row.gender || '—'}</span></span>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Desktop: Traditional table
  return (
    <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead className="bg-gemini-blue text-white sticky top-0 z-10">
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <th
                    key={header.id}
                    className="px-4 py-4 text-left text-sm font-semibold uppercase tracking-wider cursor-pointer hover:bg-gemini-blue/90 transition"
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <div className="flex items-center gap-2">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getIsSorted() && (
                        <span className="text-lg">
                          {header.column.getIsSorted() === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-gray-200">
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={desktopColumns.length} className="text-center py-16 text-gray-500 text-lg">
                  No participants match current filters.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row, index) => (
                <tr
                  key={row.id}
                  className={`hover:bg-gemini-light-gray/50 transition ${
                    index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                  }`}
                >
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id} className="px-4 py-5 text-sm text-gray-800">
                      {flexRender(cell.column.columnDef.cell, cell.getContext()) || '—'}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}