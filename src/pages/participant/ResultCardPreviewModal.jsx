// src/pages/participant/ResultCardPreviewModal.jsx
// FINAL VERSION — Exact Layout as Requested, Perfect Match Between Preview & Download
import { useRef } from 'react';
import html2canvas from 'html2canvas';
import { formatChronoTime } from '../../utils/timeUtils';

export default function ResultCardPreviewModal({
  show,
  onClose,
  participant,
  selectedEvent,
  raceDisplayName,
  results,
  userPhoto,
  triggerCamera,
  triggerGallery,
  removePhoto,
}) {
  const cardRef = useRef(null);
  const isMobileDevice = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  const overallTotal = results.finishers.length + results.nonFinishers.length;
  const genderTotal = results.finishers.filter(r => r.gender === participant.gender).length;
  const divisionTotal = results.finishers.filter(r => r.age_group_name === participant.age_group_name).length;

  const formatDate = (epoch) => {
    if (!epoch || isNaN(epoch)) return 'Date TBD';
    const date = new Date(epoch * 1000);
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  const generateResultCard = async () => {
    if (!cardRef.current) return;

    try {
      const canvas = await html2canvas(cardRef.current, {
        scale: 3,
        useCORS: true,
        allowTaint: true,
        backgroundColor: null,
        logging: false,
        width: 1080,
        height: 1080,
        scrollX: -window.scrollX,
        scrollY: -window.scrollY,
        windowWidth: document.documentElement.offsetWidth,
        windowHeight: document.documentElement.offsetHeight,
      });

      const image = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `${participant.first_name}_${participant.last_name}_result.png`;
      link.href = image;
      link.click();
    } catch (err) {
      console.error('[ResultCard] Failed:', err);
      alert('Failed to generate card — check console');
    }
  };

  const shareResultCard = async () => {
    if (!cardRef.current) return;

    try {
      const canvas = await html2canvas(cardRef.current, {
        scale: 3,
        useCORS: true,
        allowTaint: true,
        backgroundColor: null,
        width: 1080,
        height: 1080,
        scrollX: -window.scrollX,
        scrollY: -window.scrollY,
        windowWidth: document.documentElement.offsetWidth,
        windowHeight: document.documentElement.offsetHeight,
      });

      canvas.toBlob(async (blob) => {
        if (!blob) return generateResultCard();
        const file = new File([blob], 'result-card.png', { type: 'image/png' });
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: 'My Race Result!',
            text: `I finished the ${raceDisplayName} in ${participant.chip_time}! 🏁`,
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
    const text = encodeURIComponent(`I just finished the ${raceDisplayName} in ${participant.chip_time}! 🏁`);
    window.open(`https://www.facebook.com/sharer/sharer.php?quote=${text}`, '_blank');
  };

  const shareOnX = () => {
    const text = encodeURIComponent(`Just finished the ${raceDisplayName} in ${participant.chip_time}! 🏁`);
    window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank');
  };

  const shareOnInstagram = () => {
    alert('Instagram sharing works best with the downloaded image! Save your card and post it directly in the app.');
  };

  if (!show) return null;

  // Shared Card Component — Used for both preview and full-size download
  const ResultCard = ({ isFullSize = false }) => {
    const textSize = isFullSize ? {
      eventName: 'text-6xl',
      raceName: 'text-5xl',
      date: 'text-4xl',
      athleteName: 'text-9xl',
      finishLabel: 'text-5xl',
      finishTime: 'text-12xl',
      rankLabel: 'text-4xl',
      rankNumber: 'text-10xl',
      rankOf: 'text-3xl',
      footer: 'text-5xl'
    } : {
      eventName: 'text-2xl',
      raceName: 'text-xl',
      date: 'text-base',
      athleteName: 'text-5xl',
      finishLabel: 'text-lg',
      finishTime: 'text-6xl',
      rankLabel: 'text-base',
      rankNumber: 'text-4xl',
      rankOf: 'text-sm',
      footer: 'text-base'
    };

    return (
      <div className={`flex flex-col items-center justify-between h-full pt-12 pb-8 px-8 ${isFullSize ? 'space-y-12' : 'space-y-6'}`}>
        {/* Event Name */}
        <p className={`font-bold text-white ${textSize.eventName}`}>{selectedEvent.name}</p>

        {/* Race Name */}
        <p className={`font-black text-accent ${textSize.raceName}`}>{raceDisplayName}</p>

        {/* Race Date */}
        <p className={`text-gray-300 ${textSize.date}`}>{formatDate(selectedEvent.start_time)}</p>

        {/* Athlete Photo + Name */}
        <div className={`flex items-center ${isFullSize ? 'gap-32' : 'gap-8'} ${!userPhoto ? 'flex-col gap-8' : ''}`}>
          {userPhoto && (
            <div className={`rounded-full overflow-hidden border-white shadow-2xl ${isFullSize ? 'w-96 h-96 border-20' : 'w-32 h-32 border-8'}`}>
              <img src={userPhoto} alt="Athlete" className="w-full h-full object-cover" crossOrigin="anonymous" />
            </div>
          )}
          <h1 className={`font-black text-white drop-shadow-2xl text-center leading-tight ${textSize.athleteName}`}>
            {participant.first_name}<br />{participant.last_name}
          </h1>
        </div>

        {/* Finish Time */}
        <div className="text-center">
          <p className={`text-gray-400 uppercase tracking-widest ${textSize.finishLabel}`}>Finish Time</p>
          <p className={`font-black text-[#FFD700] drop-shadow-2xl leading-none ${textSize.finishTime}`}>
            {formatChronoTime(participant.chip_time)}
          </p>
        </div>

        {/* Rankings Row */}
        <div className={`grid grid-cols-3 gap-${isFullSize ? '20' : '8'} text-center w-full`}>
          <div>
            <p className={`text-gray-400 uppercase ${textSize.rankLabel}`}>Overall</p>
            <p className={`font-bold text-[#FFD700] leading-none ${textSize.rankNumber}`}>
              {participant.place || '—'}
            </p>
            <p className={`text-gray-400 ${textSize.rankOf}`}>of {overallTotal}</p>
          </div>
          <div>
            <p className={`text-gray-400 uppercase ${textSize.rankLabel}`}>Gender</p>
            <p className={`font-bold text-[#FFD700] leading-none ${textSize.rankNumber}`}>
              {participant.gender_place || '—'}
            </p>
            <p className={`text-gray-400 ${textSize.rankOf}`}>of {genderTotal}</p>
          </div>
          <div>
            <p className={`text-gray-400 uppercase ${textSize.rankLabel}`}>Division</p>
            <p className={`font-bold text-[#FFD700] leading-none ${textSize.rankNumber}`}>
              {participant.age_group_place || '—'}
            </p>
            <p className={`text-gray-400 ${textSize.rankOf}`}>of {divisionTotal}</p>
          </div>
        </div>

        {/* Footer */}
        <p className={`text-white italic ${textSize.footer}`}>
          www.geminitiming.com
        </p>
      </div>
    );
  };

  return (
    <>
      {/* Hidden Full-Size Card for Download */}
      <div className="fixed -top-full left-0 opacity-0 pointer-events-none">
        <div
          ref={cardRef}
          className="w-[1080px] h-[1080px] bg-gradient-to-br from-brand-dark via-[#1a2a3f] to-brand-dark"
        >
          <ResultCard isFullSize={true} />
        </div>
      </div>

      {/* Modal with Preview */}
      <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
        <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full mx-auto my-8 p-8 relative max-h-screen overflow-y-auto" onClick={(e) => e.stopPropagation()}>
          <button onClick={onClose} className="absolute top-4 right-4 w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center text-4xl font-light hover:bg-gray-100 transition">
            ×
          </button>

          <h3 className="text-4xl font-bold text-center text-brand-dark mb-10">Your Result Card 🎉</h3>

          <div className="flex justify-center mb-12">
            <div className="relative bg-black rounded-3xl overflow-hidden shadow-2xl border-8 border-gray-300 w-96 h-96">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-7 bg-black rounded-b-2xl z-10"></div>
              <div className="absolute inset-0 bg-gradient-to-br from-brand-dark via-[#1a2a3f] to-brand-dark">
                <ResultCard isFullSize={false} />
              </div>
            </div>
          </div>

          {/* Photo Upload */}
          <div className="mb-12 text-center">
            <p className="text-3xl font-bold mb-8">📸 Add Your Finish Line Photo!</p>
            <div className="flex justify-center gap-8 mb-8">
              <button onClick={triggerCamera} className="px-10 py-5 bg-primary text-white font-bold text-xl rounded-full hover:bg-primary/90 transition shadow-lg">
                📷 Take Photo
              </button>
              <button onClick={triggerGallery} className="px-10 py-5 bg-brand-dark text-white font-bold text-xl rounded-full hover:bg-brand-dark/90 transition shadow-lg">
                🖼️ Choose from Gallery
              </button>
            </div>
            {userPhoto && (
              <div className="inline-block">
                <img src={userPhoto} alt="Your photo" className="w-40 h-40 object-cover rounded-full shadow-2xl border-4 border-white mb-4" />
                <button onClick={removePhoto} className="text-primary font-semibold underline">
                  Remove Photo
                </button>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-center gap-8 mb-12">
            <button onClick={generateResultCard} className="px-12 py-6 bg-primary text-white font-bold text-2xl rounded-full hover:bg-primary/90 transition shadow-2xl">
              {isMobileDevice ? 'Save to Photos' : 'Download Image'}
            </button>
            <button onClick={shareResultCard} className="px-12 py-6 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold text-2xl rounded-full hover:opacity-90 transition shadow-2xl">
              Share Now
            </button>
          </div>

          {/* Social Share */}
          <div className="text-center">
            <p className="text-2xl font-bold text-brand-dark mb-6">Or Share Directly</p>
            <div className="flex justify-center gap-6 flex-wrap">
              <button onClick={shareOnFacebook} className="px-8 py-4 bg-[#1877F2] text-white font-bold text-lg rounded-full hover:opacity-90 flex items-center gap-3 shadow-lg">
                <span className="text-3xl">f</span> Facebook
              </button>
              <button onClick={shareOnX} className="px-8 py-4 bg-black text-white font-bold text-lg rounded-full hover:opacity-90 flex items-center gap-3 shadow-lg">
                <span className="text-3xl">𝕏</span> X
              </button>
              <button onClick={shareOnInstagram} className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold text-lg rounded-full hover:opacity-90 flex items-center gap-3 shadow-lg">
                <span className="text-3xl">📸</span> Instagram
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}