// src/pages/ParticipantPage.jsx (COMPLETE & FULLY FEATURED — Latest Optimized Version with Larger QR Code)
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useState, useEffect, useContext, useRef } from 'react';
import { RaceContext } from '../context/RaceContext';
import { supabase } from '../supabaseClient';
import html2canvas from 'html2canvas';

export default function ParticipantPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = useParams();
  const { bib, masterKey, year, raceSlug } = params;

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

  const initialState = location.state || {};
  const [participant, setParticipant] = useState(initialState.participant || null);
  const [selectedEvent, setLocalSelectedEvent] = useState(initialState.selectedEvent || contextSelectedEvent);
  const [results, setResults] = useState(initialState.results || contextResults || []);
  const [showSplits, setShowSplits] = useState(false);
  const [loading, setLoading] = useState(!initialState.participant);
  const [fetchError, setFetchError] = useState(null);

  // Shareable card state
  const [cardImage, setCardImage] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const cardRef = useRef(null);

  // Keep local selectedEvent in sync with context
  useEffect(() => {
    if (contextSelectedEvent && contextSelectedEvent.id === selectedEvent?.id) {
      setLocalSelectedEvent(contextSelectedEvent);
    }
  }, [contextSelectedEvent]);

  const formatTime = (timeStr) => {
    if (!timeStr || timeStr.trim() === '') return '—';
    return timeStr.trim();
  };

  const cleanName = (text) => {
    if (!text || typeof text !== 'string') return '';
    return text.trim().replace(/['`]/g, '').toLowerCase();
  };

  const slugify = (text) => {
    if (!text || typeof text !== 'string') return 'overall';
    return text.trim().replace(/['`]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  };

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

  const getYearFromEvent = (event) => {
    if (!event?.start_time) return null;
    return new Date(event.start_time * 1000).getFullYear().toString();
  };

  // Generate shareable card using html2canvas
  const generateCard = async () => {
    if (!cardRef.current || !participant || !selectedEvent) return;

    setIsGenerating(true);
    try {
      const canvas = await html2canvas(cardRef.current, {
        scale: 2, // High quality
        useCORS: true,
        backgroundColor: '#1e293b',
        logging: false,
      });
      const image = canvas.toDataURL('image/png');
      setCardImage(image);
    } catch (err) {
      console.error('Failed to generate card:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    if (participant && selectedEvent) {
      generateCard();
    }
  }, [participant, selectedEvent]);

  // Fetch participant data if accessed directly via URL (no state passed)
  useEffect(() => {
    const fetchDataIfMissing = async () => {
      if (initialState.participant) return;

      setLoading(true);
      setFetchError(null);

      try {
        if (!masterKey || !year || events.length === 0 || Object.keys(masterGroups).length === 0) {
          throw new Error('Invalid URL parameters');
        }

        const urlSlug = slugify(decodeURIComponent(masterKey));
        const storedMasterKey = Object.keys(masterGroups).find(
          (key) => slugify(key) === urlSlug
        );

        if (!storedMasterKey) throw new Error('Event series not found');

        const groupEventIds = masterGroups[storedMasterKey].map(String);
        const yearEvents = events
          .filter((e) => e && e.id && groupEventIds.includes(String(e.id)) && getYearFromEvent(e) === year)
          .sort((a, b) => (b.start_time || 0) - (a.start_time || 0));

        if (yearEvents.length === 0) throw new Error('No event found for this year');

        const event = yearEvents[0];
        setLocalSelectedEvent(event);
        setSelectedEvent(event);

        let eventResults = results;
        if (eventResults.length === 0) {
          const { data, error } = await supabase
            .from('chronotrack_results')
            .select('*')
            .eq('event_id', event.id);

          if (error) throw error;
          eventResults = data || [];
          setResults(eventResults);
        }

        const foundParticipant = eventResults.find(p => p.bib === bib);
        if (!foundParticipant) throw new Error('Participant not found');

        setParticipant(foundParticipant);
      } catch (err) {
        console.error('[ParticipantPage] Fetch error:', err);
        setFetchError(err.message || 'Failed to load participant');
      } finally {
        setLoading(false);
      }
    };

    fetchDataIfMissing();
  }, [bib, masterKey, year, raceSlug, events, masterGroups, results, initialState]);

  const goBackToResults = () => {
    navigate(-1);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-brand-light to-white flex items-center justify-center">
        <p className="text-3xl text-gray-700">Loading participant details...</p>
      </div>
    );
  }

  if (fetchError || !participant || !selectedEvent) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-brand-light to-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-4xl font-bold text-red-600 mb-4">Participant Not Found</p>
          <p className="text-xl text-gray-600 mb-8">{fetchError || 'Invalid bib number or event'}</p>
          <button
            onClick={goBackToResults}
            className="px-12 py-5 bg-gray-800 text-white font-bold text-xl rounded-full hover:bg-gray-700 transition shadow-xl"
          >
            ← Back to Results
          </button>
        </div>
      </div>
    );
  }

  const eventName = editedEvents[selectedEvent.id]?.name || selectedEvent.name;
  const raceName = selectedEvent.races?.find(r => r.race_id === participant.race_id)?.race_name || participant.race_name || 'Overall';
  const totalFinishers = results.filter(r => r.chip_time && r.chip_time.trim() !== '').length;

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-light to-white pt-32 pb-20">
      <div className="max-w-5xl mx-auto px-6">
        {/* Participant Header */}
        <div className="text-center mb-16">
          <h1 className="text-5xl md:text-6xl font-black text-brand-dark mb-4">
            {participant.first_name} {participant.last_name}
          </h1>
          <p className="text-3xl text-gray-700 mb-2">Bib #{participant.bib}</p>
          <p className="text-2xl text-gray-600">{eventName}</p>
          <p className="text-xl text-gray-500">{formatDate(selectedEvent.start_time)}</p>
        </div>

        {/* Main Results Card */}
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden border border-primary/20 mb-16">
          <div className="bg-gradient-to-r from-primary to-primary/80 py-8 text-white text-center">
            <h2 className="text-4xl font-bold">{raceName}</h2>
          </div>

          <div className="p-10 grid grid-cols-1 md:grid-cols-3 gap-10">
            <div className="text-center">
              <p className="text-lg uppercase text-gray-600 tracking-wider mb-3">Overall Place</p>
              <p className="text-6xl font-black text-primary">
                {participant.place ? `${participant.place}${participant.place === 1 ? 'st' : participant.place === 2 ? 'nd' : participant.place === 3 ? 'rd' : 'th'}` : '—'}
              </p>
            </div>

            <div className="text-center">
              <p className="text-lg uppercase text-gray-600 tracking-wider mb-3">Chip Time</p>
              <p className="text-6xl font-black text-brand-dark">{formatTime(participant.chip_time)}</p>
            </div>

            <div className="text-center">
              <p className="text-lg uppercase text-gray-600 tracking-wider mb-3">Pace</p>
              <p className="text-5xl font-bold text-gray-800">{participant.pace || '—'}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 px-10 pb-10 text-center">
            <div>
              <p className="text-gray-600">Gender Place</p>
              <p className="text-3xl font-bold text-brand-dark">
                {participant.gender_place ? `${participant.gender_place}${participant.gender_place === 1 ? 'st' : participant.gender_place === 2 ? 'nd' : participant.gender_place === 3 ? 'rd' : 'th'}` : '—'}
              </p>
            </div>
            <div>
              <p className="text-gray-600">Division</p>
              <p className="text-2xl font-bold text-gray-800">{participant.age_group_name || '—'}</p>
            </div>
            <div>
              <p className="text-gray-600">Division Place</p>
              <p className="text-3xl font-bold text-brand-dark">
                {participant.age_group_place ? `${participant.age_group_place}${participant.age_group_place === 1 ? 'st' : participant.age_group_place === 2 ? 'nd' : participant.age_group_place === 3 ? 'rd' : 'th'}` : '—'}
              </p>
            </div>
            <div>
              <p className="text-gray-600">Age</p>
              <p className="text-3xl font-bold text-gray-800">{participant.age || '—'}</p>
            </div>
          </div>
        </div>

        {/* Splits Table */}
        {participant.splits && participant.splits.length > 0 && (
          <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-primary/20 mb-16">
            <button
              onClick={() => setShowSplits(!showSplits)}
              className="w-full bg-gradient-to-r from-primary to-primary/70 py-6 text-white font-bold text-xl hover:opacity-90 transition"
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

        {/* Shareable Card Section */}
        <div className="mb-16">
          <h2 className="text-4xl font-bold text-center text-brand-dark mb-12">Share Your Result!</h2>

          {/* Hidden template for html2canvas */}
          <div style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
            <div
              ref={cardRef}
              className="w-80 bg-slate-900 text-white flex flex-col items-center justify-between relative overflow-hidden"
              style={{
                height: '1422px',
                padding: '40px 24px',
                fontFamily: 'system-ui, sans-serif',
                gap: '20px',
              }}
            >
              <div className="absolute inset-0 opacity-10">
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/20 to-transparent"></div>
              </div>

              {/* Compact Top Section */}
              <div className="text-center z-10">
                <div className="bg-white text-slate-900 text-5xl font-black px-8 py-4 rounded-2xl shadow-2xl mb-4">
                  {participant.age || '?'}
                </div>
                <p className="text-3xl uppercase tracking-wider opacity-90 mb-2">Division</p>
                <p className="text-9xl font-black text-yellow-400 drop-shadow-2xl leading-none">
                  {participant.age_group_place || '?'}
                </p>
              </div>

              {/* Bottom Section with Large QR */}
              <div className="text-center z-10 flex flex-col items-center">
                <p className="text-3xl font-bold mb-6 leading-tight">
                  View Full Results<br />
                  of {totalFinishers}
                </p>

                <div className="bg-white p-6 rounded-2xl shadow-2xl mb-8">
                  <div className="w-64 h-64 bg-gray-200 border-2 border-dashed border-gray-400 rounded-xl flex items-center justify-center">
                    <span className="text-gray-500 text-2xl font-bold">QR</span>
                  </div>
                </div>

                <p className="text-3xl font-medium tracking-wider">keepmoving.com</p>
              </div>
            </div>
          </div>

          {/* Live Preview in Phone Frame */}
          <div className="max-w-sm mx-auto bg-gray-100 rounded-3xl p-8 shadow-2xl">
            <div className="relative bg-white rounded-3xl overflow-hidden shadow-inner">
              <div className="aspect-[9/16] relative bg-slate-900 flex items-center justify-center">
                {isGenerating ? (
                  <p className="text-white text-2xl">Generating card...</p>
                ) : cardImage ? (
                  <img
                    src={cardImage}
                    alt="Your shareable result card"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <p className="text-white text-2xl">Loading card...</p>
                )}
              </div>
            </div>

            {/* Photo Upload Prompt */}
            <div className="text-center mt-10">
              <p className="text-3xl font-bold text-brand-dark mb-6">Add Your Finish Line Photo!</p>
              <div className="flex justify-center gap-6 flex-wrap">
                <button className="px-10 py-5 bg-red-600 text-white font-bold text-xl rounded-full hover:bg-red-700 transition flex items-center gap-3">
                  <span>📷</span> Take Photo
                </button>
                <button className="px-10 py-5 bg-gray-800 text-white font-bold text-xl rounded-full hover:bg-gray-900 transition flex items-center gap-3">
                  <span>🖼️</span> Choose from Gallery
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Back to Results Button */}
        <div className="text-center mb-16">
          <button
            onClick={goBackToResults}
            className="px-12 py-5 bg-gray-800 text-white font-bold text-xl rounded-full hover:bg-gray-700 transition shadow-xl"
          >
            ← Back to Results
          </button>
        </div>

        {/* Event Sponsors */}
        {ads.length > 0 && (
          <div>
            <h3 className="text-4xl font-bold text-center mb-12 text-gray-800">Event Sponsors</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
              {ads.map((ad, i) => (
                <div key={i} className="bg-white rounded-3xl shadow-xl overflow-hidden border border-primary/20 hover:shadow-2xl transition">
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