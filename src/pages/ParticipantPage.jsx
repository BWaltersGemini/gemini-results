// src/pages/ParticipantPage.jsx (UPDATED: Added country + splits display)
import { useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import html2canvas from 'html2canvas';

export default function ParticipantPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { participant, selectedEvent, results, eventLogos, ads } = location.state || {};
  const [previews, setPreviews] = useState([]);
  const [selectedPreviewIndex, setSelectedPreviewIndex] = useState(0);
  const [showSplits, setShowSplits] = useState(false);

  const goBackToResults = () => navigate(-1);

  if (!participant) {
    return <p className="text-center text-xl text-gemini-red pt-40">No participant data available.</p>;
  }

  const overallTotal = results.length;
  const genderTotal = results.filter(r => r.gender === participant.gender).length;
  const divisionTotal = results.filter(r => r.age_group_name === participant.age_group_name).length;

  const variants = [
    // ... (your existing 5 variants unchanged - omitted for brevity)
  ];

  useEffect(() => {
    const generatePreviews = async () => {
      const previewUrls = [];
      for (let i = 0; i < variants.length; i++) {
        const certificate = document.getElementById(`certificate-variant-${i}`);
        const canvas = await html2canvas(certificate, {
          scale: 1,
          onclone: (clonedDocument) => {
            clonedDocument.getElementById(`certificate-variant-${i}`).style.display = 'block';
          }
        });
        previewUrls.push(canvas.toDataURL('image/png'));
      }
      setPreviews(previewUrls);
    };
    setTimeout(generatePreviews, 0);
  }, []);

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

              {/* NEW: Country */}
              {participant.country && (
                <>
                  <dt className="font-semibold text-gemini-dark-gray">Country</dt>
                  <dd className="font-bold text-gemini-blue">{participant.country}</dd>
                </>
              )}
            </dl>
          </div>
        </div>

        {/* Placement */}
        <p className="text-center mb-12 text-2xl font-semibold text-gemini-blue bg-gemini-light-gray py-4 rounded-xl shadow-inner">
          {participant.place || '—'} / {overallTotal} Overall • {participant.gender_place || '—'} / {genderTotal} {participant.gender === 'M' ? 'Men' : 'Women'} • {participant.age_group_place || '—'} / {divisionTotal} {participant.age_group_name}
        </p>

        {/* NEW: Intermediate Splits */}
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
            style={{ ...variant.containerStyle, display: 'none' }}
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