// src/pages/ParticipantPage.jsx (FINAL — Totals, splits, country, clean layout)
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useState, useEffect, useContext } from 'react';
import html2canvas from 'html2canvas';
import { RaceContext } from '../context/RaceContext';
import { supabase } from '../supabaseClient';
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
  const [previews, setPreviews] = useState([]);
  const [selectedPreviewIndex, setSelectedPreviewIndex] = useState(0);
  const [showSplits, setShowSplits] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [previewError, setPreviewError] = useState(null);
  const cleanName = (text) => {
    if (!text || typeof text !== 'string') return '';
    return text.trim().replace(/['`]/g, '').toLowerCase();
  };
  const slugify = (text) => {
    if (!text || typeof text !== 'string') return 'overall';
    return text
      .trim()
      .replace(/['`]/g, '') // remove apostrophes
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
            console.log('Context is still loading events, waiting...');
            return;
          }
          if (events.length === 0) {
            console.log('No events loaded in context');
            throw new Error('No events available.');
          }
          // Find event
          const decodedMaster = decodeURIComponent(masterKey).replace(/-/g, ' ').toLowerCase();
          let groupEntry = Object.entries(masterGroups).find(([key]) => slugify(editedEvents[key]?.name || key) === masterKey || cleanName(editedEvents[key]?.name || key) === cleanName(decodedMaster));
          let groupEventIds = groupEntry ? groupEntry[1] : [];
          if (groupEventIds.length === 0) {
            // Fallback if no master group
            groupEventIds = events.filter(e => slugify(editedEvents[e.id]?.name || e.name) === masterKey || cleanName(editedEvents[e.id]?.name || e.name) === cleanName(decodedMaster)).map(e => e.id);
          }
          console.log('Group event IDs:', groupEventIds);
          const yearEvents = events
            .filter(e => groupEventIds.includes(e.id) && e.date.startsWith(year))
            .sort((a, b) => new Date(b.date) - new Date(a.date));
          if (yearEvents.length === 0) {
            console.log('No year events found for masterKey:', masterKey, 'decodedMaster:', decodedMaster, 'year:', year, 'groupEventIds:', groupEventIds, 'all events:', events.map(e => ({id: e.id, name: e.name, date: e.date})));
            throw new Error('No matching event found.');
          }
          const targetEvent = yearEvents[0];
          console.log('Found event:', targetEvent);
          setSelectedEvent(targetEvent);
          // Fetch participant
          const { data: participantData, error: pError } = await supabase
            .from('chronotrack_results')
            .select('*')
            .eq('event_id', targetEvent.id.toString())
            .eq('bib', bib)
            .single();
          if (pError || !participantData) {
            console.error('Participant fetch error:', pError);
            throw new Error('Participant not found.');
          }
          console.log('Participant data:', participantData);
          setParticipant(participantData);
          // Fetch results if needed
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
            console.log('Fetched results length:', allResults.length);
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
  // Move this useEffect up here (before any early returns) to avoid conditional hook calls
  useEffect(() => {
    const generatePreviews = async () => {
      if (!participant || !selectedEvent) return; // Guard to skip if data not ready
      const previewUrls = [];
      for (let i = 0; i < variants.length; i++) {
        const certificate = document.getElementById(`certificate-variant-${i}`);
        if (!certificate) {
          console.warn(`Certificate variant ${i} not found in DOM`);
          continue;
        }
        try {
          const canvas = await html2canvas(certificate, {
            scale: window.devicePixelRatio || 1,
            useCORS: true,
            logging: true,
            onclone: (clonedDocument) => {
              const clonedCert = clonedDocument.getElementById(`certificate-variant-${i}`);
              clonedCert.style.position = 'absolute';
              clonedCert.style.left = '0';
              clonedCert.style.top = '0';
              clonedCert.style.display = 'block';
              clonedCert.style.visibility = 'visible';
            }
          });
          previewUrls.push(canvas.toDataURL('image/png'));
        } catch (err) {
          console.error('Failed to generate preview for variant', i, ':', err);
          setPreviewError('Failed to generate some graphics. Please try again.');
        }
      }
      console.log('Generated previews length:', previewUrls.length);
      setPreviews(previewUrls);
    };
    setTimeout(generatePreviews, 1000); // Increased delay for mobile reliability
  }, [participant, selectedEvent]);
  const goBackToResults = () => navigate(-1);
  if (contextLoading || loading) {
    return (
      <div className="text-center py-20 pt-40">
        <p className="text-3xl text-gemini-dark-gray mb-4">Loading Participant...</p>
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-gemini-blue mx-auto"></div>
      </div>
    );
  }
  if (fetchError || !participant) {
    return (
      <div className="text-center py-20 pt-40">
        <p className="text-2xl text-gemini-red mb-4">{fetchError || 'No participant data available.'}</p>
        <button onClick={goBackToResults} className="bg-gemini-blue text-white px-6 py-3 rounded-lg hover:bg-gemini-blue/90">
          Back to Results
        </button>
      </div>
    );
  }
  // Calculate totals
  const raceResults = results.filter(r => r.race_id === participant.race_id);
  const overallTotal = raceResults.length;
  const genderTotal = raceResults.filter(r => r.gender === participant.gender).length;
  const divisionTotal = raceResults.filter(r => r.age_group_name === participant.age_group_name).length;
  const variants = [
    // ... your existing 5 variants unchanged ...
  ];
  const shareCertificate = async () => {
    const selectedUrl = previews[selectedPreviewIndex];
    if (!selectedUrl) return;
    try {
      const response = await fetch(selectedUrl);
      const blob = await response.blob();
      const file = new File([blob], 'finishers-graphic.png', { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: 'My Race Finish!',
          text: `I finished ${selectedEvent.name}!`,
          files: [file],
        });
      } else {
        downloadCertificate();
      }
    } catch (err) {
      console.error('Share failed:', err);
      downloadCertificate();
    }
  };
  const downloadCertificate = () => {
    const selectedUrl = previews[selectedPreviewIndex];
    if (!selectedUrl) return;
    const link = document.createElement('a');
    link.download = 'finishers-graphic.png';
    link.href = selectedUrl;
    link.click();
  };
  console.log('Rendering participant page with data:', { participant, selectedEvent, resultsLength: results.length, previewsLength: previews.length, previewError });
  return (
    <div className="min-h-screen bg-gradient-to-br from-gemini-light-gray to-gemini-blue/10 pt-40 py-16">
      <div className="max-w-5xl mx-auto px-6 bg-white rounded-3xl shadow-2xl p-10 border border-gemini-blue/20">
        {/* Race Header */}
        <div className="text-center mb-8">
          <img
            src={eventLogos[selectedEvent?.id] || '/GRR.png'}
            alt="Race Logo"
            className="mx-auto max-h-24 mb-4 rounded-full shadow-md"
          />
          <h2 className="text-3xl font-bold text-gemini-dark-gray">{selectedEvent?.name || 'Race Results'}</h2>
          <p className="text-lg text-gray-600 italic">{selectedEvent?.date || 'Date TBD'}</p>
        </div>
        {/* Participant Name */}
        <h3 className="text-5xl font-extrabold mb-8 text-center text-gemini-blue drop-shadow-md">
          {participant.first_name} {participant.last_name}
        </h3>
        {/* BIB and Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
          <div className="flex justify-center">
            <div className="bg-gemini-blue/90 text-white border-4 border-gemini-dark-gray rounded-xl p-6 text-center w-64 h-48 flex flex-col justify-center items-center shadow-xl font-mono transform hover:scale-105 transition">
              <p className="text-sm uppercase tracking-wider font-bold mb-2">BIB</p>
              <p className="text-7xl font-black">{participant.bib || '—'}</p>
            </div>
          </div>
          <div className="bg-gemini-light-gray rounded-2xl p-6 shadow-md">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-4 text-lg">
              <dt className="font-semibold text-gemini-dark-gray">Time</dt>
              <dd className="font-bold text-gemini-blue">{participant.chip_time || '—'}</dd>
              <dt className="font-semibold text-gemini-dark-gray">Pace</dt>
              <dd className="font-bold text-gemini-blue">{participant.pace || '—'}</dd>
              <dt className="font-semibold text-gemini-dark-gray">Age</dt>
              <dd className="font-bold text-gemini-blue">{participant.age || '—'}</dd>
              <dt className="font-semibold text-gemini-dark-gray">Gender</dt>
              <dd className="font-bold text-gemini-blue">{participant.gender === 'M' ? 'Male' : 'Female'}</dd>
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
        {/* NEW: Standing Totals */}
        <div className="bg-gemini-light-gray rounded-2xl p-6 shadow-md mb-12">
          <h4 className="text-2xl font-bold text-center text-gemini-dark-gray mb-6">Your Standing</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
            <div className="bg-white rounded-xl p-4 shadow">
              <p className="text-sm text-gray-600 uppercase tracking-wide">Overall</p>
              <p className="text-3xl font-bold text-gemini-blue mt-2">
                {participant.place || '—'} / {overallTotal}
              </p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow">
              <p className="text-sm text-gray-600 uppercase tracking-wide">Gender</p>
              <p className="text-3xl font-bold text-gemini-blue mt-2">
                {participant.gender_place || '—'} / {genderTotal}
              </p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow">
              <p className="text-sm text-gray-600 uppercase tracking-wide">Division</p>
              <p className="text-3xl font-bold text-gemini-blue mt-2">
                {participant.age_group_place || '—'} / {divisionTotal}
              </p>
              <p className="text-sm text-gray-600 mt-2">{participant.age_group_name || '—'}</p>
            </div>
          </div>
        </div>
        {/* Splits */}
        {participant.splits && participant.splits.length > 0 && (
          <div className="mb-12">
            <button
              onClick={() => setShowSplits(!showSplits)}
              className="w-full bg-gemini-blue text-white py-3 rounded-xl font-semibold hover:bg-gemini-blue/90 transition mb-4"
            >
              {showSplits ? 'Hide' : 'Show'} Split Times ({participant.splits.length})
            </button>
            {showSplits && (
              <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gemini-blue text-white">
                    <tr>
                      <th className="px-6 py-3 text-left">Split</th>
                      <th className="px-6 py-3 text-left">Time</th>
                      <th className="px-6 py-3 text-left">Pace</th>
                      <th className="px-6 py-3 text-left">Place</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {participant.splits.map((split, i) => (
                      <tr key={i} className="hover:bg-gemini-light-gray/50">
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
        {/* Previews Section */}
        {previewError && <p className="text-center text-gemini-red mb-4">{previewError}</p>}
        {previews.length > 0 ? (
          <div className="mt-4 mb-12 bg-gemini-light-gray rounded-2xl p-8 shadow-lg">
            <h4 className="text-2xl font-bold mb-4 text-center text-gemini-dark-gray">Choose Your Favorite Graphic</h4>
            <div className="flex overflow-x-auto space-x-6 pb-4 snap-x snap-mandatory">
              {previews.map((url, index) => (
                <div
                  key={index}
                  className={`flex-shrink-0 cursor-pointer snap-center ${selectedPreviewIndex === index ? 'border-4 border-gemini-blue shadow-xl' : 'border border-gray-300 shadow-md'} rounded-xl overflow-hidden transform hover:scale-105 transition`}
                  onClick={() => setSelectedPreviewIndex(index)}
                >
                  <img src={url} alt={`Graphic Variant ${index + 1}`} className="w-64 h-auto" />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="mt-4 text-center text-gray-600 text-lg">Generating previews...</p>
        )}
        {/* Buttons */}
        <div className="flex flex-wrap justify-center gap-6 mt-8 mb-16">
          <button onClick={shareCertificate} className="bg-gemini-blue text-white px-8 py-4 rounded-full text-lg font-bold hover:bg-gemini-blue/80 shadow-md transform hover:scale-105 transition">
            Share Selected
          </button>
          <button onClick={downloadCertificate} className="bg-green-600 text-white px-8 py-4 rounded-full text-lg font-bold hover:bg-green-700 shadow-md transform hover:scale-105 transition">
            Download Selected
          </button>
          <button onClick={goBackToResults} className="bg-gray-600 text-white px-8 py-4 rounded-full text-lg font-bold hover:bg-gray-700 shadow-md transform hover:scale-105 transition">
            Back to Results
          </button>
        </div>
        {/* Sponsors */}
        <h3 className="text-3xl font-bold mb-6 text-center text-gemini-blue">Featured Sponsors</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {ads.map((ad, index) => (
            <img key={index} src={ad} alt={`Sponsor ${index + 1}`} className="w-full rounded-2xl shadow-md hover:shadow-xl transition" />
          ))}
        </div>
        {/* Hidden certificate templates */}
        {variants.map((variant, index) => (
          <div
            key={index}
            id={`certificate-variant-${index}`}
            style={{ ...variant.containerStyle, position: 'absolute', left: '-9999px', top: '-9999px' }}
          >
            {eventLogos[selectedEvent?.id] && (
              <img
                src={eventLogos[selectedEvent?.id]}
                alt="Race Logo Watermark"
                style={variant.watermarkStyle}
              />
            )}
            <div style={variant.contentStyle}>
              {variant.content}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}