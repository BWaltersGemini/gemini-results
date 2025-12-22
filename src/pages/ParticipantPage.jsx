// src/pages/ParticipantPage.jsx (FULLY UPDATED — Race Story + Mini Rank Sparkline Chart)
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
  const [userPhoto, setUserPhoto] = useState(null);
  const photoInputRef = useRef(null);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [loadingUpcoming, setLoadingUpcoming] = useState(true);
  const cardRef = useRef(null);
  const isMobileDevice = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  // Build the direct link to this participant's results page
  const participantResultsUrl = window.location.href;

  // QR code URL using a reliable free service (qrserver.com)
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(participantResultsUrl)}&margin=10&color=001f3f&bgcolor=FFFFFF`;

  useEffect(() => {
    if (contextSelectedEvent && contextSelectedEvent.id === selectedEvent?.id) {
      setLocalSelectedEvent(contextSelectedEvent);
    }
  }, [contextSelectedEvent]);

  useEffect(() => {
    const fetchUpcoming = async () => {
      try {
        setLoadingUpcoming(true);
        const response = await fetch('https://youkeepmoving.com/wp-json/tribe/events/v1/events?per_page=6&status=publish');
        if (!response.ok) throw new Error('Failed');
        const data = await response.json();
        const futureEvents = (data.events || [])
          .filter(event => new Date(event.start_date) > new Date())
          .sort((a, b) => new Date(a.start_date) - new Date(b.start_date));
        setUpcomingEvents(futureEvents);
      } catch (err) {
        console.error('Failed to load upcoming events:', err);
        setUpcomingEvents([]);
      } finally {
        setLoadingUpcoming(false);
      }
    };
    fetchUpcoming();
  }, []);

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

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const size = Math.min(img.width, img.height);
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, (img.width - size) / 2, (img.height - size) / 2, size, size, 0, 0, size, size);
        setUserPhoto(canvas.toDataURL('image/jpeg', 0.9));
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  };

  const triggerCamera = () => {
    photoInputRef.current?.setAttribute('capture', 'environment');
    photoInputRef.current?.click();
  };

  const triggerGallery = () => {
    photoInputRef.current?.removeAttribute('capture');
    photoInputRef.current?.click();
  };

  const removePhoto = () => setUserPhoto(null);

  useEffect(() => {
    const fetchDataIfMissing = async () => {
      if (participant && selectedEvent && results.length > 0) {
        if (!timeRevealed && participant.chip_time) {
          confetti({ particleCount: 200, spread: 80, origin: { y: 0.5 }, colors: ['#80ccd6', '#00a8e8', '#ffd700', '#ff6b6b', '#4ecdc4'] });
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
          if (resultWithBib) targetEvent = events.find(e => e.id === resultWithBib.event_id);
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
        confetti({ particleCount: 250, spread: 100, origin: { y: 0.6 }, colors: ['#80ccd6', '#00a8e8', '#ffd700', '#ff6b6b', '#4ecdc4'] });
      } catch (err) {
        console.error('[ParticipantPage] Load error:', err);
        setFetchError(err.message || 'Failed to load participant');
      } finally {
        setLoading(false);
      }
    };
    fetchDataIfMissing();
  }, [bib, events, contextResults, contextLoading, initialState]);

  const handleTimeComplete = () => setTimeRevealed(true);

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
            text: `I finished the ${raceDisplayName} in ${participant.chip_time}! 🏊‍♂️🚴‍♂️🏃‍♂️\n\nFull results: ${participantResultsUrl}`,
          });
        } else {
          generateResultCard();
        }
      });
    } catch (err) {
      generateResultCard();
    }
  };

  const shareOnFacebook = () => {
    const url = encodeURIComponent(participantResultsUrl);
    const text = encodeURIComponent(`I just finished the ${raceDisplayName} in ${participant.chip_time}! 🏊‍♂️🚴‍♂️🏃‍♂️`);
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}&quote=${text}`, '_blank');
  };

  const shareOnX = () => {
    const text = encodeURIComponent(`Just finished the ${raceDisplayName} in ${participant.chip_time}! Overall: ${participant.place}, Gender: ${participant.gender_place}, Division: ${participant.age_group_place} 🏁\n\n${participantResultsUrl}`);
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
    if (foundMaster) masterSlug = slugify(foundMaster[0]);
    const eventYear = getYearFromEvent(selectedEvent);
    navigate(`/results/${masterSlug}/${eventYear}`);
  };

  const handleDivisionClick = () => {
    if (!participant?.age_group_name || !selectedEvent) return goBackToResults();
    const allMasterGroups = { ...masterGroupsLocal, ...masterGroups };
    let masterSlug = 'overall';
    const foundMaster = Object.entries(allMasterGroups).find(([key, ids]) =>
      ids.includes(selectedEvent.id.toString())
    );
    if (foundMaster) masterSlug = slugify(foundMaster[0]);
    const eventYear = getYearFromEvent(selectedEvent);
    navigate(`/results/${masterSlug}/${eventYear}`, {
      state: { divisionFilter: participant.age_group_name, highlightBib: participant.bib },
    });
  };

  const trackMe = () => {
    const allMasterGroups = { ...masterGroupsLocal, ...masterGroups };
    let masterSlug = 'overall';
    const foundMaster = Object.entries(allMasterGroups).find(([key, ids]) =>
      ids.includes(selectedEvent.id.toString())
    );
    if (foundMaster) masterSlug = slugify(foundMaster[0]);
    const eventYear = getYearFromEvent(selectedEvent);
    navigate(`/results/${masterSlug}/${eventYear}`, { state: { highlightBib: participant.bib } });
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
          <button onClick={goBackToResults} className="px-12 py-5 bg-gemini-blue text-white font-bold text-xl rounded-full hover:bg-gemini-blue/90 transition shadow-xl">
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
  const currentMasterKey = Object.keys(masterGroups).find(key => masterGroups[key]?.includes(selectedEvent?.id?.toString()));
  const masterLogo = currentMasterKey ? eventLogos[currentMasterKey] : null;
  const isTop10Percent = participant.place && overallTotal > 10 && participant.place <= Math.ceil(overallTotal * 0.1);
  const isAgeGroupWinner = participant.age_group_place === 1;
  const bibLogo = eventLogos[selectedEvent.id] || '/GRR.png';

  // === RACE STORY LOGIC ===
  const getRaceStory = () => {
    if (!participant.splits || participant.splits.length === 0) return null;

    const splitsWithPlace = participant.splits.filter(s => s.place);
    if (splitsWithPlace.length < 2) return "Strong, steady performance throughout!";

    const firstPlace = splitsWithPlace[0].place;
    const finalPlace = participant.place || Infinity;
    const bestPlace = Math.min(...splitsWithPlace.map(s => s.place));
    const worstPlace = Math.max(...splitsWithPlace.map(s => s.place));

    if (finalPlace === 1 && firstPlace === 1) {
      return "Wire-to-wire dominance — led from the gun and never looked back! 🏆";
    }
    if (finalPlace === 1 && firstPlace > 5) {
      return "EPIC COMEBACK! Started mid-pack but stormed to victory with an unstoppable surge! 🔥";
    }
    if (bestPlace === 1 && finalPlace > 3) {
      return "Had the lead early but got passed late — a valiant fight to the line!";
    }
    if (worstPlace - bestPlace >= 20) {
      return "A rollercoaster race — big swings, but battled through every step!";
    }
    if (finalPlace <= 3 && firstPlace > 10) {
      return "Patient and powerful — saved the best for last with a huge negative split! 🚀";
    }
    if (Math.abs(firstPlace - finalPlace) <= 3) {
      return "Rock-solid consistency — stayed near the front the entire race!";
    }

    return "Gritty, determined performance — gave it everything out there!";
  };

  const raceStory = getRaceStory();

  const getRankChange = (current, previous) => {
    if (!previous || !current) return null;
    const diff = previous - current;
    if (diff > 0) return { text: `↑${diff}`, color: "text-green-600 font-bold" };
    if (diff < 0) return { text: `↓${Math.abs(diff)}`, color: "text-red-600 font-bold" };
    return { text: "–", color: "text-gray-500" };
  };

  // Enrich splits with rank change
  const enrichedSplits = participant.splits?.map((split, i, arr) => {
    const prev = i > 0 ? arr[i - 1] : null;
    const rankChange = getRankChange(split.place, prev?.place);
    return { ...split, rankChange };
  }) || [];

  // Add Full Course as final "split"
  const fullCourseSplit = {
    name: "Full Course",
    time: participant.chip_time,
    pace: participant.pace,
    place: participant.place,
    rankChange: getRankChange(participant.place, enrichedSplits[enrichedSplits.length - 1]?.place),
  };

  const splitsWithFullCourse = [...enrichedSplits, fullCourseSplit];

  // === MINI SPARKLINE RANK CHART DATA ===
  const rankData = splitsWithFullCourse
    .map(split => split.place)
    .filter(place => place !== null && place !== undefined);

  const hasRankData = rankData.length > 1;
  const minRank = hasRankData ? Math.min(...rankData) : 1;
  const maxRank = hasRankData ? Math.max(...rankData) : 10;
  const rankRange = maxRank - minRank + 4; // padding

  const chartHeight = 120;
  const chartWidth = 600;
  const points = rankData.map((rank, i) => {
    const x = (i / (rankData.length - 1)) * chartWidth;
    const y = chartHeight - ((rank - minRank + 2) / rankRange) * chartHeight;
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="min-h-screen bg-gradient-to-br from-gemini-light-gray to-gemini-blue/10 pt-40 py-16">
      <div className="max-w-5xl mx-auto px-6 bg-white rounded-3xl shadow-2xl p-10 border border-gemini-blue/20">
        {/* Hero Celebration */}
        <div className="text-center mb-12">
          <h1 className="text-5xl sm:text-6xl md:text-7xl font-extrabold text-gemini-blue mb-6 drop-shadow-lg px-4">
            Congratulations!
          </h1>
          <div className="flex flex-col md:flex-row items-center justify-center gap-12 mb-8">
            <div className="text-center md:text-left">
              <p className="text-3xl font-bold text-gemini-dark-gray">
                {participant.first_name} {participant.last_name}
              </p>
              <p className="text-xl sm:text-2xl text-gray-600 italic mt-2">You crushed the {raceDisplayName}!</p>
            </div>
            <div className="flex justify-center">
              <div className="relative bg-white rounded-xl shadow-2xl border-4 border-gemini-blue overflow-hidden w-96 h-64 flex flex-col items-center justify-center py-6 px-8">
                <div className="absolute top-4 left-8 w-8 h-8 bg-gray-300 rounded-full opacity-30 blur-md"></div>
                <div className="absolute top-4 right-8 w-8 h-8 bg-gray-300 rounded-full opacity-30 blur-md"></div>
                <div className="w-32 h-20 mb-4 flex items-center justify-center">
                  <img src={bibLogo} alt="Event Logo" className="max-w-full max-h-full object-contain" />
                </div>
                <p className="text-9xl font-black text-gemini-blue leading-none">
                  {participant.bib || '—'}
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap justify-center gap-4 mb-8">
            {isTop10Percent && (
              <span className="px-6 py-3 bg-yellow-400 text-white text-xl font-bold rounded-full shadow-lg">Top 10% Overall!</span>
            )}
            {isAgeGroupWinner && (
              <span className="px-6 py-3 bg-gradient-to-r from-yellow-400 to-orange-500 text-white text-xl font-bold rounded-full shadow-lg flex items-center gap-2">
                <span>🏆</span> 1st in {participant.age_group_name}!
              </span>
            )}
          </div>
          <div className="mb-8">
            <h2 className="text-4xl font-bold text-gemini-dark-gray">{selectedEvent.name}</h2>
            <p className="text-xl text-gray-600 italic">{formatDate(selectedEvent.start_time)}</p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
          <div className="bg-gradient-to-br from-gemini-blue/10 to-gemini-blue/5 rounded-3xl p-10 shadow-2xl text-center">
            <p className="text-xl uppercase text-gray-600 tracking-wider mb-6">OFFICIAL TIME</p>
            <p className="text-7xl font-black text-gemini-blue leading-tight">
              {timeRevealed ? formatChronoTime(participant.chip_time) : (
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
          <div className="grid grid-cols-3 gap-6 text-center">
            <div>
              <p className="text-sm uppercase text-gray-500 tracking-wide mb-3">Overall</p>
              <p className="text-5xl font-bold text-gemini-dark-gray">{participant.place || '—'}</p>
              <p className="text-lg text-gray-600">of {overallTotal}</p>
            </div>
            <div>
              <p className="text-sm uppercase text-gray-500 tracking-wide mb-3">Gender</p>
              <p className="text-5xl font-bold text-gemini-dark-gray">{participant.gender_place || '—'}</p>
              <p className="text-lg text-gray-600">of {genderTotal}</p>
            </div>
            <div>
              <p className="text-sm uppercase text-gray-500 tracking-wide mb-3">Division</p>
              <button onClick={handleDivisionClick} className="text-4xl font-bold text-[#80ccd6] hover:underline transition">
                {participant.age_group_place || '—'}
              </button>
              <p className="text-lg text-gray-600">of {divisionTotal}</p>
              <p className="text-sm text-[#80ccd6] mt-2 underline cursor-pointer" onClick={handleDivisionClick}>👥 View Division</p>
            </div>
          </div>
        </div>

        {/* === ENHANCED SPLITS: YOUR RACE STORY WITH RANK SPARKLINE === */}
        {participant.splits && participant.splits.length > 0 && (
          <div className="bg-gradient-to-br from-[#80ccd6]/10 to-gemini-blue/5 rounded-3xl shadow-2xl overflow-hidden border border-[#80ccd6]/30 mb-16">
            <button
              onClick={() => setShowSplits(!showSplits)}
              className="w-full bg-gradient-to-r from-[#80ccd6] to-gemini-blue py-6 text-white font-black text-2xl md:text-3xl hover:opacity-90 transition flex items-center justify-center gap-4"
            >
              <span className="text-3xl">{showSplits ? '▼' : '▶'}</span>
              {showSplits ? 'Hide' : 'Show'} Your Race Story ({participant.splits.length + 1} Points)
            </button>

            {showSplits && (
              <div className="p-8 md:p-12">
                {/* Personalized Race Narrative */}
                {raceStory && (
                  <div className="text-center mb-10">
                    <p className="text-2xl md:text-3xl font-bold text-gemini-dark-gray italic leading-relaxed max-w-4xl mx-auto">
                      {raceStory}
                    </p>
                  </div>
                )}

                {/* Mini Rank Sparkline Chart */}
                {hasRankData && (
                  <div className="mb-12 bg-white rounded-2xl shadow-inner p-8">
                    <h3 className="text-2xl font-bold text-center text-gemini-dark-gray mb-6">
                      Your Position Throughout the Race
                    </h3>
                    <div className="flex justify-center">
                      <svg width={chartWidth} height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="max-w-full h-auto">
                        {/* Grid lines */}
                        <g>
                          {[1, Math.ceil(rankRange / 4), Math.ceil(rankRange / 2), Math.ceil(3 * rankRange / 4), rankRange].map((level, i) => (
                            <line
                              key={i}
                              x1="0"
                              y1={chartHeight - (level / rankRange) * chartHeight}
                              x2={chartWidth}
                              y2={chartHeight - (level / rankRange) * chartHeight}
                              stroke="#e5e7eb"
                              strokeDasharray="5,5"
                            />
                          ))}
                        </g>

                        {/* Rank line */}
                        <polyline
                          fill="none"
                          stroke="#00a8e8"
                          strokeWidth="6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          points={points}
                        />

                        {/* Data points */}
                        {rankData.map((rank, i) => {
                          const x = (i / (rankData.length - 1)) * chartWidth;
                          const y = chartHeight - ((rank - minRank + 2) / rankRange) * chartHeight;
                          return (
                            <g key={i}>
                              <circle cx={x} cy={y} r="10" fill="#001f3f" />
                              <text
                                x={x}
                                y={y - 15}
                                textAnchor="middle"
                                className="text-xl font-black fill-gemini-blue"
                              >
                                {rank}
                              </text>
                            </g>
                          );
                        })}

                        {/* Y-axis labels */}
                        <text x="10" y="20" className="text-sm fill-gray-600">1st</text>
                        <text x="10" y={chartHeight - 10} className="text-sm fill-gray-600">Lower = Better</text>
                      </svg>
                    </div>

                    {/* Split labels below chart */}
                    <div className="flex justify-between mt-4 px-8 text-sm text-gray-600">
                      {splitsWithFullCourse.map((split, i) => (
                        <div key={i} className="text-center">
                          <p className="font-medium">{split.name}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Splits Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-gemini-blue/10 text-gemini-dark-gray font-bold uppercase text-sm tracking-wider">
                      <tr>
                        <th className="px-6 py-5">Split</th>
                        <th className="px-6 py-5 text-center">Split Time</th>
                        <th className="px-6 py-5 text-center">Overall Rank</th>
                        <th className="px-6 py-5 text-center">Change</th>
                        <th className="px-6 py-5 text-center">Pace</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {splitsWithFullCourse.map((split, i) => {
                        const isFullCourse = split.name === "Full Course";
                        return (
                          <tr key={i} className={`hover:bg-gemini-blue/5 transition text-lg ${isFullCourse ? 'bg-gemini-blue/5 font-bold' : ''}`}>
                            <td className="px-6 py-5 font-semibold text-gemini-dark-gray">
                              {split.name}
                            </td>
                            <td className="px-6 py-5 text-center font-medium">
                              {formatChronoTime(split.time) || '—'}
                            </td>
                            <td className="px-6 py-5 text-center font-bold">
                              {split.place ? `#${split.place}` : '—'}
                            </td>
                            <td className="px-6 py-5 text-center text-2xl">
                              {split.rankChange ? (
                                <span className={split.rankChange.color}>
                                  {split.rankChange.text}
                                </span>
                              ) : '—'}
                            </td>
                            <td className="px-6 py-5 text-center text-gray-700">
                              {split.pace || '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Legend */}
                <div className="mt-10 text-center text-sm text-gray-600 space-y-2">
                  <p>↑ = Gained positions • ↓ = Lost positions • – = Held position</p>
                  <p>Full Course row shows your final official result</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Create Shareable Card Button */}
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
            <button onClick={shareOnFacebook} className="px-8 py-4 bg-[#1877F2] text-white font-bold text-xl rounded-full hover:opacity-90 transition flex items-center gap-3">
              <span className="text-3xl">f</span> Share on Facebook
            </button>
            <button onClick={shareOnX} className="px-8 py-4 bg-black text-white font-bold text-xl rounded-full hover:opacity-90 transition flex items-center gap-3">
              <span className="text-3xl">𝕏</span> Post on X
            </button>
            <button onClick={shareOnInstagram} className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold text-xl rounded-full hover:opacity-90 transition flex items-center gap-3">
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

        {/* Sponsors */}
        {ads.length > 0 && (
          <div className="mb-20">
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

        {/* Upcoming Events Carousel */}
        <section className="mt-20">
          <h2 className="text-5xl font-black text-center text-gemini-dark-gray mb-12">Ready for Your Next Adventure?</h2>
          <p className="text-2xl text-center text-gray-600 mb-12">From 5K to Marathon — we’ve got your next goal.</p>
          {loadingUpcoming ? (
            <p className="text-center text-gray-600 text-xl">Loading upcoming races...</p>
          ) : upcomingEvents.length > 0 ? (
            <div className="overflow-x-auto pb-4 -mx-6 px-6 scrollbar-hide">
              <div className="flex gap-8 animate-scroll hover:pause">
                {[...upcomingEvents, ...upcomingEvents].map((event, i) => (
                  <a
                    key={`${event.id}-${i}`}
                    href={event.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-shrink-0 w-80 group bg-white rounded-3xl shadow-xl overflow-hidden hover:shadow-2xl hover:scale-105 transition-all duration-300"
                  >
                    {event.image?.url ? (
                      <img
                        src={event.image.url}
                        alt={event.title.rendered || event.title}
                        className="w-full h-48 object-cover group-hover:scale-110 transition duration-500"
                      />
                    ) : (
                      <div className="h-48 bg-gray-200 flex items-center justify-center">
                        <span className="text-gray-500 font-medium">No Image</span>
                      </div>
                    )}
                    <div className="p-6">
                      <h3 className="text-xl font-bold text-gemini-dark-gray mb-2 line-clamp-2">
                        {event.title.rendered || event.title}
                      </h3>
                      <p className="text-gray-600 mb-4">
                        {new Date(event.start_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                      </p>
                      <span className="inline-block px-6 py-3 bg-gemini-blue text-white font-bold rounded-full hover:bg-gemini-blue/90 transition">
                        Register Now →
                      </span>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-center text-gray-600 text-xl">No upcoming events right now — check back soon!</p>
          )}
        </section>

        {/* Back Button */}
        <div className="text-center mt-16">
          <button
            onClick={goBackToResults}
            className="px-12 py-5 bg-gray-800 text-white font-bold text-xl rounded-full hover:bg-gray-700 transition shadow-xl"
          >
            ← Back to Results
          </button>
        </div>
      </div>

      {/* Hidden Photo Input */}
      <input type="file" ref={photoInputRef} accept="image/*" onChange={handlePhotoUpload} className="hidden" />

      {/* Hidden Full-Size Card for html2canvas — WITH QR CODE */}
      <div className="fixed -top-full left-0 opacity-0 pointer-events-none">
        <div
          ref={cardRef}
          className="w-[1080px] h-[1080px] bg-gradient-to-br from-[#001f3f] via-[#003366] to-[#001a33] flex flex-col items-center justify-start text-center px-8 pt-6 pb-10 overflow-hidden relative"
          style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}
        >
          <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl p-4 mb-6">
            {masterLogo ? (
              <img src={masterLogo} alt="Series Logo" className="max-w-full max-h-28 object-contain mx-auto" crossOrigin="anonymous" />
            ) : eventLogos[selectedEvent.id] ? (
              <img src={eventLogos[selectedEvent.id]} alt="Event Logo" className="max-w-full max-h-24 object-contain mx-auto" crossOrigin="anonymous" />
            ) : (
              <h2 className="text-4xl font-black text-gemini-dark-gray">{selectedEvent.name}</h2>
            )}
          </div>
          <p className="text-3xl font-black text-[#80ccd6] mb-2">{raceDisplayName}</p>
          <p className="text-2xl text-gray-300 mb-8">{formatDate(selectedEvent.start_time)}</p>
          <div className={`flex items-center justify-center gap-16 mb-8 w-full max-w-5xl ${!userPhoto ? 'flex-col gap-6' : ''}`}>
            {userPhoto && (
              <div className="w-64 h-64 rounded-full overflow-hidden border-8 border-white shadow-2xl flex-shrink-0">
                <img src={userPhoto} alt="Finisher" className="w-full h-full object-cover" />
              </div>
            )}
            <h1 className={`font-black text-white drop-shadow-2xl leading-none ${userPhoto ? 'text-6xl' : 'text-7xl'}`}>
              {participant.first_name}<br />{participant.last_name}
            </h1>
          </div>
          <div className="mb-10">
            <p className="text-3xl text-gray-400 uppercase tracking-widest mb-3">Finish Time</p>
            <p className="text-9xl font-black text-[#ffd700] drop-shadow-2xl leading-none">
              {formatChronoTime(participant.chip_time)}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-10 text-white w-full max-w-4xl mb-10">
            <div>
              <p className="text-2xl text-gray-400 uppercase mb-2">Overall</p>
              <p className="text-7xl font-bold text-[#ffd700] leading-none">{participant.place || '—'}</p>
              <p className="text-xl text-gray-400 mt-2">of {overallTotal}</p>
            </div>
            <div>
              <p className="text-2xl text-gray-400 uppercase mb-2">Gender</p>
              <p className="text-7xl font-bold text-[#ffd700] leading-none">{participant.gender_place || '—'}</p>
              <p className="text-xl text-gray-400 mt-2">of {genderTotal}</p>
            </div>
            <div>
              <p className="text-2xl text-gray-400 uppercase mb-2">Division</p>
              <p className="text-7xl font-bold text-[#ffd700] leading-none">{participant.age_group_place || '—'}</p>
              <p className="text-xl text-gray-400 mt-2">of {divisionTotal}</p>
            </div>
          </div>

          {/* QR Code */}
          <div className="absolute bottom-8 right-8 flex flex-col items-center">
            <img
              src={qrCodeUrl}
              alt="QR Code to full results"
              className="w-32 h-32 border-4 border-white rounded-xl shadow-xl"
              crossOrigin="anonymous"
            />
            <p className="text-white text-sm mt-2 font-medium">Scan for full results</p>
          </div>

          <p className="text-3xl text-white italic mt-auto">
            Find your next race at www.youkeepmoving.com
          </p>
        </div>
      </div>

      {/* Card Preview Modal */}
      {showCardPreview && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={() => setShowCardPreview(false)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl mx-auto my-8 p-8 relative" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setShowCardPreview(false)}
              className="absolute top-4 right-4 w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center text-gray-800 text-3xl font-light hover:bg-gray-100 transition z-50"
            >
              ×
            </button>
            <h3 className="text-4xl font-bold text-center text-gemini-dark-gray mb-10">Your Result Card 🎉</h3>
            <div className="flex justify-center mb-10">
              <div className="relative w-96 h-96 rounded-3xl overflow-hidden shadow-2xl border-8 border-gray-200">
                <div className="absolute inset-0 flex items-start justify-center">
                  <div className="w-[1080px] h-[1080px] scale-[0.355] origin-top" style={{ transformOrigin: 'top center' }}>
                    <div className="w-full h-full bg-gradient-to-br from-[#001f3f] via-[#003366] to-[#001a33] flex flex-col items-center justify-start text-center px-8 pt-6 pb-10 overflow-hidden relative" style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}>
                      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl p-4 mb-6">
                        {masterLogo ? (
                          <img src={masterLogo} alt="Series Logo" className="max-w-full max-h-28 object-contain mx-auto" crossOrigin="anonymous" />
                        ) : eventLogos[selectedEvent.id] ? (
                          <img src={eventLogos[selectedEvent.id]} alt="Event Logo" className="max-w-full max-h-24 object-contain mx-auto" crossOrigin="anonymous" />
                        ) : (
                          <h2 className="text-4xl font-black text-gemini-dark-gray">{selectedEvent.name}</h2>
                        )}
                      </div>
                      <p className="text-3xl font-black text-[#80ccd6] mb-2">{raceDisplayName}</p>
                      <p className="text-2xl text-gray-300 mb-8">{formatDate(selectedEvent.start_time)}</p>
                      <div className={`flex items-center justify-center gap-16 mb-8 w-full max-w-5xl ${!userPhoto ? 'flex-col gap-6' : ''}`}>
                        {userPhoto && (
                          <div className="w-64 h-64 rounded-full overflow-hidden border-8 border-white shadow-2xl flex-shrink-0">
                            <img src={userPhoto} alt="Finisher" className="w-full h-full object-cover" />
                          </div>
                        )}
                        <h1 className={`font-black text-white drop-shadow-2xl leading-none ${userPhoto ? 'text-6xl' : 'text-7xl'}`}>
                          {participant.first_name}<br />{participant.last_name}
                        </h1>
                      </div>
                      <div className="mb-10">
                        <p className="text-3xl text-gray-400 uppercase tracking-widest mb-3">Finish Time</p>
                        <p className="text-9xl font-black text-[#ffd700] drop-shadow-2xl leading-none">
                          {formatChronoTime(participant.chip_time)}
                        </p>
                      </div>
                      <div className="grid grid-cols-3 gap-10 text-white w-full max-w-4xl mb-10">
                        <div>
                          <p className="text-2xl text-gray-400 uppercase mb-2">Overall</p>
                          <p className="text-7xl font-bold text-[#ffd700] leading-none">{participant.place || '—'}</p>
                          <p className="text-xl text-gray-400 mt-2">of {overallTotal}</p>
                        </div>
                        <div>
                          <p className="text-2xl text-gray-400 uppercase mb-2">Gender</p>
                          <p className="text-7xl font-bold text-[#ffd700] leading-none">{participant.gender_place || '—'}</p>
                          <p className="text-xl text-gray-400 mt-2">of {genderTotal}</p>
                        </div>
                        <div>
                          <p className="text-2xl text-gray-400 uppercase mb-2">Division</p>
                          <p className="text-7xl font-bold text-[#ffd700] leading-none">{participant.age_group_place || '—'}</p>
                          <p className="text-xl text-gray-400 mt-2">of {divisionTotal}</p>
                        </div>
                      </div>

                      {/* QR Code in preview */}
                      <div className="absolute bottom-8 right-8 flex flex-col items-center">
                        <img
                          src={qrCodeUrl}
                          alt="QR Code"
                          className="w-32 h-32 border-4 border-white rounded-xl shadow-xl"
                        />
                        <p className="text-white text-sm mt-2 font-medium">Scan for full results</p>
                      </div>

                      <p className="text-3xl text-white italic mt-auto">
                        Find your next race at www.youkeepmoving.com
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="mb-10">
              <p className="text-2xl font-bold text-center mb-6">📸 Add Your Finish Line Photo!</p>
              <div className="flex justify-center gap-6 mb-6">
                <button onClick={triggerCamera} className="px-8 py-4 bg-gemini-blue text-white font-bold rounded-full hover:bg-gemini-blue/90 transition">📷 Take Photo</button>
                <button onClick={triggerGallery} className="px-8 py-4 bg-gray-700 text-white font-bold rounded-full hover:bg-gray-600 transition">🖼️ Choose from Gallery</button>
              </div>
              {userPhoto && (
                <div className="text-center">
                  <img src={userPhoto} alt="Your photo" className="w-32 h-32 object-cover rounded-full mx-auto shadow-xl mb-4" />
                  <button onClick={removePhoto} className="text-red-600 underline">Remove Photo</button>
                </div>
              )}
            </div>
            <div className="flex justify-center gap-6">
              <button onClick={generateResultCard} className="px-10 py-4 bg-gemini-blue text-white font-bold text-xl rounded-full hover:bg-gemini-blue/90 transition shadow-xl">
                {isMobileDevice ? 'Save to Photos' : 'Download Image'}
              </button>
              <button onClick={shareResultCard} className="px-10 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold text-xl rounded-full hover:opacity-90 transition shadow-xl">
                Share Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}