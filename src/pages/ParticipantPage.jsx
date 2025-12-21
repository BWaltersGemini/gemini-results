// src/pages/ParticipantPage.jsx (FINAL — Enhanced UX: Hero Celebration + Share Buttons + Track Me + Badges)
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
      if (participant && selectedEvent && results.length > 0) {
        // Trigger confetti on direct load
        if (!timeRevealed && participant.chip_time) {
          confetti({
            particleCount: 200,
            spread: 80,
            origin: { y: 0.5 },
            colors: ['#80ccd6', '#00a8e8', '#ffd700', '#ff6b6b', '#4ecdc4'],
          });
        }
        return;
      }

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

        // Celebration confetti on load
        confetti({
          particleCount: 250,
          spread: 100,
          origin: { y: 0.6 },
          colors: ['#80ccd6', '#00a8e8', '#ffd700', '#ff6b6b', '#4ecdc4'],
        });
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

  // Social share functions
  const shareOnFacebook = () => {
    const url = encodeURIComponent(window.location.href);
    const text = encodeURIComponent(`I just finished the ${raceDisplayName} in ${participant.chip_time}! 🏃‍♂️`);
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}&quote=${text}`, '_blank');
  };

  const shareOnX = () => {
    const text = encodeURIComponent(`Just finished the ${raceDisplayName} in ${participant.chip_time}! Overall: ${participant.place}, Gender: ${participant.gender_place}, Division: ${participant.age_group_place} 🏁\n\n${window.location.href}`);
    window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank');
  };

  const shareOnInstagram = () => {
    alert('Instagram sharing works best with the downloaded image! Save your card and post it directly in the app.');
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

  const trackMe = () => {
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
        highlightBib: participant.bib,
      },
    });
  };

  if (loading || contextLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gemini-light-gray to-gemini-blue/10 pt-40 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-t-4 border-gemini-blue mb-8"></div>
          <p className="text-2xl text-gray-700">Loading your result...</p>
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

  const currentMasterKey = Object.keys(masterGroups).find(key =>
    masterGroups[key]?.includes(selectedEvent?.id?.toString())
  );
  const masterLogo = currentMasterKey ? eventLogos[currentMasterKey] : null;

  // Badges
  const isTop10Percent = participant.place && overallTotal > 10 && participant.place <= Math.ceil(overallTotal * 0.1);
  const isAgeGroupWinner = participant.age_group_place === 1;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gemini-light-gray to-gemini-blue/10 pt-40 py-16">
      <div className="max-w-5xl mx-auto px-6 bg-white rounded-3xl shadow-2xl p-10 border border-gemini-blue/20">
        {/* Hero Celebration */}
        <div className="text-center mb-12">
          <h1 className="text-6xl md:text-7xl font-extrabold text-gemini-blue mb-6 drop-shadow-lg">
            Congratulations!
          </h1>
          <p className="text-3xl font-bold text-gemini-dark-gray mb-4">
            {participant.first_name} {participant.last_name}
          </p>
          <p className="text-2xl text-gray-600 italic mb-8">
            You crushed the {raceDisplayName}!
          </p>

          {/* Badges */}
          <div className="flex flex-wrap justify-center gap-4 mb-8">
            {isTop10Percent && (
              <span className="px-6 py-3 bg-yellow-400 text-white text-xl font-bold rounded-full shadow-lg">
                Top 10% Overall!
              </span>
            )}
            {isAgeGroupWinner && (
              <span className="px-6 py-3 bg-gradient-to-r from-yellow-400 to-orange-500 text-white text-xl font-bold rounded-full shadow-lg flex items-center gap-2">
                <span>🏆</span> 1st in {participant.age_group_name}!
              </span>
            )}
          </div>

          {/* Event Header */}
          <div className="mb-8">
            {eventLogos[selectedEvent.id] ? (
              <img
                src={eventLogos[selectedEvent.id]}
                alt="Event Logo"
                className="mx-auto max-h-32 mb-6 rounded-full shadow-md"
              />
            ) : (
              <div className="mx-auto w-40 h-40 bg-gray-200 rounded-full mb-6 flex items-center justify-center">
                <span className="text-6xl">🏁</span>
              </div>
            )}
            <h2 className="text-4xl font-bold text-gemini-dark-gray">{selectedEvent.name}</h2>
            <p className="text-xl text-gray-600 italic">{formatDate(selectedEvent.start_time)}</p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          {/* Bib */}
          <div className="flex justify-center">
            <div className="bg-gemini-blue/90 text-white border-4 border-gemini-dark-gray rounded-xl p-8 text-center w-72 h-56 flex flex-col justify-center items-center shadow-2xl font-mono">
              <p className="text-lg uppercase tracking-wider font-bold mb-4">BIB NUMBER</p>
              <p className="text-7xl font-black">{participant.bib || '—'}</p>
            </div>
          </div>

          {/* Time */}
          <div className="bg-gradient-to-br from-gemini-blue/10 to-gemini-blue/5 rounded-3xl p-10 shadow-2xl text-center">
            <p className="text-xl uppercase text-gray-600 tracking-wider mb-6">OFFICIAL TIME</p>
            <p className="text-7xl font-black text-gemini-blue leading-tight">
              {timeRevealed ? (
                formatChronoTime(participant.chip_time)
              ) : (
                <CountUp
                  start={0}
                  end={chipTimeSeconds}
                  duration={4}
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
            </p>
          </div>

          {/* Rankings */}
          <div className="grid grid-cols-3 gap-6 text-center">
            <div>
              <p className="text-sm uppercase text-gray-500 tracking-wide mb-3">Overall</p>
              <p className="text-5xl font-bold text-gemini-dark-gray">
                {participant.place || '—'}
              </p>
              <p className="text-lg text-gray-600">of {overallTotal}</p>
            </div>
            <div>
              <p className="text-sm uppercase text-gray-500 tracking-wide mb-3">Gender</p>
              <p className="text-5xl font-bold text-gemini-dark-gray">
                {participant.gender_place || '—'}
              </p>
              <p className="text-lg text-gray-600">of {genderTotal}</p>
            </div>
            <div>
              <p className="text-sm uppercase text-gray-500 tracking-wide mb-3">Division</p>
              <button
                onClick={handleDivisionClick}
                className="text-4xl font-bold text-[#80ccd6] hover:underline transition"
              >
                {participant.age_group_place || '—'}
              </button>
              <p className="text-lg text-gray-600">of {divisionTotal}</p>
              <p className="text-sm text-[#80ccd6] mt-2 underline cursor-pointer" onClick={handleDivisionClick}>
                👥 View Division
              </p>
            </div>
          </div>
        </div>

        {/* Splits */}
        {participant.splits && participant.splits.length > 0 && (
          <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-[#80ccd6]/20 mb-16">
            <button
              onClick={() => setShowSplits(!showSplits)}
              className="w-full bg-gradient-to-r from-[#80ccd6] to-[#80ccd6]/70 py-6 text-white font-bold text-2xl hover:opacity-90 transition"
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

        {/* Create & Share Card */}
        <div className="text-center my-20">
          <button
            onClick={() => setShowCardPreview(true)}
            className="px-20 py-10 bg-gradient-to-r from-gemini-blue to-[#80ccd6] text-white font-bold text-4xl rounded-full hover:scale-105 transition shadow-2xl"
          >
            🎉 Create My Shareable Result Card
          </button>
        </div>

        {/* Social Share Buttons */}
        <div className="text-center mb-16">
          <p className="text-2xl font-bold text-gemini-dark-gray mb-8">Share Your Achievement!</p>
          <div className="flex justify-center gap-8 flex-wrap">
            <button
              onClick={shareOnFacebook}
              className="px-8 py-4 bg-[#1877F2] text-white font-bold text-xl rounded-full hover:opacity-90 transition flex items-center gap-3"
            >
              <span className="text-3xl">f</span> Share on Facebook
            </button>
            <button
              onClick={shareOnX}
              className="px-8 py-4 bg-black text-white font-bold text-xl rounded-full hover:opacity-90 transition flex items-center gap-3"
            >
              <span className="text-3xl">𝕏</span> Post on X
            </button>
            <button
              onClick={shareOnInstagram}
              className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold text-xl rounded-full hover:opacity-90 transition flex items-center gap-3"
            >
              <span className="text-3xl">📸</span> Instagram (Download First)
            </button>
          </div>
        </div>

        {/* Track Me Button */}
        <div className="text-center mb-16">
          <button
            onClick={trackMe}
            className="px-12 py-6 bg-gemini-blue text-white font-bold text-2xl rounded-full hover:bg-gemini-blue/90 transition shadow-xl flex items-center gap-4 mx-auto"
          >
            <span className="text-4xl">⭐</span> Track Me on the Main Results
          </button>
        </div>

        {/* Hidden Card for Download/Share */}
        <div className="fixed -top-full left-0 opacity-0 pointer-events-none">
          <div ref={cardRef} className="w-[1080px] h-[1080px] bg-gradient-to-br from-[#001f3f] via-[#003366] to-[#001a33] relative overflow-hidden flex flex-col items-center justify-start text-center px-8 pt-8 pb-20" style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}>
            {/* Logo */}
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

            {/* Race & Date */}
            <p className="text-5xl font-black text-[#80ccd6] mb-4 drop-shadow-lg">
              {raceDisplayName}
            </p>
            <p className="text-4xl text-gray-300 mb-8">
              {formatDate(selectedEvent.start_time)}
            </p>

            {/* Name */}
            <h1 className="text-7xl font-black text-white mb-10 drop-shadow-2xl leading-none px-8">
              {participant.first_name}<br />{participant.last_name}
            </h1>

            {/* Time */}
            <div className="mb-12">
              <p className="text-4xl text-gray-400 uppercase tracking-widest mb-3">Finish Time</p>
              <p className="text-9xl font-black text-[#ffd700] drop-shadow-2xl leading-none">
                {formatChronoTime(participant.chip_time)}
              </p>
            </div>

            {/* Rankings */}
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

            {/* Footer */}
            <p className="absolute bottom-10 left-1/2 -translate-x-1/2 text-3xl text-gray-500 whitespace-nowrap">
              Find our next race... www.youkeepmoving.com
            </p>
          </div>
        </div>

        {/* Card Preview Modal */}
        {showCardPreview && (
          <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setShowCardPreview(false)}>
            <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full mx-auto my-8 p-10" onClick={(e) => e.stopPropagation()}>
              <div className="text-center mb-10">
                <h3 className="text-5xl font-bold text-gemini-dark-gray">Your Shareable Result Card 🎉</h3>
                <p className="text-2xl text-gray-600 mt-4">Ready to share your achievement!</p>
              </div>

              <div className="flex justify-center mb-12">
                <div className="w-full max-w-lg bg-gradient-to-br from-[#001f3f] via-[#003366] to-[#001a33] rounded-3xl overflow-hidden shadow-2xl">
                  <div className="p-8 text-white text-center">
                    <div className="bg-white rounded-2xl p-6 mb-6">
                      {masterLogo ? (
                        <img src={masterLogo} alt="Logo" className="w-full max-h-32 object-contain mx-auto" />
                      ) : eventLogos[selectedEvent.id] ? (
                        <img src={eventLogos[selectedEvent.id]} alt="Logo" className="w-full max-h-28 object-contain mx-auto" />
                      ) : (
                        <h2 className="text-4xl font-black text-gemini-dark-gray">{selectedEvent.name}</h2>
                      )}
                    </div>
                    <p className="text-3xl font-bold text-[#80ccd6] mb-3">{raceDisplayName}</p>
                    <p className="text-2xl text-gray-300 mb-6">{formatDate(selectedEvent.start_time)}</p>
                    <h1 className="text-5xl font-black mb-8 leading-tight">
                      {participant.first_name}<br />{participant.last_name}
                    </h1>
                    <p className="text-2xl text-gray-400 uppercase mb-4">Finish Time</p>
                    <p className="text-7xl font-black text-[#ffd700] mb-10">
                      {formatChronoTime(participant.chip_time)}
                    </p>
                    <div className="grid grid-cols-3 gap-6 text-lg">
                      <div>
                        <p className="text-gray-400 uppercase">Overall</p>
                        <p className="text-5xl font-bold text-[#ffd700]">{participant.place || '—'}</p>
                        <p className="text-gray-400">of {overallTotal}</p>
                      </div>
                      <div>
                        <p className="text-gray-400 uppercase">Gender</p>
                        <p className="text-5xl font-bold text-[#ffd700]">{participant.gender_place || '—'}</p>
                        <p className="text-gray-400">of {genderTotal}</p>
                      </div>
                      <div>
                        <p className="text-gray-400 uppercase">Division</p>
                        <p className="text-5xl font-bold text-[#ffd700]">{participant.age_group_place || '—'}</p>
                        <p className="text-gray-400">of {divisionTotal}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-center gap-8">
                <button
                  onClick={generateResultCard}
                  className="px-12 py-5 bg-gemini-blue text-white font-bold text-2xl rounded-full hover:bg-gemini-blue/90 transition shadow-xl"
                >
                  Download Image
                </button>
                <button
                  onClick={shareResultCard}
                  className="px-12 py-5 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold text-2xl rounded-full hover:opacity-90 transition shadow-xl"
                >
                  Share Now
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Back & Sponsors */}
        <div className="text-center mb-16">
          <button
            onClick={goBackToResults}
            className="px-12 py-5 bg-gray-800 text-white font-bold text-xl rounded-full hover:bg-gray-700 transition shadow-xl"
          >
            ← Back to Results
          </button>
        </div>

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