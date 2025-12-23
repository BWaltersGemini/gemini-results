// src/pages/admin/EmailCampaignsAdmin.jsx
import { useState, useEffect } from 'react';
import { fetchEvents } from '../../api/chronotrackapi';
import { fetchResultsForEvent } from '../../api/chronotrackapi';
import { fetchEmailsForEntries } from '../../api/chronotrackAdminApi';

// === VERSION MARKER - FOR DEBUGGING DEPLOYMENT ===
console.log('%c🟢 EMAIL CAMPAIGNS ADMIN v2.1 — FIXED VERSION LOADED (Dec 22, 2025)', 'color: white; background: green; font-size: 16px; padding: 8px; border-radius: 4px;');

export default function EmailCampaignsAdmin() {
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [results, setResults] = useState([]);
  const [emailList, setEmailList] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [loadingResults, setLoadingResults] = useState(false);
  const [buildingList, setBuildingList] = useState(false);
  const [progress, setProgress] = useState({ processed: 0, total: 0, found: 0 });

  useEffect(() => {
    console.log('EmailCampaignsAdmin component mounted — new version confirmed');
    const loadEvents = async () => {
      try {
        const allEvents = await fetchEvents();
        allEvents.sort((a, b) => (b.start_time || 0) - (a.start_time || 0));
        setEvents(allEvents);
      } catch (err) {
        alert('Failed to load events from ChronoTrack');
        console.error(err);
      } finally {
        setLoadingEvents(false);
      }
    };
    loadEvents();
  }, []);

  const handleSelectEvent = async (eventId) => {
    const event = events.find(e => e.id === eventId);
    if (!event) return;
    setSelectedEvent(event);
    setResults([]);
    setEmailList([]);
    setLoadingResults(true);
    try {
      const eventResults = await fetchResultsForEvent(eventId);
      const withEntry = eventResults.filter(r => r.entry_id);
      setResults(withEntry);
      console.log(`Loaded ${withEntry.length} participants with entry_id`);
    } catch (err) {
      alert('Failed to load results for this event');
      console.error(err);
    } finally {
      setLoadingResults(false);
    }
  };

  const handleBuildEmailList = async () => {
    if (results.length === 0) {
      alert('No participants with registration data found');
      return;
    }
    const entryIds = results.map(r => r.entry_id);
    setBuildingList(true);
    setProgress({ processed: 0, total: entryIds.length, found: 0 });
    console.log(`Starting email fetch for ${entryIds.length} entry IDs`);

    try {
      const emails = await fetchEmailsForEntries(entryIds, (processed, total, found) => {
        setProgress({ processed, total, found });
      });
      setEmailList(emails);
      console.log(`✅ Email fetch complete: ${emails.length} valid emails found`);
      alert(`✅ Success! Found ${emails.length} valid emails out of ${results.length} finishers`);
    } catch (err) {
      alert('Error while building email list');
      console.error('Email fetch error:', err);
    } finally {
      setBuildingList(false);
    }
  };

  const formatDate = (epoch) => {
    if (!epoch) return 'Date TBD';
    return new Date(epoch * 1000).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <section className="space-y-12">
      {/* VERSION BANNER — VISIBLE PROOF */}
      <div className="bg-green-100 border-2 border-green-500 rounded-xl p-4 text-center">
        <p className="text-green-800 font-bold text-lg">
          🟢 Email Campaigns Admin v2.1 — Fixed & Deployed (Dec 22, 2025)
        </p>
        <p className="text-green-700 text-sm mt-1">
          If you see this banner, the correct version is running!
        </p>
      </div>

      <h2 className="text-3xl font-bold text-gemini-dark-gray mb-8">Email Campaigns</h2>

      {/* Step 1: Select Event */}
      <div className="bg-white rounded-2xl shadow-lg p-8">
        <h3 className="text-2xl font-bold mb-6">1. Select Event</h3>
        {loadingEvents ? (
          <p className="text-lg">Loading events...</p>
        ) : (
          <select
            value={selectedEvent?.id || ''}
            onChange={(e) => handleSelectEvent(e.target.value)}
            className="w-full max-w-2xl p-4 border border-gray-300 rounded-xl text-lg"
          >
            <option value="">— Choose an event —</option>
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.name} — {formatDate(event.start_time)}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Step 2: Participant Data & Build List */}
      {selectedEvent && (
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <h3 className="text-2xl font-bold mb-6">2. Participant Data</h3>
          {loadingResults ? (
            <p className="text-lg">Loading results...</p>
          ) : (
            <>
              <p className="text-xl mb-6">
                Found <strong>{results.length}</strong> finishers with registration data (entry IDs)
              </p>
              <button
                onClick={handleBuildEmailList}
                disabled={buildingList}
                className="px-12 py-5 bg-gemini-blue text-white text-xl font-bold rounded-full hover:bg-gemini-blue/90 disabled:opacity-60 transition shadow-xl"
              >
                {buildingList ? 'Fetching Emails...' : '🔍 Build Email List'}
              </button>

              {buildingList && (
                <div className="mt-8 p-6 bg-gemini-blue/10 rounded-xl border border-gemini-blue/30">
                  <p className="text-lg font-semibold">
                    Checked {progress.processed} of {progress.total} participants
                  </p>
                  <p className="text-2xl font-bold text-gemini-blue mt-3">
                    Found {progress.found} valid emails so far
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Step 3: Email List Preview */}
      {emailList.length > 0 && (
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <h3 className="text-2xl font-bold mb-6">
            3. Email List Ready — {emailList.length} recipients
          </h3>
          <p className="text-lg text-gray-600 mb-6">
            Next: Template editor with placeholders and send via Resend/SendGrid
          </p>
          <div className="max-h-96 overflow-y-auto border border-gray-300 rounded-xl">
            <table className="w-full text-left">
              <thead className="bg-gemini-blue/10 sticky top-0">
                <tr>
                  <th className="px-6 py-4 font-semibold">Name</th>
                  <th className="px-6 py-4 font-semibold">Email</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {emailList.slice(0, 100).map((person, i) => {
                  const name = person.fullName ||
                               (person.firstName && person.lastName
                                 ? `${person.firstName.trim()} ${person.lastName.trim()}`
                                 : person.firstName?.trim() || person.lastName?.trim() || 'Name not available');
                  return (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-6 py-4">{name}</td>
                      <td className="px-6 py-4 font-mono text-sm">{person.email}</td>
                    </tr>
                  );
                })}
                {emailList.length > 100 && (
                  <tr>
                    <td colSpan={2} className="px-6 py-4 text-center text-gray-500 italic">
                      ... and {emailList.length - 100} more recipients
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}