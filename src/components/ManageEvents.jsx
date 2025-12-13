// src/components/ManageEvents.jsx (updated with local state for selectedYearForOffline and selectedEventForOffline)
import { useState } from 'react';
import CsvUploader from './CsvUploader';

export default function ManageEvents({ masterEvents, setMasterEvents, editedEvents, setEditedEvents, expandedRaces, setExpandedRaces, expandedYears, setExpandedYears, raceEvents, setRaceEvents, hiddenRaces, setHiddenRaces, hiddenEvents, setHiddenEvents, adsPerRace, setAdsPerRace, eventLogos, setEventLogos, offlineResults, setOfflineResults, showUpcoming, setShowUpcoming, eventTypes, selectedEventTypes, setSelectedEventTypes, loading, error, toggleExpansion, toggleYearExpansion, fetchEventsForYear, toggleRaceVisibility, toggleEventVisibility, handleEditRaceName, handleEditEventName, handleFileUpload, toggleAdTypeForRace, handleEventTypeChange, handleSaveChanges }) {
  const [newRaceName, setNewRaceName] = useState('');
  const [newRaceId, setNewRaceId] = useState('');
  const [selectedYearForOffline, setSelectedYearForOffline] = useState(null);
  const [selectedEventForOffline, setSelectedEventForOffline] = useState(null);

  const handleCreateRace = () => {
    if (!newRaceName || !newRaceId) {
      alert('Please enter race ID and name.');
      return;
    }
    if (masterEvents[newRaceId]) {
      alert('Race ID already exists.');
      return;
    }
    const newRace = {
      name: newRaceName,
      years: [],
    };
    setMasterEvents(prev => ({ ...prev, [newRaceId]: newRace }));
    setEditedEvents(prev => ({ ...prev, [newRaceId]: { name: newRaceName } }));
    setNewRaceName('');
    setNewRaceId('');
  };

  return (
    <section className="mb-12 bg-white rounded-2xl p-8 shadow-lg">
      <h2 className="text-4xl font-bold mb-8 text-center">Manage Events</h2>
      {/* Create New Race */}
      <div className="mb-8">
        <h3 className="text-2xl font-bold mb-4">Create New Race</h3>
        <div className="flex gap-4">
          <input
            type="text"
            value={newRaceId}
            onChange={e => setNewRaceId(e.target.value)}
            placeholder="Race ID (unique)"
            className="p-2 border border-gray-300 rounded"
          />
          <input
            type="text"
            value={newRaceName}
            onChange={e => setNewRaceName(e.target.value)}
            placeholder="Race Name"
            className="p-2 border border-gray-300 rounded"
          />
          <button onClick={handleCreateRace} className="bg-green-500 text-white px-4 py-2 rounded">Create</button>
        </div>
      </div>
      {loading && <p className="text-center text-2xl">Loading races...</p>}
      {error && <p className="text-center text-gemini-red text-xl font-bold">{error}</p>}
      {!loading && (
        <div className="space-y-6 mb-8">
          {Object.entries(masterEvents).map(([raceId, event]) => (
            <div key={raceId} className="border border-gray-300 rounded-lg p-4">
              <div className="flex items-center justify-between cursor-pointer" onClick={() => toggleExpansion(raceId)}>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={!hiddenRaces.includes(raceId)}
                    onChange={() => toggleRaceVisibility(raceId)}
                    onClick={e => e.stopPropagation()}
                    className="mr-2"
                  />
                  <div>
                    <p>Original Name: {event.name}</p>
                    <input
                      type="text"
                      value={editedEvents[raceId]?.name || ''}
                      onChange={e => handleEditRaceName(raceId, e.target.value)}
                      onClick={e => e.stopPropagation()}
                      className="w-full max-w-md p-2 border border-gray-300 rounded mr-4"
                      placeholder="Display Name"
                    />
                  </div>
                </div>
                <span>{expandedRaces[raceId] ? '▲' : '▼'}</span>
              </div>
              {expandedRaces[raceId] && (
                <div className="ml-6 mt-4 space-y-4">
                  {/* Upload Race Logo */}
                  <div>
                    <label>Upload Race Logo:</label>
                    <input type="file" onChange={e => handleFileUpload(e, 'logo', raceId)} accept="image/*" />
                    {eventLogos[raceId] && <img src={eventLogos[raceId]} alt="Logo" className="mt-2 max-w-xs" />}
                  </div>
                  {/* CSV Uploader moved here */}
                  <CsvUploader
                    masterEvents={masterEvents}
                    raceEvents={raceEvents}
                    setRaceEvents={setRaceEvents} // Pass setRaceEvents to allow creating events
                    selectedRaceForOffline={raceId} // Fixed to current race
                    selectedYearForOffline={selectedYearForOffline}
                    setSelectedYearForOffline={setSelectedYearForOffline}
                    selectedEventForOffline={selectedEventForOffline}
                    setSelectedEventForOffline={setSelectedEventForOffline}
                    offlineResults={offlineResults}
                    setOfflineResults={setOfflineResults}
                  />
                  {/* Select Ad Types for this Race */}
                  <div>
                    <label className="block mb-2">Select Ad Types to Show:</label>
                    {['running', 'multisport', 'brand'].map(type => (
                      <div key={type} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={(adsPerRace[raceId] || []).includes(type)}
                          onChange={() => toggleAdTypeForRace(raceId, type)}
                          className="mr-2"
                        />
                        <span className="capitalize">{type}</span>
                      </div>
                    ))}
                  </div>
                  {event.years.map(year => (
                    <div key={year.race_event_days_id} className="mb-2">
                      <div className="flex items-center justify-between cursor-pointer" onClick={() => toggleYearExpansion(raceId, year.race_event_days_id)}>
                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            checked={! (hiddenEvents[raceId] || []).includes(year.race_event_days_id)}
                            onChange={() => toggleEventVisibility(raceId, year.race_event_days_id)}
                            onClick={e => e.stopPropagation()}
                            className="mr-2"
                          />
                          <p>{year.formatted}</p>
                        </div>
                        <span>{expandedYears[`${raceId}-${year.race_event_days_id}`] ? '▲' : '▼'}</span>
                      </div>
                      {expandedYears[`${raceId}-${year.race_event_days_id}`] && raceEvents[`${raceId}-${year.race_event_days_id}`] && (
                        <div className="ml-6 mt-2 space-y-2">
                          {raceEvents[`${raceId}-${year.race_event_days_id}`].map(ev => (
                            <div key={ev.event_id} className="flex flex-col">
                              <p>Original Name: {ev.name}</p>
                              <div className="flex items-center">
                                <input
                                  type="checkbox"
                                  checked={! (hiddenEvents[raceId] || []).includes(ev.event_id)}
                                  onChange={() => toggleEventVisibility(raceId, ev.event_id)}
                                  className="mr-2"
                                />
                                <input
                                  type="text"
                                  value={editedEvents[raceId]?.events?.[ev.event_id] || ''}
                                  onChange={e => handleEditEventName(raceId, ev.event_id, e.target.value)}
                                  className="w-full p-1 border border-gray-300 rounded"
                                  placeholder="Display Name"
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {/* Upcoming Events */}
      <div className="mb-8">
        <h3 className="text-2xl font-bold mb-4">Upcoming Events</h3>
        <div className="flex items-center mb-4">
          <input
            type="checkbox"
            checked={showUpcoming}
            onChange={(e) => setShowUpcoming(e.target.checked)}
            className="mr-2"
          />
          <label>Show Upcoming Events</label>
        </div>
        {showUpcoming && (
          <div>
            <label className="block mb-2">Event Types to Show:</label>
            <select multiple value={selectedEventTypes} onChange={handleEventTypeChange} className="w-full p-2 border border-gray-300 rounded">
              {eventTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
        )}
      </div>
      <button onClick={handleSaveChanges} className="mt-8 bg-gemini-blue text-white px-6 py-3 rounded-xl hover:bg-gemini-blue/90">
        Save Changes
      </button>
    </section>
  );
}