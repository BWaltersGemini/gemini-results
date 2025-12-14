// src/components/ResultsTable.jsx (FINAL MOBILE-OPTIMIZED: Simplified columns on mobile, full on desktop, sticky header/name, high contrast)
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
} from '@tanstack/react-table';

export default function ResultsTable({ data, onNameClick, isMobile = false }) {
  const mobileColumns = [
    {
      accessorKey: 'place',
      header: 'Place',
      cell: info => (
        <span className="font-bold text-lg text-gemini-dark-gray">
          {info.getValue() || '—'}
        </span>
      ),
    },
    {
      accessorFn: row => `${row.first_name || ''} ${row.last_name || ''}`.trim(),
      id: 'name',
      header: 'Name',
      cell: info => (
        <span
          className="font-bold text-lg text-gemini-blue cursor-pointer hover:underline"
          onClick={() => onNameClick(info.row.original)}
        >
          {info.getValue() || '—'}
        </span>
      ),
    },
    {
      accessorKey: 'chip_time',
      header: 'Time',
      cell: info => (
        <span className="font-bold text-lg text-gemini-dark-gray">
          {info.getValue() || '—'}
        </span>
      ),
    },
    {
      accessorKey: 'bib',
      header: 'Bib',
      cell: info => <span className="text-sm text-gray-500">{info.getValue() || '—'}</span>,
    },
    {
      accessorKey: 'age',
      header: 'Age',
      cell: info => <span className="text-sm text-gray-500">{info.getValue() || '—'}</span>,
    },
    {
      accessorKey: 'gender',
      header: 'Sex',
      cell: info => <span className="text-sm text-gray-500">{info.getValue() || '—'}</span>,
    },
  ];

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
    { accessorKey: 'bib', header: 'Bib', cell: info => info.getValue() || '—' },
    { accessorKey: 'chip_time', header: 'Chip Time', cell: info => info.getValue() || '—' },
    { accessorKey: 'clock_time', header: 'Gun Time', cell: info => info.getValue() || '—' },
    { accessorKey: 'place', header: 'Overall', cell: info => info.getValue() || '—' },
    { accessorKey: 'gender_place', header: 'Gen Place', cell: info => info.getValue() || '—' },
    { accessorKey: 'age_group_name', header: 'Division', cell: info => info.getValue() || '—' },
    { accessorKey: 'age_group_place', header: 'Div Place', cell: info => info.getValue() || '—' },
    { accessorKey: 'pace', header: 'Pace', cell: info => info.getValue() || '—' },
    { accessorKey: 'age', header: 'Age', cell: info => info.getValue() || '—' },
    { accessorKey: 'gender', header: 'Gender', cell: info => info.getValue() || '—' },
  ];

  const columns = isMobile ? mobileColumns : desktopColumns;

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px]">
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
                <td colSpan={columns.length} className="text-center py-16 text-gray-500 text-lg">
                  No participants match current filters.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row, index) => (
                <tr
                  key={row.id}
                  className={`transition hover:bg-gemini-light-gray/50 ${
                    index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                  }`}
                >
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id} className="px-4 py-5 text-sm text-gray-800">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
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