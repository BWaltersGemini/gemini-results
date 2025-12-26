// src/pages/participant/ResultCardPreviewModal.jsx
// FINAL — Race-specific totals + optimized preview + geminitiming.com footer
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
  results, // Full array of results for the event
  userPhoto,
  triggerCamera,
  triggerGallery,
  removePhoto,
}) {
  const cardRef = useRef(null);
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  // CRITICAL FIX: Use only results from the participant's specific race
  const participantRaceName = participant.race_name || raceDisplayName;

  const raceResults = results.filter(
    r => (r.race_name || raceDisplayName) === participantRaceName
  );

  const raceFinishers = raceResults.filter(
    r => r.chip_time && r.chip_time.trim() !== ''
  );

  const overallTotal = raceResults.length; // All entrants in this race
  const genderTotal = raceFinishers.filter(
    r => r.gender === participant.gender
  ).length;
  const divisionTotal = raceFinishers.filter(
    r => r.age_group_name === participant.age_group_name
  ).length;

  const formatDate = (epoch) => {
    if (!epoch || isNaN(epoch)) return 'Date TBD';
    return new Date(epoch * 1000).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const generateAndDownload = async () => {
    if (!cardRef.current) {
      alert('Card not ready. Please try again.');
      return;
    }
    try {
      const canvas = await html2canvas(cardRef.current, {
        scale: 2.5,
        useCORS: true,
        allowTaint: true,
        backgroundColor: null,
        width: 1080,
        height: 1080,
      });
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
    if (!cardRef.current) return generateAndDownload();

    try {
      const canvas = await html2canvas(cardRef.current, {
        scale: 2.5,
        useCORS: true,
        allowTaint: true,
        width: 1080,
        height: 1080,
      });

      canvas.toBlob(async (blob) => {
        if (!blob) return generateAndDownload();

        const file = new File([blob], 'result-card.png', { type: 'image/png' });

        if (navigator.canShare?.({ files: [file] })) {
          try {
            await navigator.share({
              files: [file],
              title: 'My Race Result!',
              text: `I finished the ${raceDisplayName} in ${formatChronoTime(participant.chip_time)}! 🏁\n${participantResultsUrl}`,
            });
          } catch (shareErr) {
            console.warn('[ResultCardModal] Share canceled/failed:', shareErr);
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

  if (!show) return null;

  const ResultCardContent = ({ isPreview = false }) => {
    const baseClasses = 'bg-gradient-to-br from-brand-dark via-[#1a2a3f] to-brand-dark flex flex-col items-center justify-start text-center text-white';
    const containerClass = isPreview
      ? `${baseClasses} px-3 pt-4 pb-4`  // Tight bottom padding
      : `${baseClasses} px-8 pt-6 pb-10`;

    const textSize = isPreview
      ? {
          event: 'text-xl',
          race: 'text-base',
          date: 'text-xs',
          name: userPhoto ? 'text-2xl' : 'text-3xl',
          timeLabel: 'text-xs',
          time: 'text-4xl',
          statLabel: 'text-xs',
          statNum: 'text-xl',
          statOf: 'text-2xs',
          footer: 'text-xs'
        }
      : {
          event: 'text-5xl',
          race: 'text-3xl',
          date: 'text-2xl',
          name: userPhoto ? 'text-6xl' : 'text-7xl',
          timeLabel: 'text-3xl',
          time: 'text-9xl',
          statLabel: 'text-2xl',
          statNum: 'text-7xl',
          statOf: 'text-xl',
          footer: 'text-3xl'
        };

    return (
      <div className={containerClass} style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}>
        {/* Event Name (replaces logo) */}
        <div className={`w-full bg-white rounded-3xl shadow-2xl px-${isPreview ? '4' : '8'} py-${isPreview ? '3' : '6'} mb-${isPreview ? '2' : '6'} truncate`}>
          <h2 className={`${textSize.event} font-black text-brand-dark leading-tight truncate px-2`}>
            {selectedEvent.name || raceDisplayName || 'Race Event'}
          </h2>
        </div>

        {/* Race Name */}
        <p className={`${textSize.race} font-black text-accent mb-1 truncate w-full`}>
          {raceDisplayName}
        </p>

        {/* Date */}
        <p className={`${textSize.date} text-gray-300 mb-${isPreview ? '2' : '6'}`}>
          {formatDate(selectedEvent.start_time)}
        </p>

        {/* Photo + Name */}
        <div className={`flex items-center justify-center gap-${isPreview ? '4' : '16'} mb-${isPreview ? '3' : '8'} ${!userPhoto ? 'flex-col gap-2' : ''}`}>
          {userPhoto && (
            <div className={`w-${isPreview ? '20' : '64'} h-${isPreview ? '20' : '64'} rounded-full overflow-hidden border-${isPreview ? '4' : '8'} border-white shadow-2xl`}>
              <img src={userPhoto} alt="Finisher" className="w-full h-full object-cover" />
            </div>
          )}
          <h1 className={`font-black drop-shadow-2xl leading-tight ${textSize.name}`}>
            {participant.first_name}<br />{participant.last_name}
          </h1>
        </div>

        {/* Finish Time */}
        <div className={`mb-${isPreview ? '3' : '8'}`}>
          <p className={`${textSize.timeLabel} text-gray-400 uppercase tracking-widest mb-1`}>
            Finish Time
          </p>
          <p className={`${textSize.time} font-black text-[#FFD700] drop-shadow-2xl`}>
            {formatChronoTime(participant.chip_time)}
          </p>
        </div>

        {/* Stats Grid */}
        <div className={`grid grid-cols-3 gap-${isPreview ? '3' : '10'} w-full max-w-${isPreview ? 'xs' : '4xl'} text-white`}>
          <div>
            <p className={`${textSize.statLabel} text-gray-400 uppercase mb-1`}>Overall</p>
            <p className={`${textSize.statNum} font-bold text-[#FFD700]`}>{participant.place || '—'}</p>
            <p className={`${textSize.statOf} text-gray-400`}>of {overallTotal}</p>
          </div>
          <div>
            <p className={`${textSize.statLabel} text-gray-400 uppercase mb-1`}>Gender</p>
            <p className={`${textSize.statNum} font-bold text-[#FFD700]`}>{participant.gender_place || '—'}</p>
            <p className={`${textSize.statOf} text-gray-400`}>of {genderTotal}</p>
          </div>
          <div>
            <p className={`${textSize.statLabel} text-gray-400 uppercase mb-1`}>Division</p>
            <p className={`${textSize.statNum} font-bold text-[#FFD700]`}>{participant.age_group_place || '—'}</p>
            <p className={`${textSize.statOf} text-gray-400`}>of {divisionTotal}</p>
          </div>
        </div>

        {/* Footer — moved up slightly in preview */}
        <p className={`${textSize.footer} italic mt-auto pt-${isPreview ? '2' : '8'}`}>
          Find your next race at www.geminitiming.com
        </p>
      </div>
    );
  };

  return (
    <>
      {/* Hidden full-size card for high-quality export */}
      <div className="fixed -top-full opacity-0 pointer-events-none">
        <div ref={cardRef} className="w-[1080px] h-[1080px]">
          <ResultCardContent isPreview={false} />
        </div>
      </div>

      {/* Modal with live preview */}
      <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
        <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-8 relative my-8" onClick={(e) => e.stopPropagation()}>
          <button onClick={onClose} className="absolute top-4 right-4 text-4xl text-gray-600 hover:text-gray-900">
            &times;
          </button>

          <h3 className="text-3xl font-bold text-center mb-6">Your Result Card 🎉</h3>

          {/* Live Preview */}
          <div className="mb-8 flex justify-center">
            <div className="w-full max-w-sm aspect-square rounded-3xl overflow-hidden shadow-2xl">
              <ResultCardContent isPreview={true} />
            </div>
          </div>

          {/* Photo Controls */}
          <div className="text-center mb-8">
            {userPhoto ? (
              <>
                <img src={userPhoto} alt="Your photo" className="w-32 h-32 object-cover rounded-full mx-auto shadow-xl mb-4" />
                <button onClick={removePhoto} className="text-red-600 underline text-sm">
                  Remove Photo
                </button>
              </>
            ) : (
              <div className="w-32 h-32 bg-gray-200 rounded-full mx-auto mb-6 flex items-center justify-center text-5xl">
                📸
              </div>
            )}
            <div className="flex justify-center gap-4">
              <button onClick={triggerCamera} className="px-5 py-2 bg-brand-dark text-white font-bold rounded-full hover:opacity-90 transition text-sm">
                📷 Take Photo
              </button>
              <button onClick={triggerGallery} className="px-5 py-2 bg-gray-700 text-white font-bold rounded-full hover:opacity-90 transition text-sm">
                🖼️ From Gallery
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-4">
            <button onClick={generateAndDownload} className="w-full py-4 bg-primary text-white font-bold text-lg rounded-full hover:opacity-90 shadow-lg transition">
              {isMobile ? 'Save to Photos' : 'Download Card'}
            </button>
            <button onClick={shareCard} className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold text-lg rounded-full hover:opacity-90 shadow-lg transition">
              Share Card
            </button>
          </div>
        </div>
      </div>
    </>
  );
}