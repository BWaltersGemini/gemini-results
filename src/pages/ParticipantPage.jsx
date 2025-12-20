// src/pages/ParticipantPage.jsx (FINAL — Mobile-First Reveal + Fixed Master Logo in Card)

import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useState, useEffect, useContext, useRef } from 'react';
import { RaceContext } from '../context/RaceContext';
import { supabase } from '../supabaseClient';
import { useLocalStorage } from '../utils/useLocalStorage';
import { formatChronoTime, parseChipTime } from '../utils/timeUtils';
import CountUp from 'react-countup';
import confetti from 'canvas-confetti';
import html2canvas from 'html2canvas';

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
  const [timeRevealed, setTimeRevealed] = useState(false);
  const [showCardPreview, setShowCardPreview] = useState(false);

  const cardRef = useRef(null);

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
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  const getYearFromEvent = (event) => {
    if (!event?.start_time) return null;
    return new Date(event.start_time * 1000).getFullYear().toString();
  };

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
      } catch (err) {
        console.error('[ParticipantPage] Load error:', err);
        setFetchError(err.message || 'Failed to load participant');
      } finally {
        setLoading(false);
      }
    };

    fetchDataIfMissing();
  }, [bib, events, contextResults, contextLoading, initialState]);

  const handleTimeComplete = () => {
    setTimeRevealed(true);
    confetti({
      particleCount: 200,
      spread: 80,
      origin: { y: 0.65 },
      colors: ['#80ccd6', '#00a8e8', '#ffd700', '#ff6b6b', '#4ecdc4'],
    });
  };

  const generateResultCard = async () => {
    if (!cardRef.current) return;

    try {
      const canvas = await html2canvas(cardRef.current, {
        scale: 2.5,
        useCORS: true,
        allowTaint: true,
        backgroundColor: null,
        logging: false,
        width: 1080,
        height: 1080,
      });

      const image = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `${participant.first_name}_${participant.last_name}_result.png`;
      link.href = image;
      link.click();
    } catch (err) {
      console.error('Card generation failed:', err);
      alert('Failed to generate card — please try again!');
    }
  };

  const shareResultCard = async () => {
    if (!cardRef.current) return;

    try {
      const canvas = await html2canvas(cardRef.current, {
        scale: 2.5,
        useCORS: true,
        allowTaint: true,
        backgroundColor: null,
        width: 1080,
        height: 1080,
      });

      canvas.toBlob(async (blob) => {
        const file = new File([blob], 'result-card.png', { type: 'image/png' });

        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: 'My Race Result!',
            text: `I finished the ${raceDisplayName} in ${participant.chip_time}! 🏃‍♂️ Find our next race at www.youkeepmoving.com`,
          });
        } else {
          generateResultCard();
        }
      });
    } catch (err) {
      generateResultCard();
    }
  };

  const goBackToResults = () => {
    if (!selectedEvent) {
      navigate('/results');
      return;
    }

    const allMasterGroups = { ...masterGroupsLocal, ...masterGroups };
    let masterSlug = 'overall';
    const foundMaster = Object.entries(allMasterGroups).find(([key, ids]) =>
      ids.includes(selectedEvent.id.toString())
    );
    if (foundMaster) {
      masterSlug = slugify(foundMaster[0]);
    }

    const eventYear = getYearFromEvent(selectedEvent);
    navigate(`/results/${masterSlug}/${eventYear}`);
  };

  const handleDivisionClick = () => {
    if (!participant?.age_group_name || !selectedEvent) {
      goBackToResults();
      return;
    }

    const allMasterGroups = { ...masterGroupsLocal, ...masterGroups };
    let masterSlug = 'overall';
    const foundMaster = Object.entries(allMasterGroups).find(([key, ids]) =>
      ids.includes(selectedEvent.id.toString())
    );
    if (foundMaster) {
      masterSlug = slugify(foundMaster[0]);
    }

    const eventYear = getYearFromEvent(selectedEvent);
    navigate(`/results/${masterSlug}/${eventYear}`, {
      state: {
        divisionFilter: participant.age_group_name,
        highlightBib: participant.bib,
      },
    });
  };

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

  const overallTotal = results.length;
  const genderTotal = results.filter(r => r.gender === participant.gender).length;
  const divisionTotal = results.filter(r => r.age_group_name === participant.age_group_name).length;

  const participantRace = selectedEvent.races?.find(r => r.race_id === participant.race_id);
  const raceDisplayName = participantRace?.race_name || participant.race_name || 'Overall';

  const chipTimeSeconds = parseChipTime(participant.chip_time);

  // Master series logo — correctly resolved
  const currentMasterKey = Object.keys(masterGroups).find(key =>
    masterGroups[key]?.includes(selectedEvent?.id?.toString())
  );
  const masterLogo = currentMasterKey ? eventLogos[currentMasterKey] : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gemini-light-gray to-gemini-blue/10 pt-40 py-16">
      <div className="max-w-5xl mx-auto px-6 bg-white rounded-3xl shadow-2xl p-10 border border-gemini-blue/20">

        {/* Header */}
        <div className="text-center mb-10">
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
          <p className="text-lg text-gray-600 italic">{formatDate(selectedEvent.start_time)}</p>
          {raceDisplayName !== 'Overall' && (
            <p className="text-xl text-gemini-blue font-semibold mt-4">{raceDisplayName}</p>
          )}
        </div>

        {/* Participant Name — Huge and Immediate */}
        <h3 className="text-5xl md:text-6xl font-extrabold mb-12 text-center text-gemini-blue drop-shadow-md leading-tight">
          {participant.first_name} {participant.last_name}
        </h3>

        {/* DRAMATIC CHIP TIME REVEAL — Now Above the Fold on Mobile */}
        <div className="text-center my-16">
          <p className="text-2xl md:text-3xl uppercase text-gray-500 tracking-widest mb-6">Your Finish Time</p>
          <div className="text-7xl md:text-9xl font-black text-gemini-blue leading-none">
            {timeRevealed ? (
              formatChronoTime(participant.chip_time)
            ) : (
              <CountUp
                start={0}
                end={chipTimeSeconds}
                duration={3.8}
                formattingFn={(value) => {
                  const hours = Math.floor(value / 3600);
                  const mins = Math.floor((value % 3600) / 60);
                  const secs = Math.floor(value % 60);
                  const tenths = Math.round((value % 1) * 10);
                  return `${hours ? hours + ':' : ''}${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}${tenths ? '.' + tenths : ''}`;
                }}
                onEnd={handleTimeComplete}
              />
            )}
          </div>
        </div>

        {/* Key Placements — Compact & Prominent */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 my-16 max-w-4xl mx-auto">
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-3xl p-8 text-center shadow-lg">
            <p className="text-lg uppercase text-gray-500 mb-4">Overall Place</p>
            <p className="text-5xl font-black text-gemini-dark-gray">
              {participant.place || '—'}
            </p>
            <p className="text-xl text-gray-600 mt-2">of {overallTotal}</p>
          </div>
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-3xl p-8 text-center shadow-lg">
            <p className="text-lg uppercase text-gray-500 mb-4">Gender Place</p>
            <p className="text-5xl font-black text-gemini-dark-gray">
              {participant.gender_place || '—'}
            </p>
            <p className="text-xl text-gray-600 mt-2">of {genderTotal}</p>
          </div>
          <div className="bg-gradient-to-br from-[#80ccd6]/10 to-[#80ccd6]/5 rounded-3xl p-8 text-center shadow-lg">
            <p className="text-lg uppercase text-gray-500 mb-4">Division</p>
            <button
              onClick={handleDivisionClick}
              className="text-4xl font-black text-[#80ccd6] hover:underline cursor-pointer"
            >
              {participant.age_group_name || '—'}
            </button>
            <p className="text-xl text-gray-600 mt-2">
              {participant.age_group_place || '—'} of {divisionTotal}
            </p>
            <p className="text-sm text-gray-500 mt-4">Tap to view division</p>
          </div>
        </div>

        {/* Bib + Gun Time + Pace Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 my-12">
          <div className="flex justify-center">
            <div className="bg-gemini-blue/90 text-white border-4 border-gemini-dark-gray rounded-xl p-8 text-center w-64 h-48 flex flex-col justify-center items-center shadow-xl font-mono">
              <p className="text-lg uppercase tracking-wider font-bold mb-4">BIB</p>
              <p className="text-6xl font-black">{participant.bib || '—'}</p>
            </div>
          </div>
          <div className="bg-gradient-to-br from-gray-100 to-gray-200 rounded-3xl p-8 text-center shadow-lg">
            <p className="text-lg uppercase text-gray-500 mb-4">Gun Time</p>
            <p className="text-5xl font-black text-gray-800">{formatChronoTime(participant.clock_time)}</p>
          </div>
          <div className="bg-gradient-to-br from-green-100 to-green-200 rounded-3xl p-8 text-center shadow-lg">
            <p className="text-lg uppercase text-gray-500 mb-4">Pace</p>
            <p className="text-5xl font-black text-green-700">
              {participant.pace ? formatChronoTime(participant.pace) : '—'}
            </p>
          </div>
        </div>

        {/* Additional Info: Age & Gender */}
        <div className="grid grid-cols-2 gap-8 max-w-md mx-auto my-12 text-center">
          <div>
            <p className="text-lg uppercase text-gray-500 mb-2">Age</p>
            <p className="text-4xl font-bold text-gray-800">{participant.age || '—'}</p>
          </div>
          <div>
            <p className="text-lg uppercase text-gray-500 mb-2">Gender</p>
            <p className="text-4xl font-bold text-gray-800">
              {participant.gender === 'M' ? 'Male' : participant.gender === 'F' ? 'Female' : '—'}
            </p>
          </div>
        </div>

        {/* Splits */}
        {participant.splits && participant.splits.length > 0 && (
          <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-[#80ccd6]/20 my-16">
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

        {/* Create Shareable Card Button */}
        <div className="text-center my-20">
          <button
            onClick={() => setShowCardPreview(true)}
            className="px-16 py-8 bg-gradient-to-r from-gemini-blue to-[#80ccd6] text-white font-bold text-3xl rounded-full hover:scale-105 transition shadow-2xl"
          >
            🎉 Create My Shareable Result Card
          </button>
        </div>

        {/* Hidden High-Resolution Card */}
        <div className="fixed -top-full left-0 opacity-0 pointer-events-none">
          <div
            ref={cardRef}
            className="w-[1080px] h-[1080px] bg-gradient-to-br from-[#001f3f] via-[#003366] to-[#001a33] relative overflow-hidden flex flex-col items-center justify-start text-center px-8 pt-8 pb-20"
            style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}
          >
            {/* Logo Section — Master logo prioritized and fixed */}
            <div className="w-full max-w-3xl bg-white rounded-3xl shadow-2xl p-6 mb-8 flex items-center justify-center">
              {masterLogo ? (
                <img src={masterLogo} alt="Series Logo" className="max-w-full max-h-40 object-contain" crossOrigin="anonymous" />
              ) : eventLogos[selectedEvent.id] ? (
                <img src={eventLogos[selectedEvent.id]} alt="Event Logo" className="max-w-full max-h-36 object-contain" crossOrigin="anonymous" />
              ) : (
                <h2 className="text-5xl font-black text-gemini-dark-gray leading-tight">
                  {selectedEvent.name}
                </h2>
              )}
            </div>

            <p className="text-5xl font-black text-[#80ccd6] mb-4 drop-shadow-lg">
              {raceDisplayName}
            </p>

            <p className="text-4xl text-gray-300 mb-8">
              {formatDate(selectedEvent.start_time)}
            </p>

            <h1 className="text-7xl font-black text-white mb-10 drop-shadow-2xl leading-none px-8">
              {participant.first_name}<br />{participant.last_name}
            </h1>

            <div className="mb-12">
              <p className="text-4xl text-gray-400 uppercase tracking-widest mb-3">Finish Time</p>
              <p className="text-9xl font-black text-[#ffd700] drop-shadow-2xl leading-none">
                {formatChronoTime(participant.chip_time)}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-10 text-white w-full max-w-5xl mb-16">
              <div>
                <p className="text-3xl text-gray-400 uppercase mb-3">Overall</p>
                <p className="text-7xl font-bold text-[#ffd700] leading-none">
                  {participant.place || '—'}
                </p>
                <p className="text-3xl text-gray-400 mt-3">of {overallTotal}</p>
              </div>
              <div>
                <p className="text-3xl text-gray-400 uppercase mb-3">Gender</p>
                <p className="text-7xl font-bold text-[#ffd700] leading-none">
                  {participant.gender_place || '—'}
                </p>
                <p className="text-3xl text-gray-400 mt-3">of {genderTotal}</p>
              </div>
              <div>
                <p className="text-3xl text-gray-400 uppercase mb-3">Division</p>
                <p className="text-7xl font-bold text-[#ffd700] leading-none">
                  {participant.age_group_place || '—'}
                </p>
                <p className="text-3xl text-gray-400 mt-3">of {divisionTotal}</p>
              </div>
            </div>

            <p className="absolute bottom-10 left-1/2 -translate-x-1/2 text-3xl text-gray-500 whitespace-nowrap">
              Find our next race... www.youkeepmoving.com
            </p>
          </div>
        </div>

        {/* Preview Modal */}
        {showCardPreview && (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={() => setShowCardPreview(false)}>
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl mx-auto my-8 p-8" onClick={(e) => e.stopPropagation()}>
              <div className="text-center mb-8">
                <h3 className="text-4xl font-bold">Your Result Card 🎉</h3>
                <p className="text-xl text-gray-600 mt-4">This is exactly what will be shared!</p>
              </div>

              <div className="flex justify-center mb-10">
                <div className="w-96 h-96 bg-gradient-to-br from-[#001f3f] via-[#003366] to-[#001a33] rounded-3xl overflow-hidden shadow-2xl">
                  <div className="h-full flex flex-col items-center justify-start px-4 pt-4 pb-6 text-center text-white text-sm">
                    <div className="w-full bg-white rounded-2xl p-4 mb-4">
                      {masterLogo ? (
                        <img src={masterLogo} alt="Series Logo" className="w-full max-h-20 object-contain" />
                      ) : eventLogos[selectedEvent.id] ? (
                        <img src={eventLogos[selectedEvent.id]} alt="Event Logo" className="w-full max-h-18 object-contain" />
                      ) : (
                        <h2 className="text-2xl font-black text-gemini-dark-gray">{selectedEvent.name}</h2>
                      )}
                    </div>

                    <p className="text-xl font-black text-[#80ccd6] mb-2">{raceDisplayName}</p>
                    <p className="text-lg text-gray-300 mb-3">{formatDate(selectedEvent.start_time)}</p>
                    <h1 className="text-3xl font-black mb-4 leading-none">
                      {participant.first_name}<br />{participant.last_name}
                    </h1>
                    <p className="text-lg text-gray-400 uppercase mb-2">Finish Time</p>
                    <p className="text-5xl font-black text-[#ffd700] mb-6">
                      {formatChronoTime(participant.chip_time)}
                    </p>
                    <div className="grid grid-cols-3 gap-4 text-xs w-full mb-8">
                      <div>
                        <p className="text-gray-400 uppercase">Overall</p>
                        <p className="text-3xl font-bold text-[#ffd700]">{participant.place || '—'}</p>
                        <p className="text-gray-400">of {overallTotal}</p>
                      </div>
                      <div>
                        <p className="text-gray-400 uppercase">Gender</p>
                        <p className="text-3xl font-bold text-[#ffd700]">{participant.gender_place || '—'}</p>
                        <p className="text-gray-400">of {genderTotal}</p>
                      </div>
                      <div>
                        <p className="text-gray-400 uppercase">Division</p>
                        <p className="text-3xl font-bold text-[#ffd700]">{participant.age_group_place || '—'}</p>
                        <p className="text-gray-400">of {divisionTotal}</p>
                      </div>
                    </div>
                    <p className="text-sm text-gray-500">Find our next race... www.youkeepmoving.com</p>
                  </div>
                </div>
              </div>

              <div className="flex justify-center gap-8">
                <button onClick={generateResultCard} className="px-10 py-4 bg-gemini-blue text-white font-bold text-xl rounded-full hover:bg-gemini-blue/90 transition">
                  Download
                </button>
                <button onClick={shareResultCard} className="px-10 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold text-xl rounded-full hover:opacity-90 transition">
                  Share
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Back Button */}
        <div className="text-center my-16">
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
            <h3 className="text-4xl font-bold text-center mb-12 text-gray-800">Event Sponsors</h3>
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