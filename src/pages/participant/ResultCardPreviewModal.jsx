// src/pages/participant/ResultCardPreviewModal.jsx
// FIXED — Uses props for logos, no ReferenceError
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
  results,
  userPhoto,
  triggerCamera,
  triggerGallery,
  removePhoto,
  masterLogo,   // ← Added
  bibLogo,      // ← Added
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

  if (!show) return null;

  return (
    <>
      {/* Hidden Full-Size Card — EXACT OLD CODE, using passed props */}
      <div className="fixed -top-full left-0 opacity-0 pointer-events-none">
        <div
          ref={cardRef}
          className="w-[1080px] h-[1080px] bg-gradient-to-br from-brand-dark via-[#1a2a3f] to-brand-dark flex flex-col items-center justify-start text-center px-8 pt-6 pb-10 overflow-hidden relative"
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
            <img src={participantResultsUrl ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(participantResultsUrl)}&margin=10&color=263238&bgcolor=FFFFFF` : ''} alt="QR Code" className="w-40 h-40 border-6 border-white rounded-2xl shadow-2xl" crossOrigin="anonymous" />
          </div>
          <p className="text-3xl text-white italic mt-auto mb-8">
            Find your next race at www.youkeepmoving.com
          </p>
        </div>
      </div>

      {/* Preview Modal — Scaled version of the same card */}
      <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
        <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full mx-auto my-8 p-8 relative" onClick={e => e.stopPropagation()}>
          <button
            onClick={onClose}
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
    </>
  );
}