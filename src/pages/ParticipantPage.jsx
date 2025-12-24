// src/pages/ParticipantPage.jsx
// COMPLETE FINAL VERSION — All Features Restored + Fixed Direct URL Refresh + Fixed Shareable Card Alignment
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
    events = [],
    selectedEvent: contextSelectedEvent,
    results: contextResults = { finishers: [], nonFinishers: [] },
    loadingResults,
    eventLogos = {},
    ads = [],
    masterGroups = {},
  } = useContext(RaceContext);

  const [masterGroupsLocal] = useLocalStorage('masterGroups', {});
  const [editedEventsLocal] = useLocalStorage('editedEvents', {});

  // Priority: navigation state first
  const navState = location.state || {};
  const initialParticipant = navState.participant || null;
  const initialSelectedEvent = navState.selectedEvent || null;
  const initialResults = navState.results || { finishers: [], nonFinishers: [] };

  const [participant, setParticipant] = useState(initialParticipant);
  const [selectedEvent, setSelectedEvent] = useState(initialSelectedEvent);
  const [results, setResults] = useState({
    finishers: initialResults.finishers || [],
    nonFinishers: initialResults.nonFinishers || []
  });
  const [showSplits, setShowSplits] = useState(false);
  const [loading, setLoading] = useState(!initialParticipant);
  const [fetchError, setFetchError] = useState(null);
  const [timeRevealed, setTimeRevealed] = useState(false);
  const [showCardPreview, setShowCardPreview] = useState(false);
  const [userPhoto, setUserPhoto] = useState(null);
  const photoInputRef = useRef(null);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [loadingUpcoming, setLoadingUpcoming] = useState(true);
  const cardRef = useRef(null);

  const isMobileDevice = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  // Direct link + QR code
  const participantResultsUrl = window.location.href;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(participantResultsUrl)}&margin=10&color=263238&bgcolor=FFFFFF`;

  // Fetch upcoming events
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

  // Photo upload
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

  // Load participant — works on navigation AND direct refresh
  useEffect(() => {
    const loadParticipant = async () => {
      if (participant && selectedEvent && results.finishers.length > 0 && results.nonFinishers.length >= 0) {
        if (!timeRevealed && participant.chip_time) {
          confetti({ particleCount: 200, spread: 80, origin: { y: 0.5 }, colors: ['#B22222', '#48D1CC', '#FFD700', '#FF6B6B', '#263238'] });
        }
        return;
      }
      setLoading(true);
      setFetchError(null);
      try {
        // Wait for context basics
        if (events.length === 0 || !contextSelectedEvent) {
          // Gentle poll until ready
          const interval = setInterval(() => {
            if (events.length > 0 && contextSelectedEvent) {
              clearInterval(interval);
              loadParticipant();
            }
          }, 200);
          setTimeout(() => clearInterval(interval), 10000);
          return;
        }
        let targetEvent = selectedEvent || contextSelectedEvent;
        if (!targetEvent) {
          const allResults = [...contextResults.finishers, ...contextResults.nonFinishers];
          const match = allResults.find(r => String(r.bib) === String(bib));
          if (match?.event_id) {
            targetEvent = events.find(e => e.id === match.event_id);
          }
        }
        if (!targetEvent) throw new Error('Event not found for this participant');
        setSelectedEvent(targetEvent);
        const { data: fetchedResults, error } = await supabase
          .from('chronotrack_results')
          .select('*')
          .eq('event_id', targetEvent.id);
        if (error) throw error;
        const finishers = fetchedResults?.filter(r => r.chip_time && r.chip_time.trim() !== '') || [];
        const nonFinishers = fetchedResults?.filter(r => !r.chip_time || r.chip_time.trim() === '') || [];
        setResults({ finishers, nonFinishers });
        const found = fetchedResults?.find(r => String(r.bib) === String(bib));
        if (!found) throw new Error('Participant not found');
        setParticipant(found);
        confetti({ particleCount: 250, spread: 100, origin: { y: 0.6 }, colors: ['#B22222', '#48D1CC', '#FFD700', '#FF6B6B', '#263238'] });
      } catch (err) {
        console.error('[ParticipantPage] Load error:', err);
        setFetchError(err.message || 'Failed to load participant');
      } finally {
        setLoading(false);
      }
    };
    loadParticipant();
  }, [bib, events, contextSelectedEvent, contextResults, loadingResults]);

  const handleTimeComplete = () => setTimeRevealed(true);

  // Generate/share card
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
            text: `I finished the ${raceDisplayName} in ${participant.chip_time}! 🏁\n\nFull results: ${participantResultsUrl}`,
          });
        } else {
          generateResultCard();
        }
      });
    } catch (err) {
      generateResultCard();
    }
  };

  // Social sharing
  const shareOnFacebook = () => {
    const url = encodeURIComponent(participantResultsUrl);
    const text = encodeURIComponent(`I just finished the ${raceDisplayName} in ${participant.chip_time}! 🏁`);
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}&quote=${text}`, '_blank');
  };

  const shareOnX = () => {
    const text = encodeURIComponent(`Just finished the ${raceDisplayName} in ${participant.chip_time}! Overall: ${participant.place}, Gender: ${participant.gender_place}, Division: ${participant.age_group_place} 🏁\n\n${participantResultsUrl}`);
    window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank');
  };

  const shareOnInstagram = () => {
    alert('Instagram sharing works best with the downloaded image! Save your card and post it directly in the app.');
  };

  // Navigation
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

  // Loading / Error
  if (loading || loadingResults) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-brand-light to-white pt-40 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-t-4 border-primary mb-8"></div>
          <p className="text-2xl text-brand-dark">Loading your result...</p>
        </div>
      </div>
    );
  }

  if (fetchError || !participant || !selectedEvent) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-brand-light to-white pt-40 flex items-center justify-center">
        <div className="text-center max-w-md">
          <p className="text-3xl font-bold text-primary mb-6">Participant Not Found</p>
          <p className="text-xl text-brand-dark mb-8">{fetchError || 'Unable to load participant data.'}</p>
          <button onClick={goBackToResults} className="px-12 py-5 bg-primary text-white font-bold text-xl rounded-full hover:bg-primary/90 transition shadow-xl">
            ← Back to Results
          </button>
        </div>
      </div>
    );
  }

  // Stats
  const overallTotal = results.finishers.length + results.nonFinishers.length;
  const genderTotal = results.finishers.filter(r => r.gender === participant.gender).length;
  const divisionTotal = results.finishers.filter(r => r.age_group_name === participant.age_group_name).length;
  const participantRace = selectedEvent.races?.find(r => r.race_id === participant.race_id);
  const raceDisplayName = participantRace?.race_name || participant.race_name || 'Overall';
  const chipTimeSeconds = parseChipTime(participant.chip_time);
  const currentMasterKey = Object.keys(masterGroups).find(key => masterGroups[key]?.includes(selectedEvent?.id?.toString()));
  const masterLogo = currentMasterKey ? eventLogos[currentMasterKey] : null;
  const bibLogo = eventLogos[selectedEvent.id] || '/GRR.png';
  const isTop10Percent = participant.place && overallTotal > 10 && participant.place <= Math.ceil(overallTotal * 0.1);
  const isAgeGroupWinner = participant.age_group_place === 1;

  // Race Story
  const getRaceStory = () => {
    if (!participant.splits || participant.splits.length === 0) return null;
    const splitsWithPlace = participant.splits.filter(s => s.place);
    if (splitsWithPlace.length < 2) return "Strong, steady performance throughout!";
    const firstPlace = splitsWithPlace[0].place;
    const finalPlace = participant.place || Infinity;
    const bestPlace = Math.min(...splitsWithPlace.map(s => s.place));
    const worstPlace = Math.max(...splitsWithPlace.map(s => s.place));
    if (finalPlace === 1 && firstPlace === 1) return "Wire-to-wire dominance — led from the gun and never looked back! 🏆";
    if (finalPlace === 1 && firstPlace > 5) return "EPIC COMEBACK! Started mid-pack but stormed to victory with an unstoppable surge! 🔥";
    if (bestPlace === 1 && finalPlace > 3) return "Had the lead early but got passed late — a valiant fight to the line!";
    if (worstPlace - bestPlace >= 20) return "A rollercoaster race — big swings, but battled through every step!";
    if (finalPlace <= 3 && firstPlace > 10) return "Patient and powerful — saved the best for last with a huge negative split! 🚀";
    if (Math.abs(firstPlace - finalPlace) <= 3) return "Rock-solid consistency — stayed near the front the entire race!";
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

  const enrichedSplits = participant.splits?.map((split, i, arr) => {
    const prev = i > 0 ? arr[i - 1] : null;
    const rankChange = getRankChange(split.place, prev?.place);
    return { ...split, rankChange };
  }) || [];

  const fullCourseSplit = {
    name: "Full Course",
    time: participant.chip_time,
    pace: participant.pace,
    place: participant.place,
    rankChange: getRankChange(participant.place, enrichedSplits[enrichedSplits.length - 1]?.place),
  };

  const splitsWithFullCourse = [...enrichedSplits, fullCourseSplit];

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-light to-white pt-40 py-16">
      <div className="max-w-5xl mx-auto px-6 bg-white rounded-3xl shadow-2xl p-10 border border-primary/20">
        {/* Hero */}
        <div className="text-center mb-12">
          <h1 className="text-5xl sm:text-6xl md:text-7xl font-extrabold text-primary mb-6 drop-shadow-lg px-4">
            Congratulations!
          </h1>
          <div className="flex flex-col md:flex-row items-center justify-center gap-12 mb-8">
            <div className="text-center md:text-left">
              <p className="text-3xl font-bold text-brand-dark">
                {participant.first_name} {participant.last_name}
              </p>
              <p className="text-xl sm:text-2xl text-gray-600 italic mt-2">You crushed the {raceDisplayName}!</p>
            </div>
            <div className="flex justify-center">
              <div className="relative bg-white rounded-xl shadow-2xl border-4 border-primary overflow-hidden w-96 h-64 flex flex-col items-center justify-center py-6 px-8">
                <div className="w-32 h-20 mb-4 flex items-center justify-center">
                  <img src={bibLogo} alt="Event Logo" className="max-w-full max-h-full object-contain" />
                </div>
                <p className="text-9xl font-black text-primary leading-none">
                  {participant.bib || '—'}
                </p>
              </div>
            </div>
          </div>
          {/* Badges */}
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
            <h2 className="text-4xl font-bold text-brand-dark">{selectedEvent.name}</h2>
            <p className="text-xl text-gray-600 italic">{formatDate(selectedEvent.start_time)}</p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
          <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-3xl p-10 shadow-2xl text-center">
            <p className="text-xl uppercase text-gray-600 tracking-wider mb-6">OFFICIAL TIME</p>
            <p className="text-7xl font-black text-primary leading-tight">
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
              <p className="text-5xl font-bold text-brand-dark">{participant.place || '—'}</p>
              <p className="text-lg text-gray-600">of {overallTotal}</p>
            </div>
            <div>
              <p className="text-sm uppercase text-gray-500 tracking-wide mb-3">Gender</p>
              <p className="text-5xl font-bold text-brand-dark">{participant.gender_place || '—'}</p>
              <p className="text-lg text-gray-600">of {genderTotal}</p>
            </div>
            <div>
              <p className="text-sm uppercase text-gray-500 tracking-wide mb-3">Division</p>
              <button onClick={handleDivisionClick} className="text-4xl font-bold text-accent hover:underline transition">
                {participant.age_group_place || '—'}
              </button>
              <p className="text-lg text-gray-600">of {divisionTotal}</p>
              <p className="text-sm text-accent mt-2 underline cursor-pointer" onClick={handleDivisionClick}>👥 View Division</p>
            </div>
          </div>
        </div>

        {/* Splits / Race Story */}
        {participant.splits && participant.splits.length > 0 && (
          <div className="bg-gradient-to-br from-accent/10 to-primary/5 rounded-3xl shadow-2xl overflow-hidden border border-accent/30 mb-16">
            <button
              onClick={() => setShowSplits(!showSplits)}
              className="w-full bg-gradient-to-r from-primary to-accent py-6 text-white font-black text-2xl md:text-3xl hover:opacity-90 transition flex items-center justify-center gap-4"
            >
              <span className="text-3xl">{showSplits ? '▼' : '▶'}</span>
              {showSplits ? 'Hide' : 'Show'} Your Splits ({participant.splits.length + 1} Points)
            </button>
            {showSplits && (
              <div className="p-8 md:p-12">
                {raceStory && (
                  <div className="text-center mb-12">
                    <p className="text-2xl md:text-3xl font-bold text-brand-dark italic leading-relaxed max-w-4xl mx-auto">
                      {raceStory}
                    </p>
                  </div>
                )}
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-primary/10 text-brand-dark font-bold uppercase text-sm tracking-wider">
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
                          <tr key={i} className={`hover:bg-primary/5 transition text-lg ${isFullCourse ? 'bg-primary/5 font-bold' : ''}`}>
                            <td className="px-6 py-5 font-semibold text-brand-dark">
                              {split.name}
                            </td>
                            <td className="px-6 py-5 text-center font-medium text-brand-dark">
                              {formatChronoTime(split.time) || '—'}
                            </td>
                            <td className="px-6 py-5 text-center font-bold text-brand-dark">
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
                <div className="mt-10 text-center text-sm text-gray-600 space-y-2">
                  <p>↑ = Gained positions • ↓ = Lost positions • – = Held position</p>
                  <p>Full Course row shows your final official result</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Create Card */}
        <div className="text-center my-20">
          <button
            onClick={() => setShowCardPreview(true)}
            className="px-20 py-10 bg-gradient-to-r from-primary to-accent text-white font-bold text-4xl rounded-full hover:scale-105 transition shadow-2xl"
          >
            🎉 Create My Shareable Result Card
          </button>
        </div>

        {/* Social Share */}
        <div className="text-center mb-16">
          <p className="text-2xl font-bold text-brand-dark mb-8">Share Your Achievement!</p>
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

        {/* Track Me */}
        <div className="text-center mb-16">
          <button
            onClick={trackMe}
            className="px-12 py-6 bg-primary text-white font-bold text-2xl rounded-full hover:bg-primary/90 transition shadow-xl flex items-center gap-4 mx-auto"
          >
            <span className="text-4xl">⭐</span> Track Me on the Main Results
          </button>
        </div>

        {/* Sponsors */}
        {ads.length > 0 && (
          <div className="mb-20">
            <h3 className="text-4xl font-bold text-center text-brand-dark mb-12">Event Sponsors</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
              {ads.map((ad, i) => (
                <div key={i} className="bg-white rounded-3xl shadow-xl overflow-hidden border border-primary/20 hover:shadow-2xl transition">
                  <img src={ad} alt="Sponsor" className="w-full h-auto" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upcoming Events Carousel */}
        <section className="mt-20">
          <h2 className="text-5xl font-black text-center text-brand-dark mb-12">Ready for Your Next Adventure?</h2>
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
                      <div className="h-48 bg-brand-light flex items-center justify-center">
                        <span className="text-gray-500 font-medium">No Image</span>
                      </div>
                    )}
                    <div className="p-6">
                      <h3 className="text-xl font-bold text-brand-dark mb-2 line-clamp-2">
                        {event.title.rendered || event.title}
                      </h3>
                      <p className="text-gray-600 mb-4">
                        {new Date(event.start_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                      </p>
                      <span className="inline-block px-6 py-3 bg-accent text-brand-dark font-bold rounded-full hover:bg-accent/90 transition">
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

        {/* Action Buttons — Back + Question */}
        <div className="text-center mt-16 space-y-8">
          <button
            onClick={goBackToResults}
            className="px-12 py-5 bg-brand-dark text-white font-bold text-xl rounded-full hover:bg-brand-dark/90 transition shadow-xl"
          >
            ← Back to Results
          </button>

          {/* NEW: Question about my results? button */}
          <div>
            <button
              onClick={() =>
                navigate('/contact', {
                  state: {
                    inquiryType: 'results',
                    eventName: selectedEvent.name,
                    bib: participant.bib,
                    participantName: `${participant.first_name} ${participant.last_name}`.trim(),
                  },
                })
              }
              className="inline-flex items-center gap-3 px-10 py-5 bg-orange-500 text-white text-xl font-bold rounded-full hover:bg-orange-600 shadow-2xl transition transform hover:scale-105"
            >
              <span>❓</span>
              Question about my results?
            </button>
          </div>
        </div>
      </div>

      {/* Hidden Photo Input */}
      <input type="file" ref={photoInputRef} accept="image/*" onChange={handlePhotoUpload} className="hidden" />

      {/* Hidden Full-Size Card for html2canvas */}
      <div className="fixed -top-full left-0 opacity-0 pointer-events-none">
        <div
          ref={cardRef}
          className="w-[1080px] h-[1080px] bg-gradient-to-br from-brand-dark via-[#1a2a3f] to-brand-dark flex flex-col items-center justify-start text-center px-8 pt-6 pb-10 overflow-hidden relative"
          style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}
        >
          <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl p-4 mb-6">
            {masterLogo ? (
              <img src={masterLogo} alt="Series Logo" className="max-w-full max-h-28 object-contain mx-auto" crossOrigin="anonymous" />
            ) : eventLogos[selectedEvent.id] ? (
              <img src={eventLogos[selectedEvent.id]} alt="Event Logo" className="max-w-full max-h-24 object-contain mx-auto" crossOrigin="anonymous" />
            ) : (
              <h2 className="text-4xl font-black text-brand-dark">{selectedEvent.name}</h2>
            )}
          </div>
          <p className="text-3xl font-black text-accent mb-2">{raceDisplayName}</p>
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
            <p className="text-9xl font-black text-[#FFD700] drop-shadow-2xl leading-none">
              {formatChronoTime(participant.chip_time)}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-10 text-white w-full max-w-4xl mb-12">
            <div>
              <p className="text-2xl text-gray-400 uppercase mb-2">Overall</p>
              <p className="text-7xl font-bold text-[#FFD700] leading-none">{participant.place || '—'}</p>
              <p className="text-xl text-gray-400 mt-2">of {overallTotal}</p>
            </div>
            <div>
              <p className="text-2xl text-gray-400 uppercase mb-2">Gender</p>
              <p className="text-7xl font-bold text-[#FFD700] leading-none">{participant.gender_place || '—'}</p>
              <p className="text-xl text-gray-400 mt-2">of {genderTotal}</p>
            </div>
            <div>
              <p className="text-2xl text-gray-400 uppercase mb-2">Division</p>
              <p className="text-7xl font-bold text-[#FFD700] leading-none">{participant.age_group_place || '—'}</p>
              <p className="text-xl text-gray-400 mt-2">of {divisionTotal}</p>
            </div>
          </div>
          <div className="absolute bottom-24 right-8 flex flex-col items-center">
            <p className="text-white text-xl font-bold mb-3">View Full Results</p>
            <img src={qrCodeUrl} alt="QR Code" className="w-40 h-40 border-6 border-white rounded-2xl shadow-2xl" crossOrigin="anonymous" />
          </div>
          <p className="text-3xl text-white italic mt-auto mb-8">
            Find your next race at www.youkeepmoving.com
          </p>
        </div>
      </div>

      {/* Card Preview Modal */}
      {showCardPreview && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={() => setShowCardPreview(false)}>
          <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full mx-auto my-8 p-8 relative" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setShowCardPreview(false)}
              className="absolute top-4 right-4 w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center text-brand-dark text-3xl font-light hover:bg-gray-100 transition z-50"
            >
              ×
            </button>
            <h3 className="text-4xl font-bold text-center text-brand-dark mb-10">Your Result Card 🎉</h3>
            <div className="flex justify-center mb-10">
              <div className="relative w-full max-w-lg aspect-square rounded-3xl overflow-hidden shadow-2xl border-8 border-gray-200 bg-black">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div
                    className="w-[1080px] h-[1080px]"
                    style={{
                      transform: 'scale(0.45)',
                      transformOrigin: 'center center',
                    }}
                  >
                    {cardRef.current && (
                      <div
                        dangerouslySetInnerHTML={{
                          __html: cardRef.current.outerHTML
                            .replace(/className/g, 'class')
                            .replace(/crossOrigin="anonymous"/g, '')
                        }}
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="mb-10">
              <p className="text-2xl font-bold text-center mb-6">📸 Add Your Finish Line Photo!</p>
              <div className="flex justify-center gap-6 mb-6">
                <button onClick={triggerCamera} className="px-8 py-4 bg-primary text-white font-bold rounded-full hover:bg-primary/90 transition">📷 Take Photo</button>
                <button onClick={triggerGallery} className="px-8 py-4 bg-brand-dark text-white font-bold rounded-full hover:bg-brand-dark/90 transition">🖼️ Choose from Gallery</button>
              </div>
              {userPhoto && (
                <div className="text-center">
                  <img src={userPhoto} alt="Your photo" className="w-32 h-32 object-cover rounded-full mx-auto shadow-xl mb-4" />
                  <button onClick={removePhoto} className="text-primary underline">Remove Photo</button>
                </div>
              )}
            </div>
            <div className="flex justify-center gap-6">
              <button onClick={generateResultCard} className="px-10 py-4 bg-primary text-white font-bold text-xl rounded-full hover:bg-primary/90 transition shadow-xl">
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