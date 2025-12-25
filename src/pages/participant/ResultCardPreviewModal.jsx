// src/pages/participant/ResultCardPreviewModal.jsx
// FINAL FIXED — Downloadable Card No Longer Cropped!
import { useRef } from 'react';
import html2canvas from 'html2canvas';
import { formatChronoTime } from '../../utils/timeUtils';

export default function ResultCardPreviewModal({
  show,
  onClose,
  participant,
  selectedEvent,
  masterLogo,
  bibLogo,
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
        scale: 2.5,
        useCORS: true,
        allowTaint: true,
        backgroundColor: null,
        logging: false,
        width: 1080,
        height: 1080,
        // Critical fixes for cropping
        windowWidth: 1080,
        windowHeight: 1080,
        scrollX: 0,
        scrollY: 0,
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
        windowWidth: 1080,
        windowHeight: 1080,
        scrollX: 0,
        scrollY: 0,
      });
      canvas.toBlob(async (blob) => {
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

  // Social shares unchanged
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

  return (
    <>
      {/* Hidden Full-Size Card — Fixed Cropping */}
      <div className="fixed -top-full left-0 opacity-0 pointer-events-none">
        <div
          ref={cardRef}
          className="w-[1080px] h-[1080px] box-border bg-gradient-to-br from-brand-dark via-[#1a2a3f] to-brand-dark flex flex-col items-center justify-between text-center px-12 py-16 overflow-hidden"
          style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}
        >
          {/* Top Section */}
          <div className="flex flex-col items-center">
            <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl p-8 mb-10">
              {masterLogo ? (
                <img src={masterLogo} alt="Series Logo" className="max-w-full max-h-40 object-contain mx-auto" crossOrigin="anonymous" />
              ) : bibLogo ? (
                <img src={bibLogo} alt="Event Logo" className="max-w-full max-h-36 object-contain mx-auto" crossOrigin="anonymous" />
              ) : (
                <h2 className="text-5xl font-black text-brand-dark">{selectedEvent.name}</h2>
              )}
            </div>

            <p className="text-5xl font-black text-accent mb-4">{raceDisplayName}</p>
            <p className="text-4xl font-semibold text-white mb-4">{selectedEvent.name}</p>
            <p className="text-3xl text-gray-300 mb-12">{formatDate(selectedEvent.start_time)}</p>

            <div className={`flex items-center justify-center gap-24 mb-16 ${!userPhoto ? 'flex-col gap-12' : ''}`}>
              {userPhoto && (
                <div className="w-96 h-96 rounded-full overflow-hidden border-16 border-white shadow-2xl">
                  <img src={userPhoto} alt="Finisher" className="w-full h-full object-cover" crossOrigin="anonymous" />
                </div>
              )}
              <h1 className={`font-black text-white drop-shadow-2xl leading-tight ${userPhoto ? 'text-8xl' : 'text-10xl'}`}>
                {participant.first_name}<br />{participant.last_name}
              </h1>
            </div>

            <div className="mb-20">
              <p className="text-5xl text-gray-400 uppercase tracking-widest mb-8">Finish Time</p>
              <p className="text-11xl font-black text-[#FFD700] drop-shadow-2xl leading-none">
                {formatChronoTime(participant.chip_time)}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-20 text-white w-full max-w-6xl mb-24">
              <div>
                <p className="text-4xl text-gray-400 uppercase mb-4">Overall</p>
                <p className="text-9xl font-bold text-[#FFD700] leading-none">{participant.place || '—'}</p>
                <p className="text-3xl text-gray-400 mt-4">of {overallTotal}</p>
              </div>
              <div>
                <p className="text-4xl text-gray-400 uppercase mb-4">Gender</p>
                <p className="text-9xl font-bold text-[#FFD700] leading-none">{participant.gender_place || '—'}</p>
                <p className="text-3xl text-gray-400 mt-4">of {genderTotal}</p>
              </div>
              <div>
                <p className="text-4xl text-gray-400 uppercase mb-4">Division</p>
                <p className="text-9xl font-bold text-[#FFD700] leading-none">{participant.age_group_place || '—'}</p>
                <p className="text-3xl text-gray-400 mt-4">of {divisionTotal}</p>
              </div>
            </div>
          </div>

          {/* Bottom Footer */}
          <p className="text-5xl text-white italic">
            www.geminitiming.com
          </p>
        </div>
      </div>

      {/* Modal — Preview remains the same beautiful version */}
      <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
        <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full mx-auto my-8 p-8 relative max-h-screen overflow-y-auto" onClick={(e) => e.stopPropagation()}>
          <button onClick={onClose} className="absolute top-4 right-4 w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center text-4xl font-light hover:bg-gray-100 transition">
            ×
          </button>

          <h3 className="text-4xl font-bold text-center text-brand-dark mb-10">Your Result Card 🎉</h3>

          <div className="flex justify-center mb-12">
            <div className="relative bg-black rounded-3xl overflow-hidden shadow-2xl border-8 border-gray-300 w-96 h-96">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-7 bg-black rounded-b-2xl z-10"></div>

              <div className="absolute inset-0 pt-10 px-4 pb-4 overflow-y-auto">
                <div className="flex flex-col items-center space-y-4">
                  <div className="bg-white rounded-2xl shadow-lg p-3">
                    {masterLogo ? (
                      <img src={masterLogo} alt="Series Logo" className="w-16 h-16 object-contain" />
                    ) : bibLogo ? (
                      <img src={bibLogo} alt="Event Logo" className="w-16 h-16 object-contain" />
                    ) : (
                      <p className="text-xs font-bold text-brand-dark text-center">{selectedEvent.name}</p>
                    )}
                  </div>

                  <p className="text-xl font-black text-accent">{raceDisplayName}</p>
                  <p className="text-base font-semibold text-white">{selectedEvent.name}</p>
                  <p className="text-xs text-gray-300">{formatDate(selectedEvent.start_time)}</p>

                  <div className={`flex items-center gap-5 ${!userPhoto ? 'flex-col gap-4' : ''}`}>
                    {userPhoto && (
                      <div className="w-24 h-24 rounded-full overflow-hidden border-6 border-white shadow-xl">
                        <img src={userPhoto} alt="Finisher" className="w-full h-full object-cover" />
                      </div>
                    )}
                    <h1 className={`font-black text-white drop-shadow-lg text-center leading-tight ${userPhoto ? 'text-3xl' : 'text-4xl'}`}>
                      {participant.first_name}<br />{participant.last_name}
                    </h1>
                  </div>

                  <div className="text-center my-4">
                    <p className="text-sm text-gray-400 uppercase tracking-wider mb-2">Finish Time</p>
                    <p className="text-5xl font-black text-[#FFD700] drop-shadow-xl leading-none">
                      {formatChronoTime(participant.chip_time)}
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-4 text-center text-xs w-full">
                    <div>
                      <p className="text-gray-400 uppercase mb-1">Overall</p>
                      <p className="text-2xl font-bold text-[#FFD700]">{participant.place || '—'}</p>
                      <p className="text-gray-400">of {overallTotal}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 uppercase mb-1">Gender</p>
                      <p className="text-2xl font-bold text-[#FFD700]">{participant.gender_place || '—'}</p>
                      <p className="text-gray-400">of {genderTotal}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 uppercase mb-1">Division</p>
                      <p className="text-2xl font-bold text-[#FFD700]">{participant.age_group_place || '—'}</p>
                      <p className="text-gray-400">of {divisionTotal}</p>
                    </div>
                  </div>

                  <p className="text-sm text-white italic mt-auto pt-4">
                    www.geminitiming.com
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Photo Upload & Buttons unchanged */}
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

          <div className="flex justify-center gap-8 mb-12">
            <button onClick={generateResultCard} className="px-12 py-6 bg-primary text-white font-bold text-2xl rounded-full hover:bg-primary/90 transition shadow-2xl">
              {isMobileDevice ? 'Save to Photos' : 'Download Image'}
            </button>
            <button onClick={shareResultCard} className="px-12 py-6 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold text-2xl rounded-full hover:opacity-90 transition shadow-2xl">
              Share Now
            </button>
          </div>

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