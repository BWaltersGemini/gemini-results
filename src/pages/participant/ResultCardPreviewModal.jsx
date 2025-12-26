// src/pages/participant/ResultCardPreviewModal.jsx
// FINAL — With live preview + Event Name instead of logo
import { useRef } from 'react';
import html2canvas from 'html2canvas';
import { formatChronoTime } from '../../utils/timeUtils'; // Adjust path if needed

export default function ResultCardPreviewModal({
  show,
  onClose,
  participant,
  selectedEvent,
  raceDisplayName,
  participantResultsUrl,
  results, // Array of all results for totals
  userPhoto,
  triggerCamera,
  triggerGallery,
  removePhoto,
}) {
  const cardRef = useRef(null);
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  // Safely calculate totals from results array
  const finishers = results.filter(r => r.chip_time && r.chip_time.trim() !== '');
  const overallTotal = results.length;
  const genderTotal = finishers.filter(r => r.gender === participant.gender).length;
  const divisionTotal = finishers.filter(r => r.age_group_name === participant.age_group_name).length;

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
            console.warn('[ResultCardModal] Share failed/canceled:', shareErr);
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

  // Reusable Card Content Component (used in both hidden & preview)
  const ResultCardContent = ({ isPreview = false }) => {
    const scale = isPreview ? 'preview' : 'full';
    const textSize = isPreview
      ? { event: 'text-2xl', race: 'text-lg', date: 'text-sm', name: userPhoto ? 'text-3xl' : 'text-4xl', timeLabel: 'text-sm', time: 'text-5xl', statLabel: 'text-xs', statNum: 'text-2xl', statOf: 'text-xs', footer: 'text-sm' }
      : { event: 'text-5xl', race: 'text-3xl', date: 'text-2xl', name: userPhoto ? 'text-6xl' : 'text-7xl', timeLabel: 'text-3xl', time: 'text-9xl', statLabel: 'text-2xl', statNum: 'text-7xl', statOf: 'text-xl', footer: 'text-3xl' };

    return (
      <div className={`bg-gradient-to-br from-brand-dark via-[#1a2a3f] to-brand-dark flex flex-col items-center justify-start text-center px-${isPreview ? '4' : '8'} pt-6 pb-10 text-white`}
           style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}>
        {/* Event Name (replaces logo) */}
        <div className={`w-full bg-white rounded-3xl shadow-2xl px-${isPreview ? '6' : '8'} py-${isPreview ? '4' : '6'} mb-${isPreview ? '3' : '6'}`}>
          <h2 className={`${textSize.event} font-black text-brand-dark leading-tight`}>
            {selectedEvent.name || raceDisplayName || 'Race Event'}
          </h2>
        </div>

        {/* Race Name */}
        <p className={`${textSize.race} font-black text-accent mb-${isPreview ? '1' : '2'} truncate w-full`}>
          {raceDisplayName}
        </p>

        {/* Date */}
        <p className={`${textSize.date} text-gray-300 mb-${isPreview ? '4' : '8'}`}>
          {formatDate(selectedEvent.start_time)}
        </p>

        {/* Photo + Name */}
        <div className={`flex items-center justify-center gap-${isPreview ? '6' : '16'} mb-${isPreview ? '4' : '8'} ${!userPhoto ? 'flex-col gap-3' : ''}`}>
          {userPhoto && (
            <div className={`w-${isPreview ? '24' : '64'} h-${isPreview ? '24' : '64'} rounded-full overflow-hidden border-${isPreview ? '4' : '8'} border-white shadow-2xl`}>
              <img src={userPhoto} alt="Finisher" className="w-full h-full object-cover" />
            </div>
          )}
          <h1 className={`font-black drop-shadow-2xl leading-none ${textSize.name}`}>
            {participant.first_name}<br />{participant.last_name}
          </h1>
        </div>

        {/* Finish Time */}
        <div className={`mb-${isPreview ? '4' : '10'}`}>
          <p className={`${textSize.timeLabel} text-gray-400 uppercase tracking-widest mb-${isPreview ? '1' : '3'}`}>
            Finish Time
          </p>
          <p className={`${textSize.time} font-black text-[#FFD700] drop-shadow-2xl`}>
            {formatChronoTime(participant.chip_time)}
          </p>
        </div>

        {/* Stats Grid */}
        <div className={`grid grid-cols-3 gap-${isPreview ? '4' : '10'} w-full max-w-${isPreview ? 'xs' : '4xl'} mb-${isPreview ? '0' : '12'} text-white`}>
          <div>
            <p className={`${textSize.statLabel} text-gray-400 uppercase mb-${isPreview ? '1' : '2'}`}>Overall</p>
            <p className={`${textSize.statNum} font-bold text-[#FFD700]`}>{participant.place || '—'}</p>
            <p className={`${textSize.statOf} text-gray-400 mt-${isPreview ? '0' : '2'}`}>of {overallTotal}</p>
          </div>
          <div>
            <p className={`${textSize.statLabel} text-gray-400 uppercase mb-${isPreview ? '1' : '2'}`}>Gender</p>
            <p className={`${textSize.statNum} font-bold text-[#FFD700]`}>{participant.gender_place || '—'}</p>
            <p className={`${textSize.statOf} text-gray-400 mt-${isPreview ? '0' : '2'}`}>of {genderTotal}</p>
          </div>
          <div>
            <p className={`${textSize.statLabel} text-gray-400 uppercase mb-${isPreview ? '1' : '2'}`}>Division</p>
            <p className={`${textSize.statNum} font-bold text-[#FFD700]`}>{participant.age_group_place || '—'}</p>
            <p className={`${textSize.statOf} text-gray-400 mt-${isPreview ? '0' : '2'}`}>of {divisionTotal}</p>
          </div>
        </div>

        {/* Footer */}
        <p className={`${textSize.footer} italic mt-auto`}>
          Find your next race at www.youkeepmoving.com
        </p>
      </div>
    );
  };

  return (
    <>
      {/* Hidden full-size card for high-quality download/share */}
      <div className="fixed -top-full opacity-0 pointer-events-none">
        <div ref={cardRef} className="w-[1080px] h-[1080px]">
          <ResultCardContent isPreview={false} />
        </div>
      </div>

      {/* Visible Modal with Live Preview */}
      <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
        <div
          className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-8 relative my-8"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-4xl text-gray-600 hover:text-gray-900"
          >
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
                <img
                  src={userPhoto}
                  alt="Your photo"
                  className="w-32 h-32 object-cover rounded-full mx-auto shadow-xl mb-4"
                />
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
              <button
                onClick={triggerCamera}
                className="px-5 py-2 bg-brand-dark text-white font-bold rounded-full hover:opacity-90 transition text-sm"
              >
                📷 Take Photo
              </button>
              <button
                onClick={triggerGallery}
                className="px-5 py-2 bg-gray-700 text-white font-bold rounded-full hover:opacity-90 transition text-sm"
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