// src/pages/ParticipantPage.jsx (FINAL — Mobile-safe, clean layout)
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useState, useEffect, useContext } from 'react';
import { RaceContext } from '../context/RaceContext';
import { supabase } from '../supabaseClient';  // Correct — no .js extension needed

export default function ParticipantPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = useParams();
  const { bib, masterKey, year, raceSlug } = params;

  const { events, results: contextResults, eventLogos, ads, loading: contextLoading } = useContext(RaceContext);

  const masterGroups = JSON.parse(localStorage.getItem('masterGroups')) || {};
  const editedEvents = JSON.parse(localStorage.getItem('editedEvents')) || {};

  const initialState = location.state || {};
  const [participant, setParticipant] = useState(initialState.participant);
  const [selectedEvent, setSelectedEvent] = useState(initialState.selectedEvent);
  const [results, setResults] = useState(initialState.results || contextResults);
  const [showSplits, setShowSplits] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  const cleanName = (text) => {
    if (!text || typeof text !== 'string') return '';
    return text.trim().replace(/['`]/g, '').toLowerCase();
  };

  const slugify = (text) => {
    if (!text || typeof text !== 'string') return 'overall';
    return text
      .trim()
      .replace(/['`]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  useEffect(() => {
    const fetchDataIfMissing = async () => {
      if (!participant || !selectedEvent || results.length === 0) {
        console.log('Fetching data because state is missing');
        setLoading(true);
        setFetchError(null);
        try {
          if (contextLoading) {
            console.log('Context still loading events...');
            return;
          }
          if (events.length === 0) {
            throw new Error('No events available.');
          }

          // Find matching event
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
            .filter(e => groupEventIds.includes(e.id) && e.date.startsWith(year))
            .sort((a, b) => new Date(b.date) - new Date(a.date));

          if (yearEvents.length === 0) {
            throw new Error('No matching event found.');
          }

          const targetEvent = yearEvents[0];
          setSelectedEvent(targetEvent);

          // Fetch participant
          const { data: participantData, error: pError } = await supabase
            .from('chronotrack_results')
            .select('*')
            .eq('event_id', targetEvent.id.toString())
            .eq('bib', bib)
            .single();

          if (pError || !participantData) {
            throw new Error('Participant not found.');
          }

          setParticipant(participantData);

          // Fetch full results if not already loaded
          if (results.length === 0) {
            let allResults = [];
            let page = 0;
            const pageSize = 1000;
            while (true) {
              const { data, error } = await supabase
                .from('chronotrack_results')
                .select('*')
                .eq('event_id', targetEvent.id.toString())
                .range(page * pageSize, (page + 1) * pageSize - 1);

              if (error) throw error;
              if (!data || data.length === 0) break;
              allResults = [...allResults, ...data];
              if (data.length < pageSize) break;
              page++;
            }
            setResults(allResults);
          }
        } catch (err) {
          console.error('Fetch error:', err);
          setFetchError(err.message || 'Failed to load participant data.');
        } finally {
          setLoading(false);
        }
      }
    };

    fetchDataIfMissing();
  }, [bib, masterKey, year, events, masterGroups, editedEvents, participant, selectedEvent, results, contextResults, contextLoading]);

  const goBackToResults = () => navigate(-1);

  if (contextLoading || loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gemini-light-gray">
        <p className="text-2xl text-gemini-dark-gray mb-6">Loading Participant...</p>
        <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-gemini-blue"></div>
      </div>
    );
  }

  if (fetchError || !participant) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gemini-light-gray px-6">
        <p className="text-xl text-gemini-red text-center mb-8">{fetchError || 'No participant data available.'}</p>
        <button
          onClick={goBackToResults}
          className="bg-gemini-blue text-white px-8 py-4 rounded-lg hover:bg-gemini-blue/90"
        >
          Back to Results
        </button>
      </div>
    );
  }

  // Calculate totals safely
  const raceResults = results.filter(r => r.race_id === participant.race_id);
  const overallTotal = raceResults.length || 1;
  const genderTotal = raceResults.filter(r => r.gender === participant.gender).length || 1;
  const divisionTotal = raceResults.filter(r => r.age_group_name === participant.age_group_name).length || 1;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gemini-light-gray to-gemini-blue/10 pt-16 pb-20 px-4">
      <div className="max-w-4xl mx-auto bg-white rounded-3xl shadow-2xl overflow-hidden">
        {/* Race Header */}
        <div className="text-center py-8 bg-gemini-blue/5">
          {eventLogos[selectedEvent?.id] ? (
            <img
              src={eventLogos[selectedEvent.id]}
              alt="Race Logo"
              className="mx-auto max-h-32 mb-4 object-contain"
            />
          ) : (
            <div className="mx-auto w-32 h-32 bg-gray-200 rounded-full mb-4 flex items-center justify-center">
              <span className="text-5xl">🏁</span>
            </div>
          )}
          <h2 className="text-3xl font-bold text-gemini-dark-gray">{selectedEvent?.name || 'Race Results'}</h2>
          <p className="text-lg text-gray-600 mt-2">{selectedEvent?.date || 'Date TBD'}</p>
        </div>

        {/* Participant Name */}
        <h3 className="text-4xl md:text-5xl font-extrabold text-center text-gemini-blue py-8 bg-white">
          {participant.first_name} {participant.last_name}
        </h3>

        {/* BIB and Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-8">
          <div className="flex justify-center">
            <div className="bg-gemini-blue text-white rounded-2xl p-8 text-center shadow-xl w-64">
              <p className="text-sm uppercase tracking-wider font-bold mb-3 opacity-90">Bib Number</p>
              <p className="text-7xl font-black">{participant.bib || '—'}</p>
            </div>
          </div>

          <div className="bg-gemini-light-gray rounded-2xl p-8">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-6 text-lg">
              <dt className="font-semibold text-gemini-dark-gray">Chip Time</dt>
              <dd className="font-bold text-gemini-blue">{participant.chip_time || '—'}</dd>

              <dt className="font-semibold text-gemini-dark-gray">Pace</dt>
              <dd className="font-bold text-gemini-blue">{participant.pace || '—'}</dd>

              <dt className="font-semibold text-gemini-dark-gray">Age</dt>
              <dd className="font-bold text-gemini-blue">{participant.age || '—'}</dd>

              <dt className="font-semibold text-gemini-dark-gray">Gender</dt>
              <dd className="font-bold text-gemini-blue">{participant.gender === 'M' ? 'Male' : participant.gender === 'F' ? 'Female' : '—'}</dd>

              <dt className="font-semibold text-gemini-dark-gray">Division</dt>
              <dd className="font-bold text-gemini-blue">{participant.age_group_name || '—'}</dd>

              {participant.country && (
                <>
                  <dt className="font-semibold text-gemini-dark-gray">Country</dt>
                  <dd className="font-bold text-gemini-blue">{participant.country}</dd>
                </>
              )}
            </dl>
          </div>
        </div>

        {/* Standing Totals */}
        <div className="bg-gemini-light-gray p-8 mx-4 md:mx-8 rounded-2xl mb-8">
          <h4 className="text-2xl font-bold text-center text-gemini-dark-gray mb-6">Your Standing</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl p-6 text-center shadow">
              <p className="text-sm uppercase text-gray-600 tracking-wide">Overall</p>
              <p className="text-4xl font-bold text-gemini-blue mt-3">
                {participant.place || '—'} <span className="text-2xl text-gray-600">/ {overallTotal}</span>
              </p>
            </div>
            <div className="bg-white rounded-xl p-6 text-center shadow">
              <p className="text-sm uppercase text-gray-600 tracking-wide">Gender</p>
              <p className="text-4xl font-bold text-gemini-blue mt-3">
                {participant.gender_place || '—'} <span className="text-2xl text-gray-600">/ {genderTotal}</span>
              </p>
            </div>
            <div className="bg-white rounded-xl p-6 text-center shadow">
              <p className="text-sm uppercase text-gray-600 tracking-wide">Division</p>
              <p className="text-4xl font-bold text-gemini-blue mt-3">
                {participant.age_group_place || '—'} <span className="text-2xl text-gray-600">/ {divisionTotal}</span>
              </p>
              <p className="text-sm text-gray-600 mt-2">{participant.age_group_name || '—'}</p>
            </div>
          </div>
        </div>

        {/* Splits */}
        {participant.splits && participant.splits.length > 0 && (
          <div className="px-4 md:px-8 mb-8">
            <button
              onClick={() => setShowSplits(!showSplits)}
              className="w-full bg-gemini-blue text-white py-4 rounded-xl font-bold hover:bg-gemini-blue/90 transition"
            >
              {showSplits ? 'Hide' : 'Show'} Split Times ({participant.splits.length})
            </button>

            {showSplits && (
              <div className="mt-6 bg-white rounded-2xl shadow-lg overflow-x-auto">
                <table className="w-full min-w-full">
                  <thead className="bg-gemini-blue text-white">
                    <tr>
                      <th className="px-6 py-4 text-left">Split</th>
                      <th className="px-6 py-4 text-left">Time</th>
                      <th className="px-6 py-4 text-left">Pace</th>
                      <th className="px-6 py-4 text-left">Place</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {participant.splits.map((split, i) => (
                      <tr key={i} className="hover:bg-gemini-light-gray/30">
                        <td className="px-6 py-4 font-medium">{split.name || `Split ${i + 1}`}</td>
                        <td className="px-6 py-4">{split.time || '—'}</td>
                        <td className="px-6 py-4">{split.pace || '—'}</td>
                        <td className="px-6 py-4">{split.place || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Back Button */}
        <div className="text-center py-8">
          <button
            onClick={goBackToResults}
            className="bg-gray-600 text-white px-10 py-4 rounded-full text-lg font-bold hover:bg-gray-700 shadow-lg"
          >
            Back to Results
          </button>
        </div>

        {/* Sponsors */}
        {ads.length > 0 && (
          <div className="px-4 md:px-8 pb-8">
            <h3 className="text-3xl font-bold text-center text-gemini-blue mb-8">Featured Sponsors</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {ads.map((ad, index) => (
                <div key={index} className="rounded-2xl overflow-hidden shadow-lg">
                  <img src={ad} alt={`Sponsor ${index + 1}`} className="w-full h-auto" />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}