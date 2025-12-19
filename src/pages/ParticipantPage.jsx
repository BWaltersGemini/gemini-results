// src/pages/ParticipantPage.jsx (FINAL — With full debug logging for "Back to Results")
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useState, useEffect, useContext } from 'react';
import { RaceContext } from '../context/RaceContext';
import { supabase } from '../supabaseClient';
import { useLocalStorage } from '../utils/useLocalStorage';
import { formatChronoTime } from '../utils/timeUtils';

export default function ParticipantPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = useParams();
  const { bib } = params;

  const {
    events,
    selectedEvent: contextSelectedEvent,
    results: contextResults,
    eventLogos = {},
    ads = [],
    loading: contextLoading,
    setSelectedEvent,
    masterGroups = {},
    editedEvents = {},
  } = useContext(RaceContext);

  const [masterGroupsLocal] = useLocalStorage('masterGroups', {});
  const [editedEventsLocal] = useLocalStorage('editedEvents', {});

  const initialState = location.state || {};
  const [participant, setParticipant] = useState(initialState.participant || null);
  const [selectedEvent, setLocalSelectedEvent] = useState(initialState.selectedEvent || contextSelectedEvent);
  const [results, setResults] = useState(initialState.results || contextResults || []);
  const [showSplits, setShowSplits] = useState(false);
  const [loading, setLoading] = useState(!initialState.participant);
  const [fetchError, setFetchError] = useState(null);

  // Sync with context
  useEffect(() => {
    if (contextSelectedEvent && contextSelectedEvent.id === selectedEvent?.id) {
      setLocalSelectedEvent(contextSelectedEvent);
    }
  }, [contextSelectedEvent]);

  const slugify = (text) => {
    if (!text || typeof text !== 'string') return 'overall';
    return text.trim().replace(/['`]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  };

  const formatDate = (epoch) => {
    if (!epoch || isNaN(epoch)) return 'Date TBD';
    const date = new Date(epoch * 1000);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getYearFromEvent = (event) => {
    if (!event?.start_time) return null;
    return new Date(event.start_time * 1000).getFullYear().toString();
  };

  // Load participant data
  useEffect(() => {
    const fetchDataIfMissing = async () => {
      if (participant && selectedEvent && results.length > 0) return;

      setLoading(true);
      setFetchError(null);
      try {
        if (contextLoading || events.length === 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        if (events.length === 0) throw new Error('Events not loaded yet');

        let targetEvent = selectedEvent || contextSelectedEvent;
        if (!targetEvent) {
          const resultWithBib = contextResults?.find(r => String(r.bib) === String(bib));
          if (resultWithBib) {
            targetEvent = events.find(e => e.id === resultWithBib.event_id);
          }
        }

        if (!targetEvent) throw new Error('Event not found');

        console.log('[ParticipantPage] Target event loaded:', targetEvent.name, '(ID:', targetEvent.id, ')');

        setLocalSelectedEvent(targetEvent);
        setSelectedEvent(targetEvent);

        const { data: fetchedResults, error: resultsError } = await supabase
          .from('chronotrack_results')
          .select('*')
          .eq('event_id', targetEvent.id);

        if (resultsError) throw resultsError;
        const allResults = fetchedResults || [];
        setResults(allResults);

        const found = allResults.find(r => String(r.bib) === String(bib));
        if (!found) throw new Error('Participant not found with this bib');
        setParticipant(found);

        console.log('[ParticipantPage] Participant loaded:', found.first_name, found.last_name, 'Bib:', found.bib);
      } catch (err) {
        console.error('[ParticipantPage] Load error:', err);
        setFetchError(err.message || 'Failed to load participant');
      } finally {
        setLoading(false);
      }
    };

    fetchDataIfMissing();
  }, [bib, events, contextResults, contextLoading, initialState]);

  // DEBUG: Detailed logging for "Back to Results"
  const goBackToResults = () => {
    console.log('[ParticipantPage] "Back to Results" clicked');
    console.log('  → Current selectedEvent:', selectedEvent ? `${selectedEvent.name} (ID: ${selectedEvent.id})` : 'null');
    console.log('  → Context masterGroups keys:', Object.keys(masterGroups));
    console.log('  → LocalStorage masterGroups keys:', Object.keys(masterGroupsLocal));

    if (!selectedEvent) {
      console.warn('[ParticipantPage] No selectedEvent — navigating to /results');
      navigate('/results');
      return;
    }

    // Combine both sources of masterGroups
    const allMasterGroups = { ...masterGroupsLocal, ...masterGroups };

    // Find master for this event
    let masterSlug = 'overall';
    const foundMaster = Object.entries(allMasterGroups).find(([key, ids]) =>
      ids.includes(selectedEvent.id.toString())
    );

    if (foundMaster) {
      const rawMasterName = foundMaster[0];
      masterSlug = slugify(rawMasterName);
      console.log(`[ParticipantPage] Found master: "${rawMasterName}" → slug: "${masterSlug}"`);
    } else {
      console.log('[ParticipantPage] No master group found for event — using "overall"');
    }

    const eventYear = getYearFromEvent(selectedEvent);
    console.log('[ParticipantPage] Event year:', eventYear);

    const targetUrl = `/results/${masterSlug}/${eventYear}`;
    console.log('[ParticipantPage] Navigating to:', targetUrl);

    navigate(targetUrl);
  };

  const handleDivisionClick = () => {
    goBackToResults();
  };

  // Loading state
  if (loading || contextLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gemini-light-gray to-gemini-blue/10 pt-40 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-t-4 border-gemini-blue mb-8"></div>
          <p className="text-2xl text-gray-700">Loading participant...</p>
        </div>
      </div>
    );
  }

  // Error or not found
  if (fetchError || !participant || !selectedEvent) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gemini-light-gray to-gemini-blue/10 pt-40 flex items-center justify-center">
        <div className="text-center max-w-md">
          <p className="text-3xl font-bold text-gemini-red mb-6">Participant Not Found</p>
          <p className="text-xl text-gray-700 mb-8">{fetchError || 'Unable to load participant data.'}</p>
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

  // Race name
  const participantRace = selectedEvent.races?.find(r => r.race_id === participant.race_id);
  const raceDisplayName = participantRace?.race_name || participant.race_name || 'Overall';

  return (
    <div className="min-h-screen bg-gradient-to-br from-gemini-light-gray to-gemini-blue/10 pt-40 py-16">
      <div className="max-w-5xl mx-auto px-6 bg-white rounded-3xl shadow-2xl p-10 border border-gemini-blue/20">
        {/* Header */}
        <div className="text-center mb-8">
          {eventLogos[selectedEvent.id] ? (
            <img
              src={eventLogos[selectedEvent.id]}
              alt="Event Logo"
              className="mx-auto max-h-24 mb-4 rounded-full shadow-md"
            />
          ) : (
            <div className="mx-auto w-32 h-32 bg-gray-200 rounded-full mb-4 flex items-center justify-center">
              <span className="text-5xl">🏁</span>
            </div>
          )}
          <h2 className="text-3xl font-bold text-gemini-dark-gray">{selectedEvent.name}</h2>
          <p className="text-lg text-gray-600 italic">
            {formatDate(selectedEvent.start_time)}
          </p>
          {raceDisplayName !== 'Overall' && (
            <p className="text-xl text-gemini-blue font-semibold mt-4">{raceDisplayName}</p>
          )}
        </div>

        {/* Participant Name */}
        <h3 className="text-5xl font-extrabold mb-8 text-center text-gemini-blue drop-shadow-md">
          {participant.first_name} {participant.last_name}
        </h3>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
          <div className="flex justify-center">
            <div className="bg-gemini-blue/90 text-white border-4 border-gemini-dark-gray rounded-xl p-6 text-center w-64 h-48 flex flex-col justify-center items-center shadow-xl font-mono">
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
            <p className="text-5xl font-black text-gemini-blue">{formatChronoTime(participant.chip_time)}</p>
          </div>
          <div className="bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl p-8 shadow-lg">
            <p className="text-sm uppercase text-gray-500 tracking-wide mb-3">Gun Time</p>
            <p className="text-5xl font-black text-gray-800">{formatChronoTime(participant.clock_time)}</p>
          </div>
          <div className="bg-gradient-to-br from-green-100 to-green-200 rounded-2xl p-8 shadow-lg">
            <p className="text-sm uppercase text-gray-500 tracking-wide mb-3">Pace</p>
            <p className="text-5xl font-black text-green-700">
              {participant.pace ? formatChronoTime(participant.pace) : '—'}
            </p>
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
                        <td className="px-8 py-5">{formatChronoTime(split.time) || '—'}</td>
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