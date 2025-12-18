// src/pages/ParticipantPage.jsx (FINAL — Fully compatible with new schema: races embedded in chronotrack_events)
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useState, useEffect, useContext } from 'react';
import { RaceContext } from '../context/RaceContext';
import { supabase } from '../supabaseClient';
import { useLocalStorage } from '../utils/useLocalStorage';

export default function ParticipantPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = useParams();
  const { bib, masterKey, year, raceSlug } = params;

  const {
    events,
    results: contextResults,
    eventLogos,
    ads,
    loading: contextLoading,
  } = useContext(RaceContext);

  const [masterGroups] = useLocalStorage('masterGroups', {});
  const [editedEvents] = useLocalStorage('editedEvents', {});

  const initialState = location.state || {};
  const [participant, setParticipant] = useState(initialState.participant);
  const [selectedEvent, setSelectedEvent] = useState(initialState.selectedEvent);
  const [results, setResults] = useState(initialState.results || contextResults);
  const [showSplits, setShowSplits] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  // Safe time formatting
  const formatTime = (timeStr) => {
    if (!timeStr || timeStr.trim() === '') return '—';
    const trim = timeStr.trim();
    const parts = trim.split(':');
    let hours = 0;
    let minutes = '0';
    let seconds = '00.0';
    if (parts.length === 3) {
      hours = parseInt(parts[0], 10);
      minutes = parts[1];
      seconds = parts[2];
    } else if (parts.length === 2) {
      minutes = parts[0];
      seconds = parts[1];
    } else if (parts.length === 1) {
      seconds = parts[0];
    }
    const [secs, tenths = '0'] = seconds.split('.');
    const formattedSeconds = `${secs.padStart(2, '0')}.${tenths.padStart(1, '0')}`;
    if (hours > 0) {
      return `${hours}:${minutes.padStart(2, '0')}:${formattedSeconds}`;
    } else {
      return `${parseInt(minutes)}:${formattedSeconds}`;
    }
  };

  // Safe name cleaning for slug comparison
  const cleanName = (text) => {
    if (!text || typeof text !== 'string') return '';
    return text.trim().replace(/['`]/g, '').toLowerCase();
  };

  // Slugify helper
  const slugify = (text) => {
    if (!text || typeof text !== 'string') return 'overall';
    return text
      .trim()
      .replace(/['`]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  // Format date from Unix epoch (seconds)
  const formatDate = (epoch) => {
    if (!epoch || isNaN(epoch)) return 'Date TBD';
    const date = new Date(epoch * 1000);
    if (isNaN(date.getTime())) return 'Invalid Date';
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Extract year from start_time
  const getYearFromEvent = (event) => {
    if (!event?.start_time) return null;
    return new Date(event.start_time * 1000).getFullYear().toString();
  };

  useEffect(() => {
    const fetchDataIfMissing = async () => {
      if (!participant || !selectedEvent || results.length === 0) {
        setLoading(true);
        setFetchError(null);
        try {
          if (contextLoading) return;
          if (events.length === 0) throw new Error('No events available.');

          const decodedMaster = decodeURIComponent(masterKey).replace(/-/g, ' ').toLowerCase();
          let groupEntry = Object.entries(masterGroups).find(([key]) =>
            slugify(editedEvents[key]?.name || key) === masterKey ||
            cleanName(editedEvents[key]?.name || key) === cleanName(decodedMaster)
          );
          let groupEventIds = groupEntry ? groupEntry[1] : [];
          if (groupEventIds.length === 0) {
            groupEventIds = events
              .filter(e => slugify(editedEvents[e.id]?.name || e.name) === masterKey ||
                cleanName(editedEvents[e.id]?.name || e.name) === cleanName(decodedMaster))
              .map(e => e.id);
          }

          const yearEvents = events
            .filter(e => groupEventIds.includes(e.id) && getYearFromEvent(e) === year)
            .sort((a, b) => (b.start_time || 0) - (a.start_time || 0));

          if (yearEvents.length === 0) throw new Error('Event not found for this year.');

          const targetEvent = yearEvents[0];
          setSelectedEvent(targetEvent);

          // Fetch results if not passed via state
          if (results.length === 0 || initialState.results === undefined) {
            const { data: fetchedResults, error: resultsError } = await supabase
              .from('chronotrack_results')
              .select('*')
              .eq('event_id', targetEvent.id);

            if (resultsError) throw resultsError;
            setResults(fetchedResults || []);
          }

          // Find participant
          const foundParticipant = (initialState.results || contextResults || fetchedResults || []).find(
            r => r.bib === bib
          );

          if (!foundParticipant) throw new Error('Participant not found.');
          setParticipant(foundParticipant);
        } catch (err) {
          console.error('Fetch error:', err);
          setFetchError(err.message || 'Failed to load participant data.');
        } finally {
          setLoading(false);
        }
      }
    };

    fetchDataIfMissing();
  }, [bib, masterKey, year, events, contextResults, contextLoading, initialState, masterGroups, editedEvents]);

  const goBackToResults = () => navigate(-1);

  const handleDivisionClick = () => {
    if (!selectedEvent || !participant) return;
    const raceId = participant.race_id;
    navigate(location.pathname, {
      state: {
        autoFilterDivision: participant.age_group_name,
        autoFilterRaceId: raceId,
      },
      replace: true,
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gemini-light-gray to-gemini-blue/10 pt-40 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-t-4 border-gemini-blue mb-8"></div>
          <p className="text-2xl text-gray-700">Loading participant...</p>
        </div>
      </div>
    );
  }

  if (fetchError || !participant || !selectedEvent) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gemini-light-gray to-gemini-blue/10 pt-40 flex items-center justify-center">
        <div className="text-center max-w-md">
          <p className="text-3xl font-bold text-gemini-red mb-6">Participant Not Found</p>
          <p className="text-xl text-gray-700 mb-8">{fetchError || 'Unable to load data for this bib.'}</p>
          <button
            onClick={goBackToResults}
            className="px-12 py-5 bg-gemini-blue text-white font-bold text-xl rounded-full hover:bg-gemini-blue/90 transition shadow-xl"
          >
            ← Back to Results
          </button>
        </div>
      </div>
    );
  }

  // Calculate totals
  const overallTotal = results.length;
  const genderTotal = results.filter(r => r.gender === participant.gender).length;
  const divisionTotal = results.filter(r => r.age_group_name === participant.age_group_name).length;

  // Find race name from embedded races
  const participantRace = selectedEvent.races?.find(r => r.race_id === participant.race_id);
  const raceDisplayName = participantRace?.race_name || participant.race_name || 'Overall';

  return (
    <div className="min-h-screen bg-gradient-to-br from-gemini-light-gray to-gemini-blue/10 pt-40 py-16">
      <div className="max-w-5xl mx-auto px-6 bg-white rounded-3xl shadow-2xl p-10 border border-gemini-blue/20">
        {/* Race Header */}
        <div className="text-center mb-8">
          {eventLogos[selectedEvent?.id] ? (
            <img
              src={eventLogos[selectedEvent.id]}
              alt="Race Logo"
              className="mx-auto max-h-24 mb-4 rounded-full shadow-md"
            />
          ) : (
            <div className="mx-auto w-32 h-32 bg-gray-200 rounded-full mb-4 flex items-center justify-center">
              <span className="text-5xl">🏁</span>
            </div>
          )}
          <h2 className="text-3xl font-bold text-gemini-dark-gray">{selectedEvent.name}</h2>
          <p className="text-lg text-gray-600 italic">
            {selectedEvent.start_time ? formatDate(selectedEvent.start_time) : 'Date TBD'}
          </p>
          {raceDisplayName !== 'Overall' && (
            <p className="text-xl text-gemini-blue font-semibold mt-4">{raceDisplayName}</p>
          )}
        </div>

        {/* Participant Name */}
        <h3 className="text-5xl font-extrabold mb-8 text-center text-gemini-blue drop-shadow-md">
          {participant.first_name} {participant.last_name}
        </h3>

        {/* BIB and Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
          <div className="flex justify-center">
            <div className="bg-gemini-blue/90 text-white border-4 border-gemini-dark-gray rounded-xl p-6 text-center w-64 h-48 flex flex-col justify-center items-center shadow-xl font-mono transform hover:scale-105 transition">
              <p className="text-sm uppercase tracking-wider font-bold mb-2">BIB</p>
              <p className="text-6xl font-black">{participant.bib || '—'}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div>
              <p className="text-sm uppercase text-gray-500 tracking-wide mb-2">Overall</p>
              <p className="text-4xl font-bold text-gemini-dark-gray">
                {participant.place || '—'} <span className="text-lg text-gray-600">of {overallTotal}</span>
              </p>
            </div>
            <div>
              <p className="text-sm uppercase text-gray-500 tracking-wide mb-2">Gender</p>
              <p className="text-4xl font-bold text-gemini-dark-gray">
                {participant.gender_place || '—'} <span className="text-lg text-gray-600">of {genderTotal}</span>
              </p>
            </div>
            <div>
              <p className="text-sm uppercase text-gray-500 tracking-wide mb-2">Age</p>
              <p className="text-2xl font-bold text-gray-800">{participant.age || '—'}</p>
            </div>
            <div>
              <p className="text-sm uppercase text-gray-500 tracking-wide mb-2">Gender</p>
              <p className="text-2xl font-bold text-gray-800">
                {participant.gender === 'M' ? 'Male' : participant.gender === 'F' ? 'Female' : '—'}
              </p>
            </div>
            <div className="md:col-span-4 mt-8">
              <p className="text-sm uppercase text-gray-500 tracking-wide mb-3">Division</p>
              <button
                onClick={handleDivisionClick}
                className="text-3xl font-bold text-[#80ccd6] hover:underline transition cursor-pointer"
              >
                {participant.age_group_name || '—'} ({participant.age_group_place || '—'} of {divisionTotal})
              </button>
              <p className="text-base text-gray-600 mt-3">
                Click to view everyone in your division
              </p>
            </div>
          </div>
        </div>

        {/* Times */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16 text-center">
          <div className="bg-gradient-to-br from-gemini-blue/10 to-gemini-blue/5 rounded-2xl p-8 shadow-lg">
            <p className="text-sm uppercase text-gray-500 tracking-wide mb-3">Chip Time</p>
            <p className="text-5xl font-black text-gemini-blue">{formatTime(participant.chip_time) || '—'}</p>
          </div>
          <div className="bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl p-8 shadow-lg">
            <p className="text-sm uppercase text-gray-500 tracking-wide mb-3">Gun Time</p>
            <p className="text-5xl font-black text-gray-800">{formatTime(participant.clock_time) || '—'}</p>
          </div>
          <div className="bg-gradient-to-br from-green-100 to-green-200 rounded-2xl p-8 shadow-lg">
            <p className="text-sm uppercase text-gray-500 tracking-wide mb-3">Pace</p>
            <p className="text-5xl font-black text-green-700">{participant.pace || '—'}</p>
          </div>
        </div>

        {/* Splits */}
        {participant.splits && participant.splits.length > 0 && (
          <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-[#80ccd6]/20 mb-16">
            <button
              onClick={() => setShowSplits(!showSplits)}
              className="w-full bg-gradient-to-r from-[#80ccd6] to-[#80ccd6]/70 py-6 text-white font-bold text-xl hover:opacity-90 transition"
            >
              {showSplits ? 'Hide' : 'Show'} Split Times ({participant.splits.length})
            </button>
            {showSplits && (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-100 text-gray-700">
                    <tr>
                      <th className="px-8 py-5 text-left font-semibold">Split</th>
                      <th className="px-8 py-5 text-left font-semibold">Time</th>
                      <th className="px-8 py-5 text-left font-semibold">Pace</th>
                      <th className="px-8 py-5 text-left font-semibold">Place</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {participant.splits.map((split, i) => (
                      <tr key={i} className="hover:bg-gray-50 transition">
                        <td className="px-8 py-5 font-medium">{split.name || `Split ${i + 1}`}</td>
                        <td className="px-8 py-5">{formatTime(split.time) || '—'}</td>
                        <td className="px-8 py-5">{split.pace || '—'}</td>
                        <td className="px-8 py-5">{split.place || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Back Button */}
        <div className="text-center mb-16">
          <button
            onClick={goBackToResults}
            className="px-12 py-5 bg-gray-800 text-white font-bold text-xl rounded-full hover:bg-gray-700 transition shadow-xl"
          >
            ← Back to Results
          </button>
        </div>

        {/* Sponsors */}
        {ads.length > 0 && (
          <div>
            <h3 className="text-4xl font-bold text-center mb-12 text-gray-800">
              Event Sponsors
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
              {ads.map((ad, i) => (
                <div key={i} className="bg-white rounded-3xl shadow-xl overflow-hidden border border-[#80ccd6]/20 hover:shadow-2xl transition">
                  <img src={ad} alt="Sponsor" className="w-full h-auto" />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}