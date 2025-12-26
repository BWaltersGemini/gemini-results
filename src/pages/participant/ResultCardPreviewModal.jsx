// src/pages/participant/ResultCardPreviewModal.jsx
// FINAL CLEAN VERSION — No preview, small modal, with console logs
import { useRef } from 'react';
import html2canvas from 'html2canvas';
import { formatChronoTime } from '../../utils/timeUtils';

export default function ResultCardPreviewModal({
  show,
  onClose,
  participant,
  selectedEvent,
  raceDisplayName,
  participantResultsUrl,
  results, // ← Array of results (not object with finishers/nonFinishers)
  userPhoto,
  triggerCamera,
  triggerGallery,
  removePhoto,
  masterLogo,
  bibLogo,
}) {
  const cardRef = useRef(null);
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  console.log('[ResultCardModal] Modal opened:', { show, participant: participant?.bib, userPhoto: !!userPhoto });

  // Calculate totals safely from results array
  const finishers = results.filter(r => r.chip_time && r.chip_time.trim() !== '');
  const overallTotal = results.length;
  const genderTotal = finishers.filter(r => r.gender === participant.gender).length;
  const divisionTotal = finishers.filter(r => r.age_group_name === participant.age_group_name).length;

  console.log('[ResultCardModal] Totals calculated:', { overallTotal, genderTotal, divisionTotal });

  const formatDate = (epoch) => {
    if (!epoch || isNaN(epoch)) return 'Date TBD';
    return new Date(epoch * 1000).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const generateAndDownload = async () => {
    console.log('[ResultCardModal] Download triggered');
    if (!cardRef.current) {
      console.warn('[ResultCardModal] cardRef is null!');
      return;
    }

    try {
      console.log('[ResultCardModal] Starting html2canvas...');
      const canvas = await html2canvas(cardRef.current, {
        scale: 2.5,
        useCORS: true,
        allowTaint: true,
        backgroundColor: null,
        width: 1080,
        height: 1080,
      });

      console.log('[ResultCardModal] Canvas generated, triggering download');
      const link = document.createElement('a');
      link.download = `${participant.first_name}_${participant.last_name}_result.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('[ResultCardModal] Download failed:', err);
      alert('Failed to generate card. Please try again.');
    }
  };

  const shareCard = async () => {
    console.log('[ResultCardModal] Share triggered');
    if (!cardRef.current) {
      console.warn('[ResultCardModal] cardRef missing, falling back to download');
      return generateAndDownload();
    }

    try {
      console.log('[ResultCardModal] Generating canvas for share...');
      const canvas = await html2canvas(cardRef.current, {
        scale: 2.5,
        useCORS: true,
        allowTaint: true,
        width: 1080,
        height: 1080,
      });

      canvas.toBlob(async (blob) => {
        if (!blob) {
          console.warn('[ResultCardModal] Blob empty, falling back to download');
          generateAndDownload();
          return;
        }

        const file = new File([blob], 'result-card.png', { type: 'image/png' });
        const canShare = navigator.share && navigator.canShare?.({ files: [file] });

        console.log('[ResultCardModal] Native share available:', canShare);

        if (canShare) {
          try {
            await navigator.share({
              files: [file],
              title: 'My Race Result!',
              text: `I finished the ${raceDisplayName} in ${formatChronoTime(participant.chip_time)}! 🏁\n${participantResultsUrl}`,
            });
            console.log('[ResultCardModal] Native share successful');
          } catch (shareErr) {
            console.warn('[ResultCardModal] Native share canceled/failed:', shareErr);
            generateAndDownload();
          }
        } else {
          generateAndDownload();
        }
      });
    } catch (err) {
      console.error('[ResultCardModal] Share failed:', err);
      generateAndDownload();
    }
  };

  if (!show) {
    console.log('[ResultCardModal] Modal hidden (show=false)');
    return null;
  }

  console.log('[ResultCardModal] Rendering modal');

  return (
    <>
      {/* Hidden card for html2canvas — full size, perfect quality */}
      <div className="fixed -top-full opacity-0 pointer-events-none">
        <div
          ref={cardRef}
          className="w-[1080px] h-[1080px] bg-gradient-to-br from-brand-dark via-[#1a2a3f] to-brand-dark flex flex-col items-center justify-start text-center px-8 pt-6 pb-10"
          style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}
        >
          <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl p-4 mb-6">
            {masterLogo ? (
              <img src={masterLogo} alt="Series Logo" className="max-w-full max-h-28 object-contain mx-auto" crossOrigin="anonymous" />
            ) : bibLogo ? (
              <img src={bibLogo} alt="Event Logo" className="max-w-full max-h-24 object-contain mx-auto" crossOrigin="anonymous" />
            ) : (
              <h2 className="text-4xl font-black text-brand-dark">{selectedEvent.name}</h2>
            )}
          </div>

          <p className="text-3xl font-black text-accent mb-2">{raceDisplayName}</p>
          <p className="text-2xl text-gray-300 mb-8">{formatDate(selectedEvent.start_time)}</p>

          <div className={`flex items-center justify-center gap-16 mb-8 ${!userPhoto ? 'flex-col gap-6' : ''}`}>
            {userPhoto && (
              <div className="w-64 h-64 rounded-full overflow-hidden border-8 border-white shadow-2xl">
                <img src={userPhoto} alt="Finisher" className="w-full h-full object-cover" />
              </div>
            )}
            <h1 className={`font-black text-white drop-shadow-2xl leading-none ${userPhoto ? 'text-6xl' : 'text-7xl'}`}>
              {participant.first_name}<br />{participant.last_name}
            </h1>
          </div>

          <div className="mb-10">
            <p className="text-3xl text-gray-400 uppercase tracking-widest mb-3">Finish Time</p>
            <p className="text-9xl font-black text-[#FFD700] drop-shadow-2xl">
              {formatChronoTime(participant.chip_time)}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-10 text-white w-full max-w-4xl mb-12">
            <div>
              <p className="text-2xl text-gray-400 uppercase mb-2">Overall</p>
              <p className="text-7xl font-bold text-[#FFD700]">{participant.place || '—'}</p>
              <p className="text-xl text-gray-400 mt-2">of {overallTotal}</p>
            </div>
            <div>
              <p className="text-2xl text-gray-400 uppercase mb-2">Gender</p>
              <p className="text-7xl font-bold text-[#FFD700]">{participant.gender_place || '—'}</p>
              <p className="text-xl text-gray-400 mt-2">of {genderTotal}</p>
            </div>
            <div>
              <p className="text-2xl text-gray-400 uppercase mb-2">Division</p>
              <p className="text-7xl font-bold text-[#FFD700]">{participant.age_group_place || '—'}</p>
              <p className="text-xl text-gray-400 mt-2">of {divisionTotal}</p>
            </div>
          </div>

          <p className="text-3xl text-white italic mt-auto mb-8">
            Find your next race at www.youkeepmoving.com
          </p>
        </div>
      </div>

      {/* Compact, clean modal — NO PREVIEW */}
      <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={onClose}>
        <div
          className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-8 relative"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-4xl text-gray-600 hover:text-gray-900"
          >
            &times;
          </button>

          <h3 className="text-3xl font-bold text-center mb-6">Your Result Card 🎉</h3>
          <p className="text-lg text-center text-gray-700 mb-8">
            Add your photo, then download and share!
          </p>

          {/* Photo Upload */}
          <div className="text-center mb-8">
            {userPhoto ? (
              <>
                <img
                  src={userPhoto}
                  alt="Your finish line photo"
                  className="w-40 h-40 object-cover rounded-full mx-auto shadow-xl mb-4"
                />
                <button onClick={removePhoto} className="text-red-600 underline">
                  Remove Photo
                </button>
              </>
            ) : (
              <div className="w-40 h-40 bg-gray-200 rounded-full mx-auto mb-6 flex items-center justify-center text-6xl">
                📸
              </div>
            )}

            <div className="flex justify-center gap-4 mt-6">
              <button
                onClick={triggerCamera}
                className="px-6 py-3 bg-brand-dark text-white font-bold rounded-full hover:opacity-90 transition"
              >
                📷 Take Photo
              </button>
              <button
                onClick={triggerGallery}
                className="px-6 py-3 bg-gray-700 text-white font-bold rounded-full hover:opacity-90 transition"
              >
                🖼️ From Gallery
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-4">
            <button
              onClick={generateAndDownload}
              className="w-full py-4 bg-primary text-white font-bold text-lg rounded-full hover:opacity-90 shadow-lg transition"
            >
              {isMobile ? 'Save to Photos' : 'Download Card'}
            </button>
            <button
              onClick={shareCard}
              className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold text-lg rounded-full hover:opacity-90 shadow-lg transition"
            >
              Share Card
            </button>
          </div>
        </div>
      </div>
    </>
  );
}