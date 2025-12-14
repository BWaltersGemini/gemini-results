export default function ResultsTable({ data, onNameClick, isMobile = false }) {
  const columns = isMobile ? [
    {
      accessorKey: 'place',
      header: 'Place',
      cell: info => <span className="font-bold text-lg">{info.getValue() || '—'}</span>,
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
      cell: info => <span className="font-bold text-lg">{info.getValue() || '—'}</span>,
    },
    { accessorKey: 'bib', header: 'Bib', cell: info => <span className="text-gray-500 text-sm">{info.getValue() || '—'}</span> },
    { accessorKey: 'age', header: 'Age', cell: info => <span className="text-gray-500 text-sm">{info.getValue() || '—'}</span> },
    { accessorKey: 'gender', header: 'Sex', cell: info => <span className="text-gray-500 text-sm">{info.getValue() || '—'}</span> },
  ] : [
    // ... your full desktop columns from before
  ];

  // rest of table code unchanged
}