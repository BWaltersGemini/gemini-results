// src/pages/ParticipantPage.jsx (FINAL — Safe localStorage + proper time formatting)
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
    races = [],
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

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Date TBD';
    const [year, month, day] = dateStr.split('-');
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
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
            .filter(e => groupEventIds.includes(e.id) && e.date.startsWith(year))
            .sort((a, b) => new Date(b.date) - new Date(a.date));

          if (yearEvents.length === 0) throw new Error('No matching event found.');
          const targetEvent = yearEvents[0];
          setSelectedEvent(targetEvent);

          const { data: participantData, error: pError } = await supabase
            .from('chronotrack_results')
            .select('*')
            .eq('event_id', targetEvent.id.toString())
            .eq('bib', bib)
            .single();

          if (pError || !participantData) throw new Error('Participant not found.');
          setParticipant(participantData);

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

  const handleDivisionClick = () => {
    if (!participant?.age_group_name || !selectedEvent) return;

    const participantRace = races.find(r => r.race_id === participant.race_id);
    const targetRaceSlug = participantRace ? slugify(participantRace.race_name) : (raceSlug || 'overall');

    let targetMasterSlug = masterKey;
    if (!targetMasterSlug) {
      const foundMaster = Object.entries(masterGroups).find(([_, ids]) =>
        ids.includes(selectedEvent.id)
      );
      targetMasterSlug = foundMaster ? slugify(foundMaster[0]) : slugify(selectedEvent.name);
    }

    const eventYear = selectedEvent.date.split('-')[0];

    navigate(`/results/${targetMasterSlug}/${eventYear}/${targetRaceSlug}`, {
      state: {
        autoFilterDivision: participant.age_group_name,
        autoFilterRaceId: participant.race_id,
      },
    });
  };

  if (contextLoading || loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-gray-50 to-white">
        <p className="text-2xl text-gray-700 mb-8">Loading Participant...</p>
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-[#80ccd6]"></div>
      </div>
    );
  }

  if (fetchError || !participant) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-gray-50 to-white px-6 text-center">
        <p className="text-2xl text-red-600 mb-8">{fetchError || 'No participant data available.'}</p>
        <button
          onClick={goBackToResults}
          className="px-10 py-4 bg-[#80ccd6] text-white font-bold rounded-full hover:bg-[#80ccd6]/90 transition shadow-lg"
        >
          Back to Results
        </button>
      </div>
    );
  }

  const raceResults = results.filter(r => r.race_id === participant.race_id);
  const overallTotal = raceResults.length || 1;
  const genderTotal = raceResults.filter(r => r.gender === participant.gender).length || 1;
  const divisionTotal = raceResults.filter(r => r.age_group_name === participant.age_group_name).length || 1;
  const formattedEventDate = formatDate(selectedEvent?.date);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white pt-24 pb-20">
      <div className="max-w-5xl mx-auto px-6">
        {/* Event Header */}
        <div className="text-center mb-16">
          {eventLogos[selectedEvent?.id] ? (
            <img
              src={eventLogos[selectedEvent.id]}
              alt="Event Logo"
              className="mx-auto max-h-40 mb-8 rounded-2xl shadow-2xl bg-white p-6"
            />
          ) : null}
          <h1 className="text-4xl md:text-6xl font-black text-gray-900 mb-4">
            {selectedEvent.name}
          </h1>
          <p className="text-xl text-gray-600">{formattedEventDate}</p>
          <div className="w-32 h-1 bg-[#80ccd6] mx-auto mt-8 rounded-full"></div>
        </div>

        {/* Participant Hero */}
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden mb-16 border border-[#80ccd6]/20">
          <div className="bg-gradient-to-r from-[#80ccd6] to-[#80ccd6]/70 py-12 text-center">
            <h2 className="text-5xl md:text-7xl font-black text-white drop-shadow-lg">
              {participant.first_name} {participant.last_name}
            </h2>
            <div className="mt-8">
              <div className="inline-block bg-white/20 backdrop-blur px-12 py-6 rounded-full shadow-xl">
                <p className="text-4xl font-bold text-white">Bib #{participant.bib}</p>
              </div>
            </div>
          </div>

          {/* Key Stats */}
          <div className="p-10 md:p-16">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center mb-12">
              <div>
                <p className="text-sm uppercase text-gray-500 tracking-wide mb-2">Chip Time</p>
                <p className="text-3xl font-bold text-[#80ccd6]">{formatTime(participant.chip_time)}</p>
              </div>
              <div>
                <p className="text-sm uppercase text-gray-500 tracking-wide mb-2">Pace</p>
                <p className="text-3xl font-bold text-[#80ccd6]">{participant.pace || '—'}</p>
              </div>
              <div>
                <p className="text-sm uppercase text-gray-500 tracking-wide mb-2">Overall Place</p>
                <p className="text-3xl font-bold text-[#80ccd6]">
                  {participant.place || '—'} <span className="text-lg text-gray-600">/ {overallTotal}</span>
                </p>
              </div>
              <div>
                <p className="text-sm uppercase text-gray-500 tracking-wide mb-2">Gender Place</p>
                <p className="text-3xl font-bold text-[#80ccd6]">
                  {participant.gender_place || '—'} <span className="text-lg text-gray-600">/ {genderTotal}</span>
                </p>
              </div>
            </div>

            {/* Location, Age, Gender, Division */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
              {(participant.city || participant.state) && (
                <div>
                  <p className="text-sm uppercase text-gray-500 tracking-wide mb-2">Location</p>
                  <p className="text-2xl font-bold text-gray-800">
                    {participant.city}{participant.city && participant.state ? ', ' : ''}{participant.state || ''}
                  </p>
                </div>
              )}
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
              <div className="md:col-span-3 mt-8">
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