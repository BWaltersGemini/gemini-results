// src/components/ResultsTable.jsx
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
} from '@tanstack/react-table';

export default function ResultsTable({ data, onNameClick }) {
  const columns = [
    {
      accessorFn: row => `${row.first_name || ''} ${row.last_name || ''}`.trim(),
      id: 'name',
      header: 'Name',
      cell: info => (
        <span
          className="text-gemini-blue cursor-pointer hover:underline font-medium"
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

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="bg-white rounded-xl shadow-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gemini-blue text-white">
            {table.getHeaderGroups().map(hg => (
              <tr key={hg.id}>
                {hg.headers.map(header => (
                  <th
                    key={header.id}
                    className="px-6 py-4 text-left cursor-pointer hover:bg-gemini-blue/90"
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {header.column.getIsSorted() ? (header.column.getIsSorted() === 'desc' ? ' Down Arrow' : ' Up Arrow') : ''}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-gray-200">
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="text-center py-12 text-gray-500">
                  No participants match current filters.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map(row => (
                <tr key={row.id} className="hover:bg-gemini-light-gray transition">
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id} className="px-6 py-4">
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