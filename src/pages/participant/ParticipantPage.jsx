// src/pages/ParticipantPage.jsx
// COMPLETE FINAL VERSION — Fixed View Division Link + Removed invalid formatChronoTime
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useState, useEffect, useContext, useRef } from 'react';
import { RaceContext } from '../../context/RaceContext';  // ← Fixed path
import { supabase } from '../supabaseClient';
import { useLocalStorage } from '../utils/useLocalStorage';
import { parseChipTime } from '../utils/timeUtils';
import CountUp from 'react-countup';
import confetti from 'canvas-confetti';
import ResultCardPreviewModal from './ResultCardPreviewModal';
import EmailResultsForm from './EmailResultsForm';

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
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [loadingUpcoming, setLoadingUpcoming] = useState(true);

  // Photo upload state
  const [userPhoto, setUserPhoto] = useState(null);
  const photoInputRef = useRef(null);
  const participantResultsUrl = window.location.href;

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

  // Photo upload handlers
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

  // Load participant
  useEffect(() => {
    const loadParticipant = async () => {
      if (participant && selectedEvent && results.finishers.length > 0) {
        if (!timeRevealed && participant.chip_time) {
          confetti({ particleCount: 200, spread: 80, origin: { y: 0.5 }, colors: ['#B22222', '#48D1CC', '#FFD700', '#FF6B6B', '#263238'] });
        }
        return;
      }
      setLoading(true);
      setFetchError(null);
      try {
        if (events.length === 0 || !contextSelectedEvent) {
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
        if (!targetEvent) throw new Error('Event not found');
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

  const handleDivisionClick = () => {
    if (!participant?.age_group_name || !selectedEvent) return goBackToResults();

    let masterSlug = 'overall';
    const foundMaster = Object.entries(masterGroups).find(([_, ids]) =>
      ids.includes(selectedEvent.id.toString())
    );
    if (foundMaster) masterSlug = slugify(foundMaster[0]);

    const eventYear = getYearFromEvent(selectedEvent);
    navigate(`/results/${masterSlug}/${eventYear}`, {
      state: { divisionFilter: participant.age_group_name, highlightBib: participant.bib },
    });
  };

  const trackMe = () => {
    let masterSlug = 'overall';
    const foundMaster = Object.entries(masterGroups).find(([_, ids]) =>
      ids.includes(selectedEvent.id.toString())
    );
    if (foundMaster) masterSlug = slugify(foundMaster[0]);

    const eventYear = getYearFromEvent(selectedEvent);
    navigate(`/results/${masterSlug}/${eventYear}`, { state: { highlightBib: participant.bib } });
  };

  const goBackToResults = () => {
    if (!selectedEvent) {
      navigate('/results');
      return;
    }
    let masterSlug = 'overall';
    const foundMaster = Object.entries(masterGroups).find(([key, ids]) =>
      ids.includes(selectedEvent.id.toString())
    );
    if (foundMaster) masterSlug = slugify(foundMaster[0]);

    const eventYear = getYearFromEvent(selectedEvent);
    navigate(`/results/${masterSlug}/${eventYear}`);
  };

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
    if (finalPlace <= 3 && firstPlace > 10) return "Patient and powerful — saved the best for the finish! 🚀";
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
              <p className="text-2xl text-gray-700 mt-4">
                Division: <button onClick={handleDivisionClick} className="font-bold text-accent hover:underline">
                  {participant.age_group_name || 'N/A'}
                </button>
              </p>
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
              {timeRevealed ? participant.chip_time : (
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
                              {split.time || '—'} {/* ← Fixed: Use raw time string */}
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

        {/* Email Results */}
        <div className="text-center mb-16">
          <button
            onClick={() => setShowEmailForm(true)}
            className="px-16 py-6 bg-green-600 text-white font-bold text-2xl rounded-full hover:bg-green-700 transition shadow-xl"
          >
            📧 Email Me My Results
          </button>
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

        {/* Back Button */}
        <div className="text-center mt-16">
          <button
            onClick={goBackToResults}
            className="px-12 py-5 bg-brand-dark text-white font-bold text-xl rounded-full hover:bg-brand-dark/90 transition shadow-xl"
          >
            ← Back to Results
          </button>
        </div>

        {/* Hidden Photo Input */}
        <input
          type="file"
          ref={photoInputRef}
          accept="image/*"
          onChange={handlePhotoUpload}
          className="hidden"
        />

        {/* Result Card Modal */}
        <ResultCardPreviewModal
          show={showCardPreview}
          onClose={() => setShowCardPreview(false)}
          participant={participant}
          selectedEvent={selectedEvent}
          raceDisplayName={raceDisplayName}
          participantResultsUrl={participantResultsUrl}
          results={results}
          userPhoto={userPhoto}
          triggerCamera={triggerCamera}
          triggerGallery={triggerGallery}
          removePhoto={removePhoto}
          masterLogo={masterLogo}
          bibLogo={bibLogo}
        />

        {/* Email Results Form */}
        <EmailResultsForm
          show={showEmailForm}
          onClose={() => setShowEmailForm(false)}
          participant={participant}
          selectedEvent={selectedEvent}
          raceDisplayName={raceDisplayName}
        />
      </div>
    </div>
  );
}