// src/components/CsvUploader.jsx (updated to remove console.warn and use setUploadError for unmatched events)
import { useState } from 'react';

export default function CsvUploader({ masterEvents, raceEvents, setRaceEvents, selectedRaceForOffline, selectedYearForOffline, setSelectedYearForOffline, selectedEventForOffline, setSelectedEventForOffline, offlineResults, setOfflineResults }) {
  const [csvFile, setCsvFile] = useState(null);
  const [csvData, setCsvData] = useState([]);
  const [csvHeaders, setCsvHeaders] = useState([]);
  const [columnMapping, setColumnMapping] = useState({
    first_name: '',
    last_name: '',
    chip_time: '',
    gender: '',
    age: '',
    age_group_name: '',
    age_group_place: '',
    gender_place: '',
    place: '',
    event: '', // Added for event separation
    // Add more RunSignup-compatible fields as needed
  });
  const [uploadError, setUploadError] = useState(null); // For CSV upload errors
  const [previewData, setPreviewData] = useState(null); // For previewing uploaded results

  const handleCsvUpload = (e) => {
    setUploadError(null);
    const file = e.target.files[0];
    if (!file) return;
    if (!file.name.endsWith('.csv')) {
      setUploadError('Please upload a CSV file.');
      return;
    }
    setCsvFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      const lines = text.split('\n').filter(line => line.trim());
      if (lines.length < 2) {
        setUploadError('CSV file is empty or has no data.');
        return;
      }
      const headers = lines[0].split(',').map(h => h.trim());
      if (headers.length < 2) {
        setUploadError('CSV file has insufficient columns.');
        return;
      }
      const data = lines.slice(1).map(line => {
        const values = line.split(',');
        return headers.reduce((obj, header, i) => {
          obj[header] = values[i]?.trim();
          return obj;
        }, {});
      });
      setCsvHeaders(headers);
      setCsvData(data);
    };
    reader.onerror = () => {
      setUploadError('Error reading CSV file.');
    };
    reader.readAsText(file);
  };

  const handleMappingChange = (field, header) => {
    setColumnMapping(prev => ({ ...prev, [field]: header }));
  };

  const applyOfflineResults = () => {
    setUploadError(null);
    setPreviewData(null);
    if (!selectedRaceForOffline || !selectedYearForOffline) {
      setUploadError('Select race and year first.');
      return;
    }
    if (csvData.length === 0) {
      setUploadError('No data in CSV.');
      return;
    }
    // Check if required mappings are set
    const requiredFields = ['first_name', 'last_name', 'chip_time'];
    for (const field of requiredFields) {
      if (!columnMapping[field]) {
        setUploadError(`Missing mapping for required field: ${field}`);
        return;
      }
    }
    let yearEvents = raceEvents[`${selectedRaceForOffline}-${selectedYearForOffline}`] || [];
    let resultsByEvent = {};
    let unmatchedEvents = [];
    let createdEvents = false;
    if (columnMapping.event) {
      // Group by event column
      const eventNames = [...new Set(csvData.map(row => row[columnMapping.event] || ''))].filter(name => name);
      // Create events if not exist
      eventNames.forEach(eventName => {
        if (!yearEvents.find(ev => ev.name.trim().toLowerCase() === eventName.trim().toLowerCase())) {
          const newEventId = `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`; // Generate unique ID
          yearEvents.push({ event_id: newEventId, name: eventName });
          createdEvents = true;
        }
      });
      if (createdEvents) {
        setRaceEvents(prev => ({ ...prev, [`${selectedRaceForOffline}-${selectedYearForOffline}`]: [...yearEvents] }));
      }
      csvData.forEach(row => {
        const eventName = row[columnMapping.event] || '';
        if (!resultsByEvent[eventName]) {
          resultsByEvent[eventName] = [];
        }
        resultsByEvent[eventName].push({
          first_name: row[columnMapping.first_name] || '',
          last_name: row[columnMapping.last_name] || '',
          chip_time: row[columnMapping.chip_time] || '',
          gender: row[columnMapping.gender] || '',
          age: row[columnMapping.age] || '',
          age_group_name: row[columnMapping.age_group_name] || '',
          age_group_place: row[columnMapping.age_group_place] || '',
          gender_place: row[columnMapping.gender_place] || '',
          place: row[columnMapping.place] || '',
          // Map more fields as needed
        });
      });
      // Map event names to IDs
      Object.keys(resultsByEvent).forEach(eventName => {
        const matchingEvent = yearEvents.find(ev => ev.name.trim().toLowerCase() === eventName.trim().toLowerCase());
        if (matchingEvent) {
          const eventId = matchingEvent.event_id;
          setOfflineResults(prev => {
            const raceData = prev[selectedRaceForOffline] || {};
            const yearData = raceData[selectedYearForOffline] || {};
            return {
              ...prev,
              [selectedRaceForOffline]: {
                ...raceData,
                [selectedYearForOffline]: {
                  ...yearData,
                  [eventId]: resultsByEvent[eventName],
                },
              },
            };
          });
        } else {
          unmatchedEvents.push(eventName);
        }
      });
      if (unmatchedEvents.length > 0) {
        setUploadError(`No matching events found for: ${unmatchedEvents.join(', ')}`);
      }
      // For preview when using event column, preview a sample from first group
      const firstGroup = Object.values(resultsByEvent)[0] || [];
      setPreviewData(firstGroup.slice(0, 10));
    } else if (selectedEventForOffline) {
      // No event column, apply to selected event
      const mappedData = csvData.map(row => ({
        first_name: row[columnMapping.first_name] || '',
        last_name: row[columnMapping.last_name] || '',
        chip_time: row[columnMapping.chip_time] || '',
        gender: row[columnMapping.gender] || '',
        age: row[columnMapping.age] || '',
        age_group_name: row[columnMapping.age_group_name] || '',
        age_group_place: row[columnMapping.age_group_place] || '',
        gender_place: row[columnMapping.gender_place] || '',
        place: row[columnMapping.place] || '',
        // Map more fields as needed
      }));
      setOfflineResults(prev => {
        const raceData = prev[selectedRaceForOffline] || {};
        const yearData = raceData[selectedYearForOffline] || {};
        return {
          ...prev,
          [selectedRaceForOffline]: {
            ...raceData,
            [selectedYearForOffline]: {
              ...yearData,
              [selectedEventForOffline]: mappedData,
            },
          },
        };
      });
      // Set preview to the applied data
      setPreviewData(mappedData.slice(0, 10)); // Preview first 10 rows
    } else {
      setUploadError('Either map an event column or select an event.');
      return;
    }
    if (!uploadError) {
      alert('Offline results applied!');
    }
    // Clear for next upload
    setCsvFile(null);
    setCsvData([]);
    setCsvHeaders([]);
    setColumnMapping(Object.fromEntries(Object.keys(columnMapping).map(k => [k, ''])));
  };

  return (
    <div>
      <h4 className="text-lg font-bold mb-2">Upload CSV for Results</h4>
      <div className="space-y-4">
        <select onChange={e => setSelectedYearForOffline(e.target.value)} value={selectedYearForOffline || ''}>
          <option value="">Select Year</option>
          {masterEvents[selectedRaceForOffline]?.years?.map(year => (
            <option key={year.race_event_days_id} value={year.race_event_days_id}>{year.formatted}</option>
          )) || []}
        </select>
        {selectedYearForOffline && raceEvents[`${selectedRaceForOffline}-${selectedYearForOffline}`] && (
          <select onChange={e => setSelectedEventForOffline(e.target.value)} value={selectedEventForOffline || ''}>
            <option value="">Select Event (optional if event column mapped)</option>
            {raceEvents[`${selectedRaceForOffline}-${selectedYearForOffline}`].map(ev => (
              <option key={ev.event_id} value={ev.event_id}>{ev.name}</option>
            ))}
          </select>
        )}
        <input type="file" onChange={handleCsvUpload} accept=".csv" />
        {uploadError && <p className="text-red-500">{uploadError}</p>}
        {csvHeaders.length > 0 && (
          <div>
            <h5 className="font-bold mb-2">Map Columns</h5>
            {Object.keys(columnMapping).map(field => (
              <div key={field} className="flex items-center mb-2">
                <label className="w-32">{field}:</label>
                <select value={columnMapping[field]} onChange={e => handleMappingChange(field, e.target.value)}>
                  <option value="">Select Header</option>
                  {csvHeaders.map(header => (
                    <option key={header} value={header}>{header}</option>
                  ))}
                </select>
              </div>
            ))}
            <button onClick={applyOfflineResults} className="mt-4 bg-green-500 text-white px-4 py-2 rounded">Apply Mapping</button>
          </div>
        )}
        {previewData && (
          <div className="mt-8">
            <h5 className="text-xl font-bold mb-4">Preview of Uploaded Results (First 10 Rows)</h5>
            <table className="w-full border-collapse border border-gray-300">
              <thead>
                <tr>
                  <th className="border border-gray-300 p-2">Name</th>
                  <th className="border border-gray-300 p-2">Chip Time</th>
                  <th className="border border-gray-300 p-2">Gender</th>
                  <th className="border border-gray-300 p-2">Age</th>
                  <th className="border border-gray-300 p-2">Division</th>
                  <th className="border border-gray-300 p-2">Place</th>
                </tr>
              </thead>
              <tbody>
                {previewData.map((row, index) => (
                  <tr key={index}>
                    <td className="border border-gray-300 p-2">{row.first_name} {row.last_name}</td>
                    <td className="border border-gray-300 p-2">{row.chip_time}</td>
                    <td className="border border-gray-300 p-2">{row.gender}</td>
                    <td className="border border-gray-300 p-2">{row.age}</td>
                    <td className="border border-gray-300 p-2">{row.age_group_name}</td>
                    <td className="border border-gray-300 p-2">{row.place}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}