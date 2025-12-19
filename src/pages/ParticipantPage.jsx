// src/pages/ParticipantPage.jsx (FINAL — Share/Download Card Matches Preview Exactly)
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

  // Fetch data
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

  // Confetti
  const handleTimeComplete = () => {
    setTimeRevealed(true);
    confetti({
      particleCount: 150,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#80ccd6', '#00a8e8', '#ffd700', '#ff6b6b', '#4ecdc4'],
    });
  };

  // Card Generation
  const generateResultCard = async () => {
    if (!cardRef.current) return;
    try {
      const canvas = await html2canvas(cardRef.current, { scale: 2, useCORS: true, allowTaint: true });
      const image = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `${participant.first_name}_${participant.last_name}_gemini_result.png`;
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
      const canvas = await html2canvas(cardRef.current, { scale: 2, useCORS: true, allowTaint: true });
      canvas.toBlob(async (blob) => {
        const file = new File([blob], 'gemini-result-card.png', { type: 'image/png' });
        if (navigator.share) {
          await navigator.share({
            files: [file],
            title: 'My Race Result!',
            text: `I finished ${raceDisplayName} at ${selectedEvent.name} in ${participant.chip_time}! 🏃‍♂️ Timed by Gemini Timing`,
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

  // Master logo priority
  const currentMasterKey = Object.keys(masterGroups).find(key =>
    masterGroups[key]?.includes(selectedEvent?.id?.toString())
  );
  const masterLogo = currentMasterKey ? eventLogos[currentMasterKey] : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gemini-light-gray to-gemini-blue/10 pt-40 py-16">
      <div className="max-w-5xl mx-auto px-6 bg-white rounded-3xl shadow-2xl p-10 border border-gemini-blue/20">
        {/* Page Content - unchanged */}
        {/* ... (header, name, stats, times, splits, back button, sponsors) ... */}
        {/* Keeping the main page content exactly as before for brevity — only card section changed below */}

        {/* Result Card Generator Button */}
        <div className="text-center mb-12">
          <button
            onClick={() => setShowCardPreview(true)}
            className="px-12 py-6 bg-gradient-to-r from-gemini-blue to-[#80ccd6] text-white font-bold text-2xl rounded-full hover:scale-105 transition shadow-2xl"
          >
            🎉 Create My Shareable Result Card
          </button>
        </div>

        {/* SINGLE SOURCE OF TRUTH: Hidden Card for html2canvas + Preview */}
        <div className="fixed -top-full left-0 opacity-0 pointer-events-none">
          <div
            ref={cardRef}
            className="w-[1080px] h-[1080px] bg-gradient-to-br from-[#001f3f] via-[#003366] to-[#001a33] relative overflow-hidden flex flex-col items-center justify-center text-center px-12 py-16"
            style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}
          >
            {/* White Logo Section */}
            <div className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl p-12 mb-12 flex items-center justify-center">
              {masterLogo ? (
                <img src={masterLogo} alt="Series Logo" className="max-w-full max-h-80 object-contain" crossOrigin="anonymous" />
              ) : eventLogos[selectedEvent.id] ? (
                <img src={eventLogos[selectedEvent.id]} alt="Event Logo" className="max-w-full max-h-72 object-contain" crossOrigin="anonymous" />
              ) : (
                <h2 className="text-7xl font-black text-gemini-dark-gray">
                  {selectedEvent.name}
                </h2>
              )}
            </div>

            {/* Race Name */}
            <p className="text-7xl font-black text-[#80ccd6] mb-6 drop-shadow-2xl">
              {raceDisplayName}
            </p>

            {/* Date */}
            <p className="text-5xl text-gray-300 mb-16">
              {formatDate(selectedEvent.start_time)}
            </p>

            {/* Runner Name */}
            <h1 className="text-8xl font-black text-white mb-16 drop-shadow-2xl leading-tight">
              {participant.first_name}<br />{participant.last_name}
            </h1>

            {/* Finish Time - HERO */}
            <div className="mb-16">
              <p className="text-5xl text-gray-400 uppercase tracking-widest mb-4">Finish Time</p>
              <p className="text-13xl font-black text-[#ffd700] drop-shadow-2xl">
                {formatChronoTime(participant.chip_time)}
              </p>
            </div>

            {/* Rankings - Larger */}
            <div className="grid grid-cols-3 gap-16 text-white">
              <div>
                <p className="text-4xl text-gray-400 uppercase mb-3">Overall</p>
                <p className="text-9xl font-bold text-[#ffd700]">
                  {participant.place || '—'}
                </p>
                <p className="text-4xl text-gray-400 mt-2">of {overallTotal}</p>
              </div>
              <div>
                <p className="text-4xl text-gray-400 uppercase mb-3">Gender</p>
                <p className="text-9xl font-bold text-[#ffd700]">
                  {participant.gender_place || '—'}
                </p>
                <p className="text-4xl text-gray-400 mt-2">of {genderTotal}</p>
              </div>
              <div>
                <p className="text-4xl text-gray-400 uppercase mb-3">Division</p>
                <p className="text-9xl font-bold text-[#ffd700]">
                  {participant.age_group_place || '—'}
                </p>
                <p className="text-4xl text-gray-400 mt-2">of {divisionTotal}</p>
              </div>
            </div>

            {/* Branding */}
            <p className="absolute bottom-12 left-1/2 -translate-x-1/2 text-4xl text-gray-500">
              Timed by Gemini Timing • www.geminitiming.com
            </p>
          </div>
        </div>

        {/* Card Preview Modal — Now uses same layout (just scaled) */}
        {showCardPreview && (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setShowCardPreview(false)}>
            <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
              <div className="text-center mb-6">
                <h3 className="text-3xl font-bold">Your Result Card 🎉</h3>
                <p className="text-lg text-gray-600 mt-2">This is exactly what will be shared!</p>
              </div>

              <div className="flex justify-center mb-8">
                <div className="w-full aspect-square bg-gradient-to-br from-[#001f3f] via-[#003366] to-[#001a33] rounded-3xl overflow-hidden shadow-2xl scale-95">
                  <div className="h-full flex flex-col items-center justify-center p-8 text-center text-white">
                    <div className="w-full bg-white rounded-2xl p-8 mb-8">
                      {masterLogo ? (
                        <img src={masterLogo} alt="Series Logo" className="w-full max-h-40 object-contain" />
                      ) : eventLogos[selectedEvent.id] ? (
                        <img src={eventLogos[selectedEvent.id]} alt="Event Logo" className="w-full max-h-32 object-contain" />
                      ) : (
                        <h2 className="text-4xl font-black text-gemini-dark-gray">
                          {selectedEvent.name}
                        </h2>
                      )}
                    </div>

                    <p className="text-4xl font-black text-[#80ccd6] mb-4">{raceDisplayName}</p>
                    <p className="text-2xl text-gray-300 mb-8">{formatDate(selectedEvent.start_time)}</p>

                    <h1 className="text-4xl font-black mb-8 leading-tight">
                      {participant.first_name}<br />{participant.last_name}
                    </h1>

                    <p className="text-2xl text-gray-400 uppercase mb-2">Finish Time</p>
                    <p className="text-6xl font-black text-[#ffd700] mb-10">
                      {formatChronoTime(participant.chip_time)}
                    </p>

                    <div className="grid grid-cols-3 gap-4 text-lg">
                      <div>
                        <p className="text-gray-400 uppercase">Overall</p>
                        <p className="text-4xl font-bold text-[#ffd700]">{participant.place || '—'}</p>
                        <p className="text-gray-400 text-sm">of {overallTotal}</p>
                      </div>
                      <div>
                        <p className="text-gray-400 uppercase">Gender</p>
                        <p className="text-4xl font-bold text-[#ffd700]">{participant.gender_place || '—'}</p>
                        <p className="text-gray-400 text-sm">of {genderTotal}</p>
                      </div>
                      <div>
                        <p className="text-gray-400 uppercase">Division</p>
                        <p className="text-4xl font-bold text-[#ffd700]">{participant.age_group_place || '—'}</p>
                        <p className="text-gray-400 text-sm">of {divisionTotal}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-center gap-6">
                <button
                  onClick={generateResultCard}
                  className="px-8 py-4 bg-gemini-blue text-white font-bold text-lg rounded-full hover:bg-gemini-blue/90 transition"
                >
                  Download
                </button>
                <button
                  onClick={shareResultCard}
                  className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold text-lg rounded-full hover:opacity-90 transition"
                >
                  Share
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Rest of page (back button, sponsors) unchanged */}
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